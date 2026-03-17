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
    const { getConfig } = await import('../db/queries');
    const aiEnabled = await getConfig('ai_enabled', 'false');
    if (aiEnabled !== 'true') return false;
    const apiKey = await getConfig('ai_api_key', '');
    return !!apiKey && apiKey.length >= 10;
  } catch { return false; }
}

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  const aiEnabled = await isAIEnabled();
  console.log(`[Scan] AI mode: ${aiEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`[Scan] Starting scan for ${projectKey}`);

  // 1. Get Jira issues
  const issues = await getProjectIssues(projectKey);
  console.log(`[Scan] ${projectKey}: ${issues.length} issues found`);

  // 2. Load configurable thresholds + run analyzers
  const { loadThresholds } = await import('../analyzers/staleness');
  await loadThresholds();

  const allFindings: Finding[] = [];
  allFindings.push(...await analyzeJiraStaleness(issues, projectKey));
  allFindings.push(...analyzeCompleteness(issues, projectKey));

  // 2b. Advanced checks
  try {
    allFindings.push(...await analyzeWorkflowAnomalies(issues, projectKey));
  } catch (err) { console.log('[Scan] Workflow check failed:', err); }

  try {
    allFindings.push(...analyzeOrphanIssues(issues, projectKey));
  } catch (err) { console.log('[Scan] Orphan check failed:', err); }

  try {
    allFindings.push(...analyzeOverloadedAssignees(issues, projectKey));
  } catch (err) { console.log('[Scan] Overload check failed:', err); }

  // 2c. Confluence scan
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
    console.log(`[Scan] ${projectKey}: ${allPages.length} Confluence pages scanned`);
  } catch (err) {
    console.log('[Scan] Confluence scan failed:', err);
  }

  // 2d. Intelligence-Analysen (regelbasiert + optional KI)
  try {
    const { runIntelligenceChecks, runAIContradictionAnalysis } = await import('../analyzers/intelligence');
    const intelligenceFindings = await runIntelligenceChecks(issues, allPages, pageContents, projectKey, aiEnabled);
    allFindings.push(...intelligenceFindings);

    if (aiEnabled) {
      try {
        const aiFindings = await runAIContradictionAnalysis(issues, allPages, pageContents, projectKey);
        allFindings.push(...aiFindings);
      } catch (err) { console.log('[Scan] AI analysis failed:', err); }
    }
  } catch (err) { console.log('[Scan] Intelligence checks failed:', err); }

  console.log(`[Scan] ${projectKey}: ${allFindings.length} findings`);

  // 3. Clear old results and save new ones
  try {
    await clearProjectResults(projectKey);
  } catch (err) {
    console.log('[Scan] Clear failed (table may not exist yet), continuing...');
  }

  for (const finding of allFindings.slice(0, 100)) {
    try {
      await upsertScanResult(finding);
    } catch (err) {
      console.error('[Scan] Failed to save finding:', err);
    }
  }

  // 4. Calculate score
  const score = calculateProjectScore(allFindings, projectKey, issues.length);

  try {
    await saveProjectScore(score);
  } catch (err) {
    console.error('[Scan] Failed to save score:', err);
  }

  console.log(`[Scan] ${projectKey}: Score = ${score.overallScore}/100 (${allFindings.length} findings)`);
  return score;
}
