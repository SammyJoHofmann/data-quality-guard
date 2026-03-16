// ============================================================
// FILE: scan-project.ts
// PATH: src/actions/scan-project.ts
// PROJECT: DataQualityGuard
// PURPOSE: Rovo Agent action — triggers a project scan
// ============================================================

import { Queue } from '@forge/events';
import { initializeDatabase } from '../db/schema';
import { generateId } from '../utils/helpers';

const queue = new Queue({ key: 'quality-checks' });

export async function handler(payload: any): Promise<string> {
  const { projectKey } = payload;

  if (!projectKey) {
    return 'Please provide a project key (e.g., PROJ).';
  }

  await initializeDatabase();

  const scanId = generateId('scan');
  await queue.push({
    body: {
      scanId,
      projectKey: projectKey.toUpperCase(),
      scanType: 'manual'
    }
  });

  return `Scan started for project ${projectKey.toUpperCase()} (ID: ${scanId}). Results will be available in a few minutes on the project dashboard.`;
}
