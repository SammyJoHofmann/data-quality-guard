// ============================================================
// FILE: confluence-scanner.ts
// PATH: src/scanner/confluence-scanner.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scans Confluence spaces and pages via REST API v2
// ============================================================

import api, { route } from '@forge/api';
import { ConfluencePage, ConfluenceSpace } from './types';

export async function getAllSpaces(): Promise<ConfluenceSpace[]> {
  const allSpaces: ConfluenceSpace[] = [];
  let cursor: string | undefined;

  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces?limit=25&cursor=${cursor}`
      : route`/wiki/api/v2/spaces?limit=25`;

    const response = await api.asApp().requestConfluence(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[ConfluenceScanner] Spaces API error: ${response.status}`);
      break;
    }

    const data = await response.json();
    allSpaces.push(...(data.results || []));
    cursor = data._links?.next ? new URL(data._links.next).searchParams.get('cursor') || undefined : undefined;
  } while (cursor);

  console.log(`[ConfluenceScanner] Found ${allSpaces.length} spaces`);
  return allSpaces;
}

export async function getSpacePages(spaceId: string): Promise<ConfluencePage[]> {
  const allPages: ConfluencePage[] = [];
  let cursor: string | undefined;

  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces/${spaceId}/pages?limit=25&status=current&cursor=${cursor}`
      : route`/wiki/api/v2/spaces/${spaceId}/pages?limit=25&status=current`;

    const response = await api.asApp().requestConfluence(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[ConfluenceScanner] Pages API error: ${response.status}`);
      break;
    }

    const data = await response.json();
    allPages.push(...(data.results || []));
    cursor = data._links?.next ? new URL(data._links.next).searchParams.get('cursor') || undefined : undefined;

    // Safety limit
    if (allPages.length > 500) {
      console.log(`[ConfluenceScanner] Reached 500 page limit for space ${spaceId}`);
      break;
    }
  } while (cursor);

  return allPages;
}

export async function getPageContent(pageId: string): Promise<string> {
  const response = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) return '';

  const data = await response.json();
  return data.body?.storage?.value || '';
}

/**
 * Find Confluence spaces by project key — direct lookup instead of loading all spaces.
 * Falls back to getAllSpaces() + filter if direct lookup returns nothing.
 */
export async function findSpacesByKey(projectKey: string): Promise<ConfluenceSpace[]> {
  try {
    // Try direct lookup by key first (much faster than loading all spaces)
    const response = await api.asApp().requestConfluence(
      route`/wiki/api/v2/spaces?keys=${projectKey.toUpperCase()}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const directMatches = data.results || [];
      if (directMatches.length > 0) {
        console.log(`[ConfluenceScanner] Direct match: ${directMatches.length} spaces for key ${projectKey}`);
        return directMatches;
      }
    }
  } catch {
    /* direct lookup not supported, fall back */
  }

  // Fallback: load all spaces and filter by key or name
  const spaces = await getAllSpaces();
  return spaces.filter(s => {
    if (s.key?.toUpperCase() === projectKey.toUpperCase()) return true;
    const regex = new RegExp(`\\b${projectKey}\\b`, 'i');
    return regex.test(s.name || '');
  });
}

export function extractJiraKeys(htmlContent: string): string[] {
  // Match Jira issue keys in the format PROJECT-123
  const regex = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  const matches = htmlContent.match(regex);
  return [...new Set(matches || [])];
}
