// ============================================================
// FILE: jira-resolver.ts
// PATH: src/resolvers/jira-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira project dashboard
// ============================================================

import Resolver from '@forge/resolver';
import { getLatestProjectScore, getProjectFindings, getProjectScoreHistory, getAllProjectScores } from '../db/queries';
import { initializeDatabase } from '../db/schema';

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
  const { Queue } = await import('@forge/events');
  const { generateId } = await import('../utils/helpers');
  const queue = new Queue({ key: 'quality-checks' });
  const projectKey = context?.extension?.project?.key || payload?.projectKey;

  if (!projectKey) return { error: 'No project context' };

  const scanId = generateId('scan');
  await queue.push({
    body: { scanId, projectKey, scanType: 'manual' }
  });

  return { scanId, message: `Scan queued for ${projectKey}` };
});

export const handler = resolver.getDefinitions();
