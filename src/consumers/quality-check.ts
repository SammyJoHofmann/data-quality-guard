// ============================================================
// FILE: quality-check.ts
// PATH: src/consumers/quality-check.ts
// PROJECT: DataQualityGuard
// PURPOSE: Async event consumer that performs quality checks per project
// ============================================================

import { runProjectScan } from '../scanner/run-scan';
import { initializeDatabase } from '../db/schema';

export async function handler(event: any): Promise<void> {
  const { projectKey } = event;
  console.log(`[QualityCheck] Processing ${projectKey}`);

  await initializeDatabase();

  try {
    const score = await runProjectScan(projectKey);
    console.log(`[QualityCheck] ${projectKey}: Score = ${score.overallScore}/100`);
  } catch (err) {
    console.error(`[QualityCheck] Error scanning ${projectKey}:`, err);
  }
}
