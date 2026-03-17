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
 * Find Confluence spaces whose key matches the given project key.
 * Falls back to all spaces if no exact match found.
 */
export async function findSpacesByKey(projectKey: string): Promise<ConfluenceSpace[]> {
  const allSpaces = await getAllSpaces();
  // First try exact key match
  const exactMatch = allSpaces.filter(s => s.key.toUpperCase() === projectKey.toUpperCase());
  if (exactMatch.length > 0) return exactMatch;
  // Fallback: spaces whose key contains the project key
  const partialMatch = allSpaces.filter(s => s.key.toUpperCase().includes(projectKey.toUpperCase()));
  if (partialMatch.length > 0) return partialMatch;
  // Final fallback: scan ALL spaces (cross-project quality check)
  console.log(`[ConfluenceScanner] No space matches "${projectKey}" — scanning all ${allSpaces.length} spaces`);
  return allSpaces;
}

export function extractJiraKeys(htmlContent: string): string[] {
  // Match Jira issue keys in the format PROJECT-123
  const regex = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  const matches = htmlContent.match(regex);
  return [...new Set(matches || [])];
}
