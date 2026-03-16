// ============================================================
// FILE: jira-scanner.ts
// PATH: src/scanner/jira-scanner.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scans Jira projects and issues via REST API v3
// ============================================================

import api, { route } from '@forge/api';
import { JiraIssue, JiraProject } from './types';

const MAX_RESULTS = 100;

export async function getAllProjects(): Promise<JiraProject[]> {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/project/search?maxResults=50&expand=description`,
    { headers: { 'Accept': 'application/json' } }
  );
  const data = await response.json();
  return data.values || [];
}

export async function getProjectIssues(
  projectKey: string,
  updatedSince?: string
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  let hasMore = true;

  const jqlParts = [`project = ${projectKey}`];
  if (updatedSince) {
    jqlParts.push(`updated >= "${updatedSince}"`);
  }
  const jql = jqlParts.join(' AND ');

  while (hasMore) {
    // POST to /search/jql with JSON body (new Jira API, old /search was removed)
    const searchBody = JSON.stringify({ jql, startAt, maxResults: MAX_RESULTS, fields: [
      'summary', 'description', 'status', 'assignee', 'reporter',
      'created', 'updated', 'priority', 'issuetype', 'labels',
      'components', 'resolution', 'project', 'parent', 'duedate'
    ]});
    console.log(`[JiraScanner] Searching: jql="${jql}" startAt=${startAt}`);
    const response = await api.asApp().requestJira(
      route`/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: searchBody
      }
    );

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch {}
      console.error(`[JiraScanner] API error ${response.status}: JQL="${jql}" Body="${errText.substring(0, 500)}"`);
      break;
    }

    const data = await response.json();
    const issues = data.issues || [];
    allIssues.push(...issues);

    startAt += MAX_RESULTS;
    hasMore = startAt < (data.total || 0);

    // Respect rate limits
    if (hasMore && allIssues.length > 500) {
      console.log(`[JiraScanner] Scanned ${allIssues.length}/${data.total} issues, pausing...`);
      break; // Limit for safety, continue in next scan
    }
  }

  console.log(`[JiraScanner] Found ${allIssues.length} issues in ${projectKey}`);
  return allIssues;
}

export async function getIssueChangelog(issueKey: string): Promise<any[]> {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}/changelog?maxResults=20`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return data.values || [];
}
