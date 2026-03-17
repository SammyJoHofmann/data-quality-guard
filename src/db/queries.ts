// ============================================================
// FILE: queries.ts
// PATH: src/db/queries.ts
// PROJECT: DataQualityGuard
// PURPOSE: Database query helpers using Forge SQL
// ============================================================

import sql from '@forge/sql';

// Simple obfuscation for API keys (Forge SQL is already encrypted at rest)
// Uses btoa/atob (available in Forge runtime) instead of Node.js Buffer
function obfuscateKey(key: string): string {
  if (!key || key.startsWith('OBF:')) return key;
  return 'OBF:' + btoa(key.split('').reverse().join(''));
}

function deobfuscateKey(stored: string): string {
  if (!stored || !stored.startsWith('OBF:')) return stored;
  try {
    return atob(stored.slice(4)).split('').reverse().join('');
  } catch { return ''; }
}

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
    result.id,
    result.itemType,
    result.itemKey,
    result.projectKey,
    result.checkType,
    result.score,
    result.severity,
    result.message,
    result.details || null
  ).execute();
}

export async function getProjectFindings(projectKey: string, limit = 50): Promise<any[]> {
  const result = await sql.prepare(
    `SELECT * FROM scan_results WHERE project_key = ? AND (dismissed = FALSE OR dismissed IS NULL) ORDER BY severity DESC, score ASC LIMIT ${limit}`
  ).bindParams(projectKey).execute();
  return result.rows;
}

export async function getIssueFindings(itemKey: string): Promise<any[]> {
  const result = await sql.prepare(`
    SELECT * FROM scan_results
    WHERE item_key = ?
    ORDER BY severity DESC, score ASC
  `).bindParams(itemKey).execute();
  return result.rows;
}

export async function clearProjectResults(projectKey: string): Promise<void> {
  await sql.prepare(`
    DELETE FROM scan_results WHERE project_key = ?
  `).bindParams(projectKey).execute();
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
    score.projectKey,
    score.overallScore,
    score.stalenessScore,
    score.completenessScore,
    score.consistencyScore,
    score.crossRefScore,
    score.totalIssues,
    score.findingsCount
  ).execute();
}

export async function getLatestProjectScore(projectKey: string): Promise<any | null> {
  const result = await sql.prepare(`
    SELECT * FROM project_scores
    WHERE project_key = ?
    ORDER BY calculated_at DESC
    LIMIT 1
  `).bindParams(projectKey).execute();
  return result.rows[0] || null;
}

export async function getProjectScoreHistory(projectKey: string, limit = 30): Promise<any[]> {
  const result = await sql.prepare(
    `SELECT overall_score, staleness_score, completeness_score, consistency_score, cross_ref_score, findings_count, calculated_at FROM project_scores WHERE project_key = ? ORDER BY calculated_at DESC LIMIT ${limit}`
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
  page_title?: string;
  pageTitle?: string;
}): Promise<void> {
  const title = c.page_title || c.pageTitle || null;
  await sql.prepare(`
    REPLACE INTO contradictions
    (id, source_type, source_key, target_type, target_key, contradiction_type, confidence, description, recommendation, page_title, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).bindParams(
    c.id, c.sourceType, c.sourceKey, c.targetType, c.targetKey,
    c.contradictionType, c.confidence, c.description, c.recommendation || null, title
  ).execute();
}

export async function getProjectContradictions(projectKey: string): Promise<any[]> {
  const result = await sql.prepare(`
    SELECT * FROM contradictions
    WHERE (source_key LIKE CONCAT(?, '-%') OR target_key LIKE CONCAT(?, '-%'))
      AND resolved = FALSE
    ORDER BY confidence DESC
    LIMIT 50
  `).bindParams(projectKey, projectKey).execute();
  return result.rows;
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

// === CONFIG ===

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  const result = await sql.prepare(`
    SELECT config_value FROM app_config WHERE config_key = ?
  `).bindParams(key).execute();
  return (result.rows[0] as any)?.config_value || defaultValue;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await sql.prepare(`
    REPLACE INTO app_config (config_key, config_value, updated_at)
    VALUES (?, ?, NOW())
  `).bindParams(key, value).execute();
}

// === API KEY (obfuscated storage) ===

export async function setApiKey(key: string): Promise<void> {
  await setConfig('ai_api_key', obfuscateKey(key));
}

export async function getApiKey(): Promise<string> {
  const stored = await getConfig('ai_api_key', '');
  return deobfuscateKey(stored);
}

// === DISMISS FINDINGS ===

export async function dismissFinding(findingId: string): Promise<void> {
  await sql.prepare(`
    UPDATE scan_results SET dismissed = TRUE WHERE id = ?
  `).bindParams(findingId).execute();
}

// === AI ANALYSIS ===

export async function saveAIAnalysis(analysis: {
  id: string;
  projectKey: string;
  itemKey: string;
  analysisType: string;
  inputSummary?: string;
  result: string;
  confidence: number;
  model: string;
  source: string;
  tokensUsed: number;
}): Promise<void> {
  await sql.prepare(`
    REPLACE INTO ai_analysis
    (id, project_key, item_key, analysis_type, input_summary, result, confidence, model, source, tokens_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).bindParams(
    analysis.id,
    analysis.projectKey,
    analysis.itemKey,
    analysis.analysisType,
    analysis.inputSummary || null,
    analysis.result,
    analysis.confidence,
    analysis.model,
    analysis.source,
    analysis.tokensUsed
  ).execute();
}
