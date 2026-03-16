// ============================================================
// FILE: jira-scanner.ts
// PATH: src/scanner/jira-scanner.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scans Jira projects and issues via REST API v3
// ============================================================

import api, { route } from '@forge/api';
import { JiraIssue, JiraProject } from './types';

const MAX_RESULTS = 50;

export async function getAllProjects(): Promise<JiraProject[]> {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/project/search?maxResults=50`,
    { headers: { 'Accept': 'application/json' } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.values || [];
}

export async function getProjectIssues(
  projectKey: string,
  updatedSince?: string
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];

  const jqlParts = [`project = ${projectKey}`];
  if (updatedSince) {
    jqlParts.push(`updated >= "${updatedSince}"`);
  }
  const jql = jqlParts.join(' AND ');
  const maxResults = MAX_RESULTS;

  try {
    // GET request to /search/jql — the new Jira API (old /search was removed)
    const fields = 'summary,description,status,assignee,reporter,created,updated,priority,issuetype,labels,components,resolution,project';
    const response = await api.asApp().requestJira(
      route`/rest/api/3/search/jql?jql=${jql}&maxResults=${maxResults}&fields=${fields}`,
      { headers: { 'Accept': 'application/json' } }
    );

    console.log(`[JiraScanner] Response: ${response.status}`);

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch {}
      console.error(`[JiraScanner] Error ${response.status}: ${errText.substring(0, 300)}`);
      return [];
    }

    const data = await response.json();
    const issues = data.issues || [];
    allIssues.push(...issues);

    console.log(`[JiraScanner] Found ${issues.length} issues in ${projectKey}`);
  } catch (err: any) {
    console.error(`[JiraScanner] Exception: ${err.message}`);
  }

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
