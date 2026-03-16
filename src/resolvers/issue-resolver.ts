// ============================================================
// FILE: issue-resolver.ts
// PATH: src/resolvers/issue-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira issue panel
// ============================================================

import Resolver from '@forge/resolver';
import { getIssueFindings } from '../db/queries';
import { initializeDatabase } from '../db/schema';

const resolver = new Resolver();

resolver.define('getIssueQuality', async ({ context }: any) => {
  await initializeDatabase();
  const issueKey = context?.extension?.issue?.key;
  if (!issueKey) return { findings: [], score: 100 };

  const findings = await getIssueFindings(issueKey);

  // Calculate issue-level score
  let score = 100;
  for (const f of findings) {
    const penalty = f.severity === 'critical' ? 30 : f.severity === 'high' ? 20 : f.severity === 'medium' ? 10 : 5;
    score -= penalty;
  }
  score = Math.max(0, score);

  return { findings, score };
});

export const handler = resolver.getDefinitions();
