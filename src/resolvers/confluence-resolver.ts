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

resolver.define('getDashboardData', async () => {
  await initializeDatabase();
  const scores = await getAllProjectScores();
  return { scores };
});

resolver.define('getProjectDetails', async ({ payload }: any) => {
  await initializeDatabase();
  const { projectKey } = payload;
  const findings = await getProjectFindings(projectKey, 30);
  return { findings };
});

export const handler = resolver.getDefinitions();
