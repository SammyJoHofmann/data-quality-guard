// ============================================================
// FILE: scheduled-scan.ts
// PATH: src/triggers/scheduled-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Scheduled trigger that runs hourly scans
// ============================================================

import { Queue } from '@forge/events';
import { getAllProjects } from '../scanner/jira-scanner';
import { initializeDatabase } from '../db/schema';
import { generateId } from '../utils/helpers';

const queue = new Queue({ key: 'quality-checks' });

export async function handler(): Promise<void> {
  console.log('[ScheduledScan] Starting hourly scan...');

  // Ensure DB schema exists
  await initializeDatabase();

  // Get all Jira projects
  const projects = await getAllProjects();
  console.log(`[ScheduledScan] Found ${projects.length} projects`);

  // Queue scan jobs for each project
  const events = projects.slice(0, 20).map(project => ({
    body: {
      scanId: generateId('scan'),
      projectKey: project.key,
      projectName: project.name,
      scanType: 'incremental'
    }
  }));

  if (events.length > 0) {
    await queue.push(events);
    console.log(`[ScheduledScan] Queued ${events.length} project scans`);
  }
}
