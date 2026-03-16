// ============================================================
// FILE: cross-reference.ts
// PATH: src/analyzers/cross-reference.ts
// PROJECT: DataQualityGuard
// PURPOSE: Cross-references between Jira issues and Confluence pages
// ============================================================

import { JiraIssue, ConfluencePage, Finding } from '../scanner/types';
import { extractJiraKeys } from '../scanner/confluence-scanner';
import { generateId } from '../utils/helpers';

export function analyzeCrossReferences(
  issues: JiraIssue[],
  pages: ConfluencePage[],
  pageContents: Map<string, string>,
  projectKey: string
): Finding[] {
  const findings: Finding[] = [];

  // Build lookup map: issue key -> issue
  const issueMap = new Map<string, JiraIssue>();
  for (const issue of issues) {
    issueMap.set(issue.key, issue);
  }

  // Check Confluence pages for Jira references
  for (const page of pages) {
    const content = pageContents.get(page.id);
    if (!content) continue;

    const referencedKeys = extractJiraKeys(content);
    if (referencedKeys.length === 0) continue;

    for (const key of referencedKeys) {
      // Only check issues from the scanned project
      if (!key.startsWith(projectKey + '-')) continue;

      const referencedIssue = issueMap.get(key);

      if (!referencedIssue) {
        // Referenced issue doesn't exist or was deleted
        findings.push({
          id: generateId('deadRef'),
          itemType: 'confluence_page',
          itemKey: page.id,
          projectKey,
          checkType: 'cross_reference',
          score: 30,
          severity: 'high',
          message: `Page "${page.title}" references ${key} which doesn't exist or was deleted`,
          details: JSON.stringify({ pageTitle: page.title, missingIssue: key })
        });
      } else {
        const isResolved = referencedIssue.fields.status?.statusCategory?.key === 'done';
        const resolution = referencedIssue.fields.resolution?.name;

        // Check if page references a resolved/closed issue (potential stale reference)
        if (isResolved) {
          findings.push({
            id: generateId('staleRef'),
            itemType: 'confluence_page',
            itemKey: page.id,
            projectKey,
            checkType: 'cross_reference',
            score: 50,
            severity: 'medium',
            message: `Page "${page.title}" references ${key} which is ${resolution || 'Done'} — may need update`,
            details: JSON.stringify({
              pageTitle: page.title,
              issueKey: key,
              issueStatus: referencedIssue.fields.status?.name,
              issueResolution: resolution
            })
          });
        }
      }
    }
  }

  return findings;
}
