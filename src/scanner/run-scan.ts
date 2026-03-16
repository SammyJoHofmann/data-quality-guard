// ============================================================
// FILE: run-scan.ts
// PATH: src/scanner/run-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Runs a complete project scan synchronously
// ============================================================

import { getProjectIssues } from './jira-scanner';
import { analyzeJiraStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { calculateProjectScore } from '../analyzers/score-calculator';
import { upsertScanResult, saveProjectScore, clearProjectResults } from '../db/queries';
import { Finding, ProjectScore } from './types';

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  console.log(`[Scan] Starting scan for ${projectKey}`);

  // 1. Get Jira issues
  const issues = await getProjectIssues(projectKey);
  console.log(`[Scan] ${projectKey}: ${issues.length} issues found`);

  // 2. Run analyzers
  const allFindings: Finding[] = [];
  allFindings.push(...analyzeJiraStaleness(issues, projectKey));
  allFindings.push(...analyzeCompleteness(issues, projectKey));

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
