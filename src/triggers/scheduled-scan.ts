// ============================================================
// FILE: scheduled-scan.ts
// PATH: src/triggers/scheduled-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scheduled trigger that runs hourly scans
// ============================================================

import { runProjectScan } from '../scanner/run-scan';
import { initializeDatabase } from '../db/schema';
import { getScannedProjectKeys } from '../db/queries';

export async function handler(): Promise<void> {
  console.log('[ScheduledScan] Starting hourly scan...');

  await initializeDatabase();

  const projectKeys = await getScannedProjectKeys();
  console.log(`[ScheduledScan] Found ${projectKeys.length} previously scanned projects`);

  if (projectKeys.length === 0) {
    console.log('[ScheduledScan] No projects have been scanned yet. Skipping.');
    return;
  }

  for (const projectKey of projectKeys.slice(0, 10)) {
    try {
      const score = await runProjectScan(projectKey);
      console.log(`[ScheduledScan] ${projectKey}: ${score.overallScore}/100`);
    } catch (err) {
      console.error(`[ScheduledScan] Error scanning ${projectKey}:`, err);
    }
  }

  console.log('[ScheduledScan] Hourly scan complete');
}
