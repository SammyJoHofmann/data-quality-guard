// ============================================================
// FILE: queries.ts
// PATH: src/db/queries.ts
// PROJECT: DataQualityGuard
// PURPOSE: Database query helpers using Forge SQL
// ============================================================

import sql from '@forge/sql';
import { safeLimit } from '../utils/helpers';

// === SCAN RESULTS ===

export async function upsertScanResult(result: {
  id: string;
  itemType: string;
  itemKey: string;
  projectKey: string;
  checkType: string;
  score: number;
  severity: string;
  message: string;
  details?: string;
}): Promise<void> {
  await sql.prepare(`
    REPLACE INTO scan_results (id, item_type, item_key, project_key, check_type, score, severity, message, details, scanned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).bindParams(
    result.id, result.itemType, result.itemKey, result.projectKey,
    result.checkType, result.score, result.severity, result.message,
    result.details || null
  ).execute();
}

export async function getProjectFindings(projectKey: string, limit = 50): Promise<any[]> {
  const n = safeLimit(limit);
  const result = await sql.prepare(
    `SELECT * FROM scan_results WHERE project_key = ? ORDER BY severity DESC, score ASC LIMIT ${n}`
  ).bindParams(projectKey).execute();
  return result.rows;
}

export async function getIssueFindings(itemKey: string): Promise<any[]> {
  const result = await sql.prepare(
    `SELECT * FROM scan_results WHERE item_key = ? ORDER BY severity DESC, score ASC LIMIT 20`
  ).bindParams(itemKey).execute();
  return result.rows;
}

export async function clearProjectResults(projectKey: string): Promise<void> {
  await sql.prepare(`DELETE FROM scan_results WHERE project_key = ?`).bindParams(projectKey).execute();
}

// === PROJECT SCORES ===

export async function saveProjectScore(score: {
  projectKey: string;
  overallScore: number;
  stalenessScore: number;
  completenessScore: number;
  consistencyScore: number;
  crossRefScore: number;
  totalIssues: number;
  findingsCount: number;
}): Promise<void> {
  await sql.prepare(`
    INSERT INTO project_scores
    (project_key, overall_score, staleness_score, completeness_score, consistency_score, cross_ref_score, total_issues, findings_count, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).bindParams(
    score.projectKey, score.overallScore, score.stalenessScore,
    score.completenessScore, score.consistencyScore, score.crossRefScore,
    score.totalIssues, score.findingsCount
  ).execute();
}

export async function getLatestProjectScore(projectKey: string): Promise<any | null> {
  const result = await sql.prepare(
    `SELECT * FROM project_scores WHERE project_key = ? ORDER BY calculated_at DESC LIMIT 1`
  ).bindParams(projectKey).execute();
  return result.rows[0] || null;
}

export async function getProjectScoreHistory(projectKey: string, limit = 30): Promise<any[]> {
  const n = safeLimit(limit);
  const result = await sql.prepare(
    `SELECT overall_score, staleness_score, completeness_score, consistency_score, cross_ref_score, findings_count, calculated_at FROM project_scores WHERE project_key = ? ORDER BY calculated_at DESC LIMIT ${n}`
  ).bindParams(projectKey).execute();
  return result.rows;
}

export async function getAllProjectScores(): Promise<any[]> {
  const result = await sql.prepare(`
    SELECT ps.*
    FROM project_scores ps
    INNER JOIN (
      SELECT project_key, MAX(calculated_at) as max_date
      FROM project_scores
      GROUP BY project_key
    ) latest ON ps.project_key = latest.project_key AND ps.calculated_at = latest.max_date
    ORDER BY ps.overall_score ASC
  `).execute();
  return result.rows;
}

// === CONTRADICTIONS ===

export async function saveContradiction(c: {
  id: string;
  sourceType: string;
  sourceKey: string;
  targetType: string;
  targetKey: string;
  contradictionType: string;
  confidence: number;
  description: string;
  recommendation?: string;
}): Promise<void> {
  await sql.prepare(`
    REPLACE INTO contradictions
    (id, source_type, source_key, target_type, target_key, contradiction_type, confidence, description, recommendation, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).bindParams(
    c.id, c.sourceType, c.sourceKey, c.targetType, c.targetKey,
    c.contradictionType, c.confidence, c.description, c.recommendation || null
  ).execute();
}

// === SCAN HISTORY ===

export async function startScan(scanId: string, projectKey: string, scanType: string): Promise<void> {
  await sql.prepare(`
    INSERT INTO scan_history (scan_id, project_key, scan_type, started_at, status)
    VALUES (?, ?, ?, NOW(), 'running')
  `).bindParams(scanId, projectKey, scanType).execute();
}

export async function completeScan(scanId: string, itemsScanned: number, findingsCount: number): Promise<void> {
  await sql.prepare(`
    UPDATE scan_history SET completed_at = NOW(), items_scanned = ?, findings_count = ?, status = 'completed'
    WHERE scan_id = ?
  `).bindParams(itemsScanned, findingsCount, scanId).execute();
}

export async function failScan(scanId: string): Promise<void> {
  await sql.prepare(`
    UPDATE scan_history SET completed_at = NOW(), status = 'failed' WHERE scan_id = ?
  `).bindParams(scanId).execute();
}

export async function isScanRunning(projectKey: string): Promise<boolean> {
  try {
    const result = await sql.prepare(
      `SELECT scan_id FROM scan_history WHERE project_key = ? AND status = 'running' AND started_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1`
    ).bindParams(projectKey).execute();
    return (result.rows?.length || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Batch insert findings — 20 per INSERT for performance.
 */
export async function batchUpsertScanResults(findings: Array<{
  id: string;
  itemType: string;
  itemKey: string;
  projectKey: string;
  checkType: string;
  score: number;
  severity: string;
  message: string;
  details?: string;
}>): Promise<void> {
  const BATCH_SIZE = 20;
  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ');
    const params: any[] = [];
    for (const f of batch) {
      params.push(f.id, f.itemType, f.itemKey, f.projectKey, f.checkType, f.score, f.severity, f.message, f.details || null);
    }
    await sql.prepare(
      `REPLACE INTO scan_results (id, item_type, item_key, project_key, check_type, score, severity, message, details, scanned_at) VALUES ${placeholders}`
    ).bindParams(...params).execute();
  }
}

/**
 * Delete old data for retention policy.
 * - project_scores older than 90 days
 * - scan_history older than 30 days
 */
export async function cleanupOldData(): Promise<{ deletedScores: number; deletedScans: number }> {
  let deletedScores = 0;
  let deletedScans = 0;
  try {
    const r1 = await sql.prepare(
      `DELETE FROM project_scores WHERE calculated_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
    ).execute();
    deletedScores = (r1 as any).meta?.rowsAffected || 0;
  } catch { /* ok */ }
  try {
    const r2 = await sql.prepare(
      `DELETE FROM scan_history WHERE started_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    ).execute();
    deletedScans = (r2 as any).meta?.rowsAffected || 0;
  } catch { /* ok */ }
  return { deletedScores, deletedScans };
}

// === CONFIG ===

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  try {
    const result = await sql.prepare(
      `SELECT config_value FROM app_config WHERE config_key = ?`
    ).bindParams(key).execute();
    return (result.rows[0] as any)?.config_value || defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setConfig(key: string, value: string): Promise<void> {
  await sql.prepare(`
    REPLACE INTO app_config (config_key, config_value, updated_at) VALUES (?, ?, NOW())
  `).bindParams(key, value).execute();
}
