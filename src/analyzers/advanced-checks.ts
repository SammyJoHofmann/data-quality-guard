// ============================================================
// FILE: advanced-checks.ts
// PATH: src/analyzers/advanced-checks.ts
// PROJECT: DataQualityGuard
// PURPOSE: Advanced quality checks — workflow anomalies, orphan issues, overloaded assignees
// ============================================================

import { JiraIssue, Finding } from '../scanner/types';
import { generateId } from '../utils/helpers';
import { getIssueChangelog } from '../scanner/jira-scanner';

/**
 * Detects workflow anomalies: issues that moved backwards in the workflow.
 * Example: "Done" -> "In Progress" indicates rework or premature closure.
 * Uses the changelog API to inspect status transitions.
 */
export async function analyzeWorkflowAnomalies(
  issues: JiraIssue[],
  projectKey: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Only check recently active issues (non-done) to limit API calls
  const candidates = issues.filter(i => {
    const cat = i.fields.status?.statusCategory?.key;
    return cat !== 'done';
  });

  // Limit changelog lookups to 50 issues max for performance
  const toCheck = candidates.slice(0, 50);

  // Parallelized in batches of 5 to avoid N+1
  for (let i = 0; i < toCheck.length; i += 5) {
    const batch = toCheck.slice(i, i + 5);
    const changelogResults = await Promise.all(
      batch.map(async (issue) => {
        try {
          const changelog = await getIssueChangelog(issue.key);
          return { issue, changelog };
        } catch {
          return { issue, changelog: [] as any[] };
        }
      })
    );

    for (const { issue, changelog } of changelogResults) {
      for (const entry of changelog) {
        for (const item of entry.items || []) {
          if (item.field !== 'status') continue;

          const fromCategory = item.from ? categorizeStatus(item.fromString || '') : null;
          const toCategory = item.to ? categorizeStatus(item.toString || '') : null;

          // Detect backward transitions: done -> in_progress, or done -> todo
          if (fromCategory === 'done' && (toCategory === 'in_progress' || toCategory === 'todo')) {
            findings.push({
              id: generateId('wfAnomaly'),
              itemType: 'jira_issue',
              itemKey: issue.key,
              projectKey,
              checkType: 'consistency',
              score: 30,
              severity: 'high',
              message: `Workflow regression: moved from "${item.fromString}" back to "${item.toString}" — indicates rework or premature closure`,
              details: JSON.stringify({
                from: item.fromString,
                to: item.toString,
                date: entry.created,
                author: entry.author?.displayName || 'Unknown'
              })
            });
            break; // One finding per issue is enough
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Detects orphan issues: Stories/Tasks without an Epic link.
 * Orphaned stories are harder to track and prioritize.
 */
export function analyzeOrphanIssues(
  issues: JiraIssue[],
  projectKey: string
): Finding[] {
  const findings: Finding[] = [];

  // Collect all epic keys in this project
  const epicKeys = new Set<string>();
  for (const issue of issues) {
    if (issue.fields.issuetype?.name?.toLowerCase() === 'epic') {
      epicKeys.add(issue.key);
    }
  }

  // If there are no epics at all, skip this check (project doesn't use epics)
  if (epicKeys.size === 0) return findings;

  for (const issue of issues) {
    const typeName = issue.fields.issuetype?.name?.toLowerCase() || '';
    const isResolved = issue.fields.status?.statusCategory?.key === 'done';

    // Only check stories and tasks (not epics, sub-tasks, bugs)
    if (typeName !== 'story' && typeName !== 'user story' && typeName !== 'task') continue;
    if (isResolved) continue;

    // Check if the issue has an epic link via fields
    // Jira v3 stores epic link in customfield_10014 (standard) or parent field
    const fields = issue.fields as any;
    const hasEpicLink = fields.parent?.key ||
      fields.customfield_10014 ||
      fields.epic?.key;

    if (!hasEpicLink) {
      findings.push({
        id: generateId('orphan'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'completeness',
        score: 50,
        severity: 'medium',
        message: `${issue.fields.issuetype?.name} without Epic link — harder to track and prioritize`,
      });
    }
  }

  return findings;
}

/**
 * Detects overloaded assignees: people with more than a threshold of open issues.
 * Default threshold: 15 open issues per person.
 */
export function analyzeOverloadedAssignees(
  issues: JiraIssue[],
  projectKey: string,
  threshold = 15
): Finding[] {
  const findings: Finding[] = [];

  // Count open issues per assignee
  const assigneeCounts = new Map<string, { name: string; count: number; keys: string[] }>();

  for (const issue of issues) {
    const isResolved = issue.fields.status?.statusCategory?.key === 'done';
    if (isResolved) continue;

    const assignee = issue.fields.assignee;
    if (!assignee?.accountId) continue;

    const existing = assigneeCounts.get(assignee.accountId);
    if (existing) {
      existing.count++;
      if (existing.keys.length < 5) existing.keys.push(issue.key);
    } else {
      assigneeCounts.set(assignee.accountId, {
        name: assignee.displayName,
        count: 1,
        keys: [issue.key]
      });
    }
  }

  // Report overloaded assignees
  for (const [_accountId, data] of assigneeCounts) {
    if (data.count > threshold) {
      findings.push({
        id: generateId('overload'),
        itemType: 'jira_issue',
        itemKey: data.keys[0], // Primary issue key for reference
        projectKey,
        checkType: 'consistency',
        score: Math.max(10, 100 - (data.count - threshold) * 5),
        severity: data.count > threshold * 2 ? 'critical' : 'high',
        message: `${data.name} has ${data.count} open issues — potential bottleneck (threshold: ${threshold})`,
        details: JSON.stringify({
          assignee: data.name,
          openIssueCount: data.count,
          sampleKeys: data.keys,
          threshold
        })
      });
    }
  }

  return findings;
}

/**
 * Detects sprint spillover: issues in a closed sprint that are not Done.
 * These are issues that didn't get completed in their sprint.
 */
export function analyzeSprintSpillover(
  issues: JiraIssue[],
  projectKey: string
): Finding[] {
  const findings: Finding[] = [];

  for (const issue of issues) {
    const fields = issue.fields as any;
    const isResolved = fields.status?.statusCategory?.key === 'done';
    if (isResolved) continue;

    // Sprint field can be an array of sprint objects
    const sprints = fields.sprint ? [fields.sprint] : (fields.customfield_10020 || []);
    if (!Array.isArray(sprints) || sprints.length === 0) continue;

    for (const sprint of sprints) {
      if (!sprint) continue;
      const sprintState = (sprint.state || '').toLowerCase();
      if (sprintState === 'closed') {
        findings.push({
          id: generateId('spillover'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'consistency',
          score: 40,
          severity: 'high',
          message: `Sprint spillover: not Done but in closed sprint "${sprint.name || 'Unknown'}"`,
          details: JSON.stringify({
            sprintName: sprint.name,
            sprintState: sprint.state,
            currentStatus: fields.status?.name
          })
        });
        break; // One finding per issue
      }
    }
  }

  return findings;
}

/**
 * Helper: rough categorization of Jira status names into workflow phases.
 */
function categorizeStatus(statusName: string): 'todo' | 'in_progress' | 'done' | 'unknown' {
  const lower = statusName.toLowerCase();
  if (lower.includes('done') || lower.includes('closed') || lower.includes('resolved') || lower.includes('complete')) {
    return 'done';
  }
  if (lower.includes('progress') || lower.includes('review') || lower.includes('testing') || lower.includes('development')) {
    return 'in_progress';
  }
  if (lower.includes('todo') || lower.includes('to do') || lower.includes('open') || lower.includes('backlog') || lower.includes('new')) {
    return 'todo';
  }
  return 'unknown';
}
