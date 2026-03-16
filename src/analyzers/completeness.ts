// ============================================================
// FILE: completeness.ts
// PATH: src/analyzers/completeness.ts
// PROJECT: DataQualityGuard
// PURPOSE: Checks Jira issues for missing/incomplete fields
// ============================================================

import { JiraIssue, Finding } from '../scanner/types';
import { generateId, extractTextFromADF } from '../utils/helpers';

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
