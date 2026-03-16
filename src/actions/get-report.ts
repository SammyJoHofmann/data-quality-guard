// ============================================================
// FILE: get-report.ts
// PATH: src/actions/get-report.ts
// PROJECT: DataQualityGuard
// PURPOSE: Rovo Agent action — retrieves quality report
// ============================================================

import { getLatestProjectScore, getProjectFindings } from '../db/queries';
import { getScoreLabel } from '../analyzers/score-calculator';
import { initializeDatabase } from '../db/schema';

export async function handler(payload: any): Promise<string> {
  const { projectKey } = payload;

  if (!projectKey) {
    return 'Please provide a project key (e.g., PROJ).';
  }

  await initializeDatabase();

  const score = await getLatestProjectScore(projectKey.toUpperCase());
  if (!score) {
    return `No quality data found for project ${projectKey}. Run a scan first using the "Scan project" action.`;
  }

  const findings = await getProjectFindings(projectKey.toUpperCase(), 10);

  let report = `## Data Quality Report: ${projectKey.toUpperCase()}\n\n`;
  report += `**Overall Score: ${score.overall_score}/100** (${getScoreLabel(score.overall_score)})\n\n`;
  report += `| Category | Score |\n`;
  report += `|----------|-------|\n`;
  report += `| Staleness | ${score.staleness_score}/100 |\n`;
  report += `| Completeness | ${score.completeness_score}/100 |\n`;
  report += `| Consistency | ${score.consistency_score}/100 |\n`;
  report += `| Cross-References | ${score.cross_ref_score}/100 |\n\n`;
  report += `**Total Items:** ${score.total_issues} | **Findings:** ${score.findings_count}\n\n`;

  if (findings.length > 0) {
    report += `### Top Issues\n\n`;
    for (const f of findings) {
      const icon = f.severity === 'critical' ? '!!!' : f.severity === 'high' ? '!!' : '!';
      report += `- [${icon}] **${f.item_key}**: ${f.message}\n`;
    }
  }

  return report;
}
