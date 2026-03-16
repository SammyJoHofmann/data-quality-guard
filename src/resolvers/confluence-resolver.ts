// ============================================================
// FILE: confluence-resolver.ts
// PATH: src/resolvers/confluence-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Confluence quality dashboard
// ============================================================

import Resolver from '@forge/resolver';
import { getAllProjectScores, getProjectFindings } from '../db/queries';
import { initializeDatabase } from '../db/schema';

const resolver = new Resolver();

// Forge SQL returns Decimal values as special objects — sanitize to primitives
function sanitizeScore(s: any): any {
  if (!s) return null;
  return {
    overall_score: Number(s.overall_score) || 0,
    staleness_score: Number(s.staleness_score) || 0,
    completeness_score: Number(s.completeness_score) || 0,
    consistency_score: Number(s.consistency_score) || 0,
    cross_ref_score: Number(s.cross_ref_score) || 0,
    total_issues: Number(s.total_issues) || 0,
    findings_count: Number(s.findings_count) || 0,
    calculated_at: String(s.calculated_at || ''),
    project_key: String(s.project_key || ''),
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

resolver.define('getDashboardData', async () => {
  await initializeDatabase();
  const rawScores = await getAllProjectScores();
  return { scores: (rawScores || []).map(sanitizeScore) };
});

resolver.define('getProjectDetails', async ({ payload }: any) => {
  await initializeDatabase();
  const { projectKey } = payload;
  const rawFindings = await getProjectFindings(projectKey, 30);
  return { findings: (rawFindings || []).map(sanitizeFinding).filter(Boolean) };
});

export const handler = resolver.getDefinitions();
