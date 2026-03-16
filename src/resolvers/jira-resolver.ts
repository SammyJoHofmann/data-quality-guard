// ============================================================
// FILE: jira-resolver.ts
// PATH: src/resolvers/jira-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira project dashboard
// ============================================================

import Resolver from '@forge/resolver';
import { getLatestProjectScore, getProjectFindings, getProjectScoreHistory, getAllProjectScores, getConfig, setConfig } from '../db/queries';
import { initializeDatabase } from '../db/schema';
import { runProjectScan } from '../scanner/run-scan';

const resolver = new Resolver();

resolver.define('getProjectScore', async ({ payload, context }: any) => {
  await initializeDatabase();
  const projectKey = context?.extension?.project?.key || payload?.projectKey;
  if (!projectKey) return { error: 'No project context' };

  const score = await getLatestProjectScore(projectKey);
  const findings = await getProjectFindings(projectKey, 20);
  const history = await getProjectScoreHistory(projectKey, 14);

  return { score, findings, history };
});

resolver.define('getAllScores', async () => {
  await initializeDatabase();
  const scores = await getAllProjectScores();
  return { scores };
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

// === ADMIN SETTINGS ===

const CONFIG_KEYS_WHITELIST = new Set([
  'overload_threshold',
  'staleness_warning_days',
  'staleness_critical_days',
  'page_staleness_warning_days',
  'page_staleness_critical_days',
  'in_progress_warning_days',
  'in_progress_critical_days',
  'anthropic_api_key',
]);

resolver.define('getConfig', async ({ payload }: any) => {
  await initializeDatabase();

  if (payload?.key) {
    if (!CONFIG_KEYS_WHITELIST.has(payload.key)) {
      return { error: `Unknown config key: ${payload.key}` };
    }
    // Mask API keys in response
    const value = await getConfig(payload.key, '');
    const masked = payload.key.includes('api_key') && value
      ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
      : value;
    return { key: payload.key, value: masked };
  }

  // Return all configurable settings with current values
  const settings: Record<string, string> = {};
  for (const key of CONFIG_KEYS_WHITELIST) {
    const val = await getConfig(key, '');
    settings[key] = key.includes('api_key') && val
      ? val.substring(0, 8) + '...' + val.substring(val.length - 4)
      : val;
  }
  return { settings };
});

resolver.define('setConfig', async ({ payload }: any) => {
  await initializeDatabase();
  const { key, value } = payload || {};

  if (!key || value === undefined) {
    return { error: 'Missing key or value' };
  }
  if (!CONFIG_KEYS_WHITELIST.has(key)) {
    return { error: `Unknown config key: ${key}` };
  }

  // Validate numeric thresholds
  if (key.includes('threshold') || key.includes('days')) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 365) {
      return { error: `Value must be a number between 1 and 365` };
    }
  }

  await setConfig(key, String(value));
  return { success: true, key, message: `Config "${key}" updated` };
});

export const handler = resolver.getDefinitions();
