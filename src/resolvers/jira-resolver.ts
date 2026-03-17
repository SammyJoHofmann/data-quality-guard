// ============================================================
// FILE: jira-resolver.ts
// PATH: src/resolvers/jira-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira project dashboard
// ============================================================

import Resolver from '@forge/resolver';
import { getLatestProjectScore, getProjectFindings, getProjectScoreHistory, getAllProjectScores, getProjectContradictions, getConfig, setConfig, getApiKey, setApiKey, logAudit } from '../db/queries';
import { initializeDatabase } from '../db/schema';
import { runProjectScan } from '../scanner/run-scan';
import { invalidateLLMCache } from '../ai/llm-client';

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
  if (!projectKey) {
    console.error('[Resolver] getProjectScore: No project context');
    return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
  }

  const rawScore = await getLatestProjectScore(projectKey);
  const rawFindings = await getProjectFindings(projectKey, 100);
  const rawHistory = await getProjectScoreHistory(projectKey, 14);

  let contradictions: any[] = [];
  try { contradictions = await getProjectContradictions(projectKey); } catch (err) { console.error('[Resolver] Contradictions query failed:', err); }

  const aiEnabled = await getConfig('ai_enabled', 'false');
  const hasApiKey = (await getApiKey()).length > 0;

  return {
    score: sanitizeScore(rawScore),
    findings: sanitizeFindings(rawFindings),
    history: (rawHistory || []).map(sanitizeHistoryEntry),
    contradictions: (contradictions || []).map((c: any) => ({
      id: String(c?.id || ''),
      source_key: String(c?.source_key || ''),
      target_key: String(c?.target_key || ''),
      contradiction_type: String(c?.contradiction_type || ''),
      confidence: Number(c?.confidence) || 0,
      description: String(c?.description || ''),
      recommendation: String(c?.recommendation || ''),
      page_title: String(c?.page_title || ''),
    })),
    severityCounts: {
      critical: rawFindings.filter(f => f.severity === 'critical').length,
      high: rawFindings.filter(f => f.severity === 'high').length,
      medium: rawFindings.filter(f => f.severity === 'medium').length,
      low: rawFindings.filter(f => f.severity === 'low').length,
    },
    aiStatus: { enabled: aiEnabled === 'true', configured: hasApiKey },
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
  if (!projectKey) {
    console.error('[Resolver] triggerScan: No project context');
    return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
  }

  // Rate-limit: max 1 scan per 5 minutes per project
  const lastScanKey = `last_scan_${projectKey}`;
  const lastScan = await getConfig(lastScanKey, '0');
  const elapsed = Date.now() - Number(lastScan);
  if (elapsed < 300000) {
    const remaining = Math.ceil((300000 - elapsed) / 60000);
    return { error: `Bitte ${remaining} Minute(n) warten. Scans sind auf einmal pro 5 Minuten begrenzt.` };
  }
  await setConfig(lastScanKey, String(Date.now()));

  const actorId = context?.accountId || 'unknown';
  await logAudit('scan_triggered', actorId, projectKey, null);

  try {
    const result = await runProjectScan(projectKey);
    return { message: `Scan complete for ${projectKey}`, score: result.overallScore, findings: result.findingsCount };
  } catch (err: any) {
    console.error('[triggerScan] Error:', err);
    return { error: 'Scan fehlgeschlagen. Bitte versuche es erneut.' };
  }
});

resolver.define('getSettings', async () => {
  await initializeDatabase();
  const aiEnabled = await getConfig('ai_enabled', 'false');
  const rawKey = await getApiKey();
  const hasKey = rawKey.length > 0;
  const provider = await getConfig('ai_provider', 'gemini');
  const maskedKey = hasKey ? '***' + rawKey.slice(-4) : '';
  return {
    aiEnabled: aiEnabled === 'true',
    hasKey,
    apiKey: maskedKey,
    provider: String(provider),
  };
});

resolver.define('saveSettings', async ({ payload, context }: any) => {
  await initializeDatabase();
  const validProviders = ['claude', 'gemini', 'openai'];

  // Input validation
  if (payload?.aiEnabled !== undefined) {
    if (typeof payload.aiEnabled !== 'boolean') {
      console.error('[Resolver] saveSettings: aiEnabled is not a boolean');
      return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
    }
    await setConfig('ai_enabled', payload.aiEnabled ? 'true' : 'false');
  }
  if (payload?.apiKey !== undefined && payload.apiKey.length > 0 && !payload.apiKey.startsWith('***')) {
    const key = String(payload.apiKey);
    if (key.length > 200) {
      console.error('[Resolver] saveSettings: apiKey exceeds 200 characters');
      return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
    }
    await setApiKey(key);
  }
  if (payload?.provider !== undefined) {
    if (!validProviders.includes(payload.provider)) {
      console.error('[Resolver] saveSettings: invalid provider', payload.provider);
      return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
    }
    await setConfig('ai_provider', String(payload.provider));
  }
  invalidateLLMCache();
  const actorId = context?.accountId || 'unknown';
  await logAudit('settings_changed', actorId, null, `provider=${payload.provider || 'unknown'}, ai=${payload.aiEnabled}`);
  return { success: true };
});

resolver.define('deleteApiKey', async ({ context }: any) => {
  await initializeDatabase();
  await setApiKey('');
  await setConfig('ai_enabled', 'false');
  invalidateLLMCache();
  await logAudit('api_key_deleted', context?.accountId || 'unknown', null, null);
  return { success: true };
});

resolver.define('dismissFinding', async ({ payload, context }: any) => {
  await initializeDatabase();
  const findingId = payload?.findingId;
  if (!findingId) {
    console.error('[Resolver] dismissFinding: No findingId provided');
    return { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' };
  }
  const { dismissFinding } = await import('../db/queries');
  await dismissFinding(String(findingId));
  await logAudit('finding_dismissed', context?.accountId || 'unknown', null, `findingId=${findingId}`);
  return { success: true };
});

resolver.define('getThresholds', async () => {
  await initializeDatabase();
  return {
    staleWarningDays: Number(await getConfig('threshold_stale_warning', '30')),
    staleCriticalDays: Number(await getConfig('threshold_stale_critical', '90')),
    inProgressWarningDays: Number(await getConfig('threshold_inprogress_warning', '14')),
    inProgressCriticalDays: Number(await getConfig('threshold_inprogress_critical', '60')),
  };
});

resolver.define('saveThresholds', async ({ payload }: any) => {
  await initializeDatabase();
  const sw = Number(payload?.staleWarningDays);
  const sc = Number(payload?.staleCriticalDays);
  const iw = Number(payload?.inProgressWarningDays);
  const ic = Number(payload?.inProgressCriticalDays);

  // Validate: warning must be less than critical
  if (sw && sc && sw >= sc) return { error: 'Veraltet-Warnung muss kleiner sein als Veraltet-Kritisch.' };
  if (iw && ic && iw >= ic) return { error: 'In-Progress-Warnung muss kleiner sein als In-Progress-Kritisch.' };

  if (sw) await setConfig('threshold_stale_warning', String(Math.min(Math.max(1, sw), 365)));
  if (sc) await setConfig('threshold_stale_critical', String(Math.min(Math.max(1, sc), 365)));
  if (iw) await setConfig('threshold_inprogress_warning', String(Math.min(Math.max(1, iw), 365)));
  if (ic) await setConfig('threshold_inprogress_critical', String(Math.min(Math.max(1, ic), 365)));
  return { success: true };
});

export const handler = resolver.getDefinitions();
