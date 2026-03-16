// ============================================================
// FILE: jira-resolver.ts
// PATH: src/resolvers/jira-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira project dashboard
// ============================================================

import Resolver from '@forge/resolver';
import { getLatestProjectScore, getProjectFindings, getProjectScoreHistory, getAllProjectScores } from '../db/queries';
import { initializeDatabase } from '../db/schema';
import { runProjectScan } from '../scanner/run-scan';

// Forge SQL returns Decimal values as special objects, not primitives.
// We MUST convert everything to Number/String before sending to the frontend.
function sanitizeScore(score: any): any {
  if (!score) return null;
  return {
    overall_score: Number(score.overall_score) || 0,
    staleness_score: Number(score.staleness_score) || 0,
    completeness_score: Number(score.completeness_score) || 0,
    consistency_score: Number(score.consistency_score) || 0,
    cross_ref_score: Number(score.cross_ref_score) || 0,
    total_issues: Number(score.total_issues) || 0,
    findings_count: Number(score.findings_count) || 0,
    calculated_at: String(score.calculated_at || ''),
    project_key: String(score.project_key || ''),
  };
}

function sanitizeFinding(f: any): any {
  if (!f) return null;
  return {
    id: String(f.id || ''),
    item_type: String(f.item_type || ''),
    item_key: String(f.item_key || ''),
    project_key: String(f.project_key || ''),
    check_type: String(f.check_type || ''),
    score: Number(f.score) || 0,
    severity: String(f.severity || 'info'),
    message: String(f.message || ''),
    details: f.details ? String(f.details) : null,
    scanned_at: String(f.scanned_at || ''),
  };
}

function sanitizeFindings(findings: any[]): any[] {
  return (findings || []).map(sanitizeFinding).filter(Boolean);
}

function sanitizeHistoryEntry(h: any): any {
  if (!h) return null;
  return {
    overall_score: Number(h.overall_score) || 0,
    staleness_score: Number(h.staleness_score) || 0,
    completeness_score: Number(h.completeness_score) || 0,
    consistency_score: Number(h.consistency_score) || 0,
    cross_ref_score: Number(h.cross_ref_score) || 0,
    findings_count: Number(h.findings_count) || 0,
    calculated_at: String(h.calculated_at || ''),
  };
}

const resolver = new Resolver();

resolver.define('getProjectScore', async ({ payload, context }: any) => {
  await initializeDatabase();
  const projectKey = context?.extension?.project?.key || payload?.projectKey;
  if (!projectKey) return { error: 'No project context' };

  const rawScore = await getLatestProjectScore(projectKey);
  const rawFindings = await getProjectFindings(projectKey, 20);
  const rawHistory = await getProjectScoreHistory(projectKey, 14);

  return {
    score: sanitizeScore(rawScore),
    findings: sanitizeFindings(rawFindings),
    history: (rawHistory || []).map(sanitizeHistoryEntry),
  };
});

resolver.define('getAllScores', async () => {
  await initializeDatabase();
  const rawScores = await getAllProjectScores();
  return { scores: (rawScores || []).map(sanitizeScore) };
});

resolver.define('triggerScan', async ({ payload, context }: any) => {
  await initializeDatabase();
  const projectKey = context?.extension?.project?.key || payload?.projectKey;
  if (!projectKey) return { error: 'No project context' };

  try {
    const result = await runProjectScan(projectKey);
    return { message: `Scan complete for ${projectKey}`, score: result.overallScore, findings: result.findingsCount };
  } catch (err: any) {
    console.error('[triggerScan] Error:', err);
    return { error: err.message || 'Scan failed' };
  }
});

export const handler = resolver.getDefinitions();
