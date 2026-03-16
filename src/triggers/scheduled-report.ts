// ============================================================
// FILE: scheduled-report.ts
// PATH: src/triggers/scheduled-report.ts
// PROJECT: DataQualityGuard
// PURPOSE: Daily report generation trigger
// ============================================================

import { getAllProjectScores } from '../db/queries';
import { initializeDatabase } from '../db/schema';

export async function handler(): Promise<void> {
  console.log('[ScheduledReport] Generating daily quality report...');

  await initializeDatabase();

  const scores = await getAllProjectScores();
  const criticalProjects = scores.filter((s: any) => Number(s.overall_score) < 40);
  const totalFindings = scores.reduce((sum: number, s: any) => sum + Number(s.findings_count || 0), 0);

  console.log(`[ScheduledReport] Summary: ${scores.length} projects, ${totalFindings} total findings, ${criticalProjects.length} critical`);

  for (const p of criticalProjects) {
    console.log(`[ScheduledReport] CRITICAL: ${p.project_key} score=${p.overall_score} findings=${p.findings_count}`);
  }
}
