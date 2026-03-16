// ============================================================
// FILE: completeness.ts
// PATH: src/analyzers/completeness.ts
// PROJECT: DataQualityGuard
// PURPOSE: Checks Jira issues for missing/incomplete fields
// ============================================================

import { JiraIssue, Finding } from '../scanner/types';
import { generateId, extractTextFromADF, daysSince } from '../utils/helpers';

export function analyzeCompleteness(issues: JiraIssue[], projectKey: string): Finding[] {
  const findings: Finding[] = [];

  for (const issue of issues) {
    const f = issue.fields;
    const isResolved = f.status?.statusCategory?.key === 'done';
    const issueType = f.issuetype?.name?.toLowerCase() || '';

    // Extract text from ADF description (Jira v3 returns ADF objects, not strings)
    const descText = extractTextFromADF(f.description);

    // No description or too short
    if (!descText || descText.trim().length < 10) {
      findings.push({
        id: generateId('noDesc'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'completeness',
        score: 30,
        severity: isResolved ? 'low' : 'high',
        message: `No description or description too short`,
      });
    }

    // No assignee (only for non-resolved)
    if (!f.assignee && !isResolved) {
      findings.push({
        id: generateId('noAssign'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'completeness',
        score: 50,
        severity: 'medium',
        message: `No assignee — who is responsible?`,
      });
    }

    // No labels or components
    if ((!f.labels || f.labels.length === 0) && (!f.components || f.components.length === 0)) {
      findings.push({
        id: generateId('noLabels'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'completeness',
        score: 70,
        severity: 'low',
        message: `No labels or components — hard to categorize and find`,
      });
    }

    // No priority set
    if (!f.priority || f.priority.name === 'None') {
      findings.push({
        id: generateId('noPrio'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'completeness',
        score: 60,
        severity: 'low',
        message: `No priority set`,
      });
    }

    // Overdue issues (due date in the past, not resolved)
    const fields = f as any;
    if (fields.duedate && !isResolved) {
      const overdueDays = daysSince(fields.duedate);
      if (overdueDays > 0) {
        const severity = overdueDays > 30 ? 'critical' : overdueDays > 7 ? 'high' : 'medium';
        findings.push({
          id: generateId('overdue'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'completeness',
          score: overdueDays > 30 ? 10 : overdueDays > 7 ? 30 : 50,
          severity,
          message: `Overdue by ${overdueDays} days (due: ${fields.duedate})`,
        });
      }
    }

    // Story without story points
    if ((issueType === 'story' || issueType === 'user story') && !isResolved) {
      const storyPoints = fields.story_points || fields.customfield_10016;
      if (!storyPoints && storyPoints !== 0) {
        findings.push({
          id: generateId('noSP'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'completeness',
          score: 60,
          severity: 'medium',
          message: `Story without story points — cannot measure velocity`,
        });
      }
    }

    // Story without acceptance criteria
    if ((issueType === 'story' || issueType === 'user story') && descText) {
      const desc = descText.toLowerCase();
      const hasAC = desc.includes('acceptance') || desc.includes('criteria') ||
        desc.includes('given') || desc.includes('when') || desc.includes('then') ||
        desc.includes('akzeptanzkriterien');
      if (!hasAC) {
        findings.push({
          id: generateId('noAC'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'completeness',
          score: 40,
          severity: 'medium',
          message: `Story without apparent acceptance criteria`,
        });
      }
    }
  }

  return findings;
}
