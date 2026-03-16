// ============================================================
// FILE: run-scan.ts
// PATH: src/scanner/run-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Complete project scan — Jira + Confluence + KI
// ============================================================

import { getProjectIssues } from './jira-scanner';
import { findSpacesByKey, getSpacePages, getPageContent, extractJiraKeys } from './confluence-scanner';
import { analyzeJiraStaleness, analyzeConfluenceStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { analyzeCrossReferences } from '../analyzers/cross-reference';
import { analyzeWorkflowAnomalies, analyzeOrphanIssues, analyzeOverloadedAssignees, analyzeSprintSpillover } from '../analyzers/advanced-checks';
import { calculateProjectScore } from '../analyzers/score-calculator';
// AI analysis temporarily disabled until deploy issue resolved
// import { analyzeWithLLM, parseLLMResult } from '../ai/llm-client';
import { upsertScanResult, saveProjectScore, clearProjectResults, startScan, completeScan, failScan, getConfig, batchUpsertScanResults, isScanRunning } from '../db/queries';
import { Finding, ProjectScore } from './types';
import { generateId, stripHtml } from '../utils/helpers';

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  const scanId = generateId('scan');
  console.log(`[Scan] Starting full scan for ${projectKey} (${scanId})`);

  // === SCAN LOCK: Prevent concurrent scans ===
  try {
    const alreadyRunning = await isScanRunning(projectKey);
    if (alreadyRunning) {
      console.log(`[Scan] Scan already running for ${projectKey}, skipping`);
      throw new Error(`Scan already running for ${projectKey}`);
    }
  } catch (err: any) {
    if (err.message?.includes('already running')) throw err;
    /* table might not exist on first run */
  }

  try {
    await startScan(scanId, projectKey, 'full');
  } catch { /* table might not exist on first run */ }

  try {
    const allFindings: Finding[] = [];
    let totalItems = 0;

    // === 1. JIRA SCAN ===
    const issues = await getProjectIssues(projectKey);
    totalItems += issues.length;
    console.log(`[Scan] ${projectKey}: ${issues.length} Jira issues`);

    // Jira Analyzers — core checks
    allFindings.push(...analyzeJiraStaleness(issues, projectKey));
    allFindings.push(...analyzeCompleteness(issues, projectKey));

    // Jira Analyzers — advanced checks
    allFindings.push(...analyzeOrphanIssues(issues, projectKey));

    const overloadThreshold = parseInt(await getConfig('overload_threshold', '15'), 10);
    allFindings.push(...analyzeOverloadedAssignees(issues, projectKey, overloadThreshold));

    // Sprint spillover check
    allFindings.push(...analyzeSprintSpillover(issues, projectKey));

    try {
      const workflowFindings = await analyzeWorkflowAnomalies(issues, projectKey);
      allFindings.push(...workflowFindings);
      console.log(`[Scan] ${projectKey}: ${workflowFindings.length} workflow anomalies found`);
    } catch (err) {
      console.log(`[Scan] Workflow anomaly check failed: ${err}`);
    }

    // === 2. CONFLUENCE SCAN ===
    let allPages: any[] = [];
    const pageContents = new Map<string, string>();

    try {
      const matchingSpaces = await findSpacesByKey(projectKey);

      for (const space of matchingSpaces.slice(0, 3)) {
        const pages = await getSpacePages(space.id);
        allPages.push(...pages);

        // Get content for cross-references — parallelized in batches of 5
        const pagesToFetch = pages.slice(0, 30);
        for (let i = 0; i < pagesToFetch.length; i += 5) {
          const batch = pagesToFetch.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (page) => {
              try {
                const content = await getPageContent(page.id);
                return { id: page.id, content };
              } catch { return { id: page.id, content: '' }; }
            })
          );
          for (const r of results) {
            if (r.content) pageContents.set(r.id, r.content);
          }
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
    console.log(`[Scan] AI analysis: Requires API key configuration (skipped for now)`);

    console.log(`[Scan] ${projectKey}: ${allFindings.length} total findings`);

    // === 4. SAVE RESULTS (batch insert) ===
    try { await clearProjectResults(projectKey); } catch { /* ok */ }

    const findingsToSave = allFindings.slice(0, 200);
    try {
      await batchUpsertScanResults(findingsToSave);
    } catch {
      // Fallback: insert one by one
      for (const finding of findingsToSave) {
        try { await upsertScanResult(finding); } catch { /* skip failed */ }
      }
    }

    // === 5. CALCULATE SCORE ===
    const hasConfluence = allPages.length > 0;
    const score = calculateProjectScore(allFindings, projectKey, totalItems, hasConfluence);

    try { await saveProjectScore(score); } catch { /* ok */ }
    try { await completeScan(scanId, totalItems, allFindings.length); } catch { /* ok */ }

    console.log(`[Scan] ${projectKey}: Score = ${score.overallScore}/100 (${allFindings.length} findings, ${totalItems} items)`);
    return score;

  } catch (err) {
    console.error(`[Scan] Scan failed for ${projectKey}:`, err);
    try { await failScan(scanId); } catch { /* ok */ }
    throw err;
  }
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
