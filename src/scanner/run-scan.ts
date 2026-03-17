// ============================================================
// FILE: run-scan.ts
// PATH: src/scanner/run-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Runs a complete project scan synchronously
// ============================================================

import { getProjectIssues } from './jira-scanner';
import { findSpacesByKey, getSpacePages, getPageContent } from './confluence-scanner';
import { analyzeJiraStaleness, analyzeConfluenceStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { analyzeCrossReferences } from '../analyzers/cross-reference';
import { analyzeWorkflowAnomalies, analyzeOrphanIssues, analyzeOverloadedAssignees } from '../analyzers/advanced-checks';
import { calculateProjectScore } from '../analyzers/score-calculator';
import { upsertScanResult, saveProjectScore, clearProjectResults } from '../db/queries';
import { Finding, ProjectScore, ConfluencePage } from './types';

async function isAIEnabled(): Promise<boolean> {
  try {
    const { getConfig, getApiKey } = await import('../db/queries');
    const aiEnabled = await getConfig('ai_enabled', 'false');
    if (aiEnabled !== 'true') return false;
    const apiKey = await getApiKey();
    return !!apiKey && apiKey.length >= 10;
  } catch { return false; }
}

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  const scanStart = Date.now();
  const aiEnabled = await isAIEnabled();
  console.log(`[Scan] AI mode: ${aiEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`[Scan] Starting scan for ${projectKey}`);

  // 1. Get Jira issues
  const t1 = Date.now();
  const issues = await getProjectIssues(projectKey);
  console.log(`[Scan] Jira: ${issues.length} issues in ${Date.now() - t1}ms`);

  // Timeout protection: Forge functions have a 15-minute limit.
  // Large projects with 2000+ issues make changelog-based checks (workflow anomalies)
  // extremely slow because each issue requires a separate API call.
  const isLargeProject = issues.length > 2000;
  if (isLargeProject) {
    console.warn(`[Scan] Large project (${issues.length} issues) — skipping advanced checks to stay within timeout`);
  }

  // 2. Load configurable thresholds + run analyzers
  const { loadThresholds } = await import('../analyzers/staleness');
  await loadThresholds();

  const allFindings: Finding[] = [];

  const t2 = Date.now();
  allFindings.push(...await analyzeJiraStaleness(issues, projectKey));
  console.log(`[Scan] Staleness analyzer: ${Date.now() - t2}ms`);

  const t3 = Date.now();
  allFindings.push(...analyzeCompleteness(issues, projectKey));
  console.log(`[Scan] Completeness analyzer: ${Date.now() - t3}ms`);

  // 2b. Advanced checks
  // Workflow anomalies require changelog API calls per issue — skip for large projects
  if (!isLargeProject) {
    try {
      const t4 = Date.now();
      allFindings.push(...await analyzeWorkflowAnomalies(issues, projectKey));
      console.log(`[Scan] Workflow anomalies: ${Date.now() - t4}ms`);
    } catch (err) { console.log('[Scan] Workflow check failed:', err); }
  }

  try {
    const t5 = Date.now();
    allFindings.push(...analyzeOrphanIssues(issues, projectKey));
    console.log(`[Scan] Orphan issues: ${Date.now() - t5}ms`);
  } catch (err) { console.log('[Scan] Orphan check failed:', err); }

  try {
    const t6 = Date.now();
    allFindings.push(...analyzeOverloadedAssignees(issues, projectKey));
    console.log(`[Scan] Overloaded assignees: ${Date.now() - t6}ms`);
  } catch (err) { console.log('[Scan] Overload check failed:', err); }

  // 2c. Confluence scan
  const tConf = Date.now();
  const allPages: ConfluencePage[] = [];
  const pageContents = new Map<string, string>();

  try {
    const spaces = await findSpacesByKey(projectKey);
    console.log(`[Scan] ${projectKey}: ${spaces.length} Confluence spaces found`);

    for (const space of spaces.slice(0, 3)) {
      const pages = await getSpacePages(space.id);
      allPages.push(...pages);

      for (const page of pages.slice(0, 30)) {
        try {
          const content = await getPageContent(page.id);
          if (content) pageContents.set(page.id, content);
        } catch {}
      }
    }

    allFindings.push(...analyzeConfluenceStaleness(allPages, projectKey));
    allFindings.push(...analyzeCrossReferences(issues, allPages, pageContents, projectKey));
    console.log(`[Scan] Confluence: ${allPages.length} pages in ${Date.now() - tConf}ms`);
  } catch (err) {
    console.log('[Scan] Confluence scan failed:', err);
  }

  // 2d. Intelligence-Analysen (regelbasiert + optional KI)
  try {
    const { runIntelligenceChecks, runAIContradictionAnalysis } = await import('../analyzers/intelligence');
    const intelligenceFindings = await runIntelligenceChecks(issues, allPages, pageContents, projectKey, aiEnabled);
    allFindings.push(...intelligenceFindings);
  } catch (err) { console.log('[Scan] Intelligence checks failed:', err); }

  console.log(`[Scan] ${projectKey}: ${allFindings.length} findings`);

  // 3. Clear old results and save new ones
  const tDb = Date.now();
  try {
    await clearProjectResults(projectKey);
  } catch (err) {
    console.log('[Scan] Clear failed (table may not exist yet), continuing...');
  }

  // Save up to 200 findings individually.
  // Forge Storage has no native batch upsert — if performance becomes an issue,
  // consider implementing batchUpsertScanResults() with Promise.all() chunks of 10.
  const maxFindings = 200;
  for (const finding of allFindings.slice(0, maxFindings)) {
    try {
      await upsertScanResult(finding);
    } catch (err) {
      console.error('[Scan] Failed to save finding:', err);
    }
  }
  if (allFindings.length > maxFindings) {
    console.warn(`[Scan] ${allFindings.length} findings found but only ${maxFindings} saved (limit)`);
  }
  console.log(`[Scan] DB save: ${Math.min(allFindings.length, maxFindings)} findings in ${Date.now() - tDb}ms`);

  // 4. Calculate score
  const score = calculateProjectScore(allFindings, projectKey, issues.length);

  try {
    await saveProjectScore(score);
  } catch (err) {
    console.error('[Scan] Failed to save score:', err);
  }

  console.log(`[Scan] ${projectKey}: Score = ${score.overallScore}/100 (${allFindings.length} findings)`);

  const scanDuration = Date.now() - scanStart;
  console.log(`[Scan] ${projectKey}: Completed in ${scanDuration}ms (${issues.length} issues, ${allPages.length} pages, ${allFindings.length} findings)`);
  if (scanDuration > 60000) {
    console.warn(`[Scan] WARNING: Scan took ${Math.round(scanDuration / 1000)}s — may timeout on larger projects`);
  }

  return score;
}
