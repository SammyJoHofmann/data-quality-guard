// ============================================================
// FILE: scheduled-scan.ts
// PATH: src/triggers/scheduled-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scheduled trigger that runs hourly scans
// ============================================================

import { getAllProjects } from '../scanner/jira-scanner';
import { runProjectScan } from '../scanner/run-scan';
import { initializeDatabase } from '../db/schema';

export async function handler(): Promise<void> {
  console.log('[ScheduledScan] Starting hourly scan...');

  await initializeDatabase();

  const projects = await getAllProjects();
  console.log(`[ScheduledScan] Found ${projects.length} projects`);

  for (const project of projects.slice(0, 10)) {
    try {
      const score = await runProjectScan(project.key);
      console.log(`[ScheduledScan] ${project.key}: ${score.overallScore}/100`);
    } catch (err) {
      console.error(`[ScheduledScan] Error scanning ${project.key}:`, err);
    }
  }

  console.log('[ScheduledScan] Hourly scan complete');
}
