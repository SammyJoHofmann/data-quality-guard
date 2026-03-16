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

export const handler = resolver.getDefinitions();
