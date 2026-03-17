// ============================================================
// FILE: staleness.ts
// PATH: src/analyzers/staleness.ts
// PROJECT: DataQualityGuard
// PURPOSE: Detects stale/outdated Jira issues and Confluence pages
// ============================================================

import { JiraIssue, ConfluencePage, Finding } from '../scanner/types';
import { generateId, daysSince, severityFromScore } from '../utils/helpers';

// Configurable thresholds — loaded from DB or defaults
let THRESHOLDS = {
  ISSUE_STALE_WARNING: 30,
  ISSUE_STALE_CRITICAL: 90,
  ISSUE_IN_PROGRESS_WARNING: 14,
  ISSUE_IN_PROGRESS_CRITICAL: 60,
  PAGE_STALE_WARNING: 90,
  PAGE_STALE_CRITICAL: 180,
};

export async function loadThresholds(): Promise<void> {
  try {
    const { getConfig } = await import('../db/queries');
    THRESHOLDS.ISSUE_STALE_WARNING = Number(await getConfig('threshold_stale_warning', '30')) || 30;
    THRESHOLDS.ISSUE_STALE_CRITICAL = Number(await getConfig('threshold_stale_critical', '90')) || 90;
    THRESHOLDS.ISSUE_IN_PROGRESS_WARNING = Number(await getConfig('threshold_inprogress_warning', '14')) || 14;
    THRESHOLDS.ISSUE_IN_PROGRESS_CRITICAL = Number(await getConfig('threshold_inprogress_critical', '60')) || 60;
  } catch {}
}

export async function analyzeJiraStaleness(issues: JiraIssue[], projectKey: string): Promise<Finding[]> {
  await loadThresholds();
  const findings: Finding[] = [];

  for (const issue of issues) {
    const daysInactive = daysSince(issue.fields.updated);
    const statusCategory = issue.fields.status?.statusCategory?.key;
    const statusName = issue.fields.status?.name || 'Unknown';
    const isResolved = statusCategory === 'done';

    // Skip resolved issues
    if (isResolved) continue;

    // Check: Issue not updated for a long time
    if (daysInactive >= THRESHOLDS.ISSUE_STALE_CRITICAL) {
      findings.push({
        id: generateId('stale'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'staleness',
        score: Math.max(0, 100 - daysInactive),
        severity: 'critical',
        message: `Seit ${daysInactive} Tagen nicht aktualisiert (Status: ${statusName}) — bitte prüfen ob noch relevant`,
        details: JSON.stringify({
          lastUpdated: issue.fields.updated,
          status: statusName,
          assignee: issue.fields.assignee?.displayName || 'Unassigned'
        })
      });
    } else if (daysInactive >= THRESHOLDS.ISSUE_STALE_WARNING) {
      findings.push({
        id: generateId('stale'),
        itemType: 'jira_issue',
        itemKey: issue.key,
        projectKey,
        checkType: 'staleness',
        score: Math.max(20, 100 - daysInactive),
        severity: 'medium',
        message: `Seit ${daysInactive} Tagen inaktiv (Status: ${statusName}) — bitte prüfen ob noch relevant`,
      });
    }

    // Check: "In Progress" for too long
    if (statusCategory === 'indeterminate') {
      if (daysInactive >= THRESHOLDS.ISSUE_IN_PROGRESS_CRITICAL) {
        findings.push({
          id: generateId('stuck'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'staleness',
          score: 10,
          severity: 'critical',
          message: `Seit ${daysInactive} Tagen auf "In Progress" — vermutlich aufgegeben oder blockiert`,
        });
      } else if (daysInactive >= THRESHOLDS.ISSUE_IN_PROGRESS_WARNING) {
        findings.push({
          id: generateId('stuck'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'staleness',
          score: 40,
          severity: 'high',
          message: `Seit ${daysInactive} Tagen auf "In Progress" ohne Update — bitte Status prüfen`,
        });
      }
    }
  }

  return findings;
}

export function analyzeConfluenceStaleness(pages: ConfluencePage[], projectKey: string): Finding[] {
  const findings: Finding[] = [];

  for (const page of pages) {
    const lastUpdated = page.version?.createdAt;
    if (!lastUpdated) continue;

    const daysInactive = daysSince(lastUpdated);

    if (daysInactive >= THRESHOLDS.PAGE_STALE_CRITICAL) {
      findings.push({
        id: generateId('stale_page'),
        itemType: 'confluence_page',
        itemKey: page.id,
        projectKey,
        checkType: 'staleness',
        score: Math.max(0, 100 - Math.floor(daysInactive / 2)),
        severity: 'high',
        message: `"${page.title}" seit ${daysInactive} Tagen nicht aktualisiert — Inhalt möglicherweise veraltet`,
        details: JSON.stringify({
          title: page.title,
          lastUpdated,
          versionNumber: page.version?.number
        })
      });
    } else if (daysInactive >= THRESHOLDS.PAGE_STALE_WARNING) {
      findings.push({
        id: generateId('stale_page'),
        itemType: 'confluence_page',
        itemKey: page.id,
        projectKey,
        checkType: 'staleness',
        score: Math.max(30, 100 - Math.floor(daysInactive / 2)),
        severity: 'medium',
        message: `"${page.title}" seit ${daysInactive} Tagen nicht aktualisiert — bitte Aktualität prüfen`,
      });
    }
  }

  return findings;
}
