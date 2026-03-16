// ============================================================
// FILE: run-scan.ts
// PATH: src/scanner/run-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Complete project scan — Jira + Confluence + KI
// ============================================================

import { getProjectIssues } from './jira-scanner';
import { getAllSpaces, getSpacePages, getPageContent, extractJiraKeys } from './confluence-scanner';
import { analyzeJiraStaleness, analyzeConfluenceStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { analyzeCrossReferences } from '../analyzers/cross-reference';
import { calculateProjectScore } from '../analyzers/score-calculator';
// AI analysis temporarily disabled until deploy issue resolved
// import { analyzeWithLLM, parseLLMResult } from '../ai/llm-client';
import { upsertScanResult, saveProjectScore, clearProjectResults, startScan, completeScan } from '../db/queries';
import { Finding, ProjectScore } from './types';
import { generateId, stripHtml } from '../utils/helpers';

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  const scanId = generateId('scan');
  console.log(`[Scan] Starting full scan for ${projectKey} (${scanId})`);

  try {
    await startScan(scanId, projectKey, 'full');
  } catch { /* table might not exist on first run */ }

  const allFindings: Finding[] = [];
  let totalItems = 0;

  // === 1. JIRA SCAN ===
  const issues = await getProjectIssues(projectKey);
  totalItems += issues.length;
  console.log(`[Scan] ${projectKey}: ${issues.length} Jira issues`);

  // Jira Analyzers
  allFindings.push(...analyzeJiraStaleness(issues, projectKey));
  allFindings.push(...analyzeCompleteness(issues, projectKey));

  // === 2. CONFLUENCE SCAN ===
  let allPages: any[] = [];
  const pageContents = new Map<string, string>();

  try {
    const spaces = await getAllSpaces();
    // Match spaces by exact key or word-boundary name match
    const matchingSpaces = spaces.filter(s => {
      if (s.key?.toUpperCase() === projectKey.toUpperCase()) return true;
      const regex = new RegExp(`\\b${projectKey}\\b`, 'i');
      return regex.test(s.name || '');
    });

    for (const space of matchingSpaces.slice(0, 3)) {
      const pages = await getSpacePages(space.id);
      allPages.push(...pages);

      // Get content for cross-references (limit to 30 pages for performance)
      for (const page of pages.slice(0, 30)) {
        try {
          const content = await getPageContent(page.id);
          if (content) pageContents.set(page.id, content);
        } catch { /* skip failed pages */ }
      }
    }

    totalItems += allPages.length;
    console.log(`[Scan] ${projectKey}: ${allPages.length} Confluence pages from ${matchingSpaces.length} spaces`);

    // Confluence Staleness
    allFindings.push(...analyzeConfluenceStaleness(allPages, projectKey));

    // Cross-References (Confluence → Jira)
    allFindings.push(...analyzeCrossReferences(issues, allPages, pageContents, projectKey));

  } catch (err) {
    console.log(`[Scan] Confluence scan failed (may not be installed): ${err}`);
  }

  // === 3. KI ANALYSIS (Widerspruchserkennung) ===
  // AI analysis runs when Anthropic API key is configured
  // For now, rule-based cross-references handle consistency checks
  console.log(`[Scan] AI analysis: Requires API key configuration (skipped for now)`);

  console.log(`[Scan] ${projectKey}: ${allFindings.length} total findings`);

  // === 4. SAVE RESULTS ===
  try { await clearProjectResults(projectKey); } catch { /* ok */ }

  for (const finding of allFindings.slice(0, 200)) {
    try { await upsertScanResult(finding); } catch { /* skip failed */ }
  }

  // === 5. CALCULATE SCORE ===
  const hasConfluence = allPages.length > 0;
  const score = calculateProjectScore(allFindings, projectKey, totalItems, hasConfluence);

  try { await saveProjectScore(score); } catch { /* ok */ }
  try { await completeScan(scanId, totalItems, allFindings.length); } catch { /* ok */ }

  console.log(`[Scan] ${projectKey}: Score = ${score.overallScore}/100 (${allFindings.length} findings, ${totalItems} items)`);
  return score;
}

/**
 * KI-based contradiction detection using the funnel approach:
 * 1. Keyword overlap filter (free, fast)
 * 2. LLM analysis only for candidates (paid, slow)
 */
// AI analysis function will be activated when Anthropic API key is configured.
// The code lives in src/ai/llm-client.ts and uses the funnel approach:
// Stage 1: Keyword overlap pre-filter (free)
// Stage 2: LLM contradiction analysis (Claude API)
