// ============================================================
// FILE: get-report.ts
// PATH: src/actions/get-report.ts
// PROJECT: DataQualityGuard
// PURPOSE: Rovo Agent action — gets quality report for a project
// ============================================================

import { initializeDatabase } from '../db/schema';
import { getLatestProjectScore, getProjectFindings } from '../db/queries';

export const handler = async ({ payload, context }: any) => {
  await initializeDatabase();
  const projectKey = payload?.projectKey;
  if (!projectKey || typeof projectKey !== 'string') {
    return 'Bitte gib einen Projekt-Key an (z.B. "KAN").';
  }

  const key = projectKey.toUpperCase().trim();

  try {
    const score = await getLatestProjectScore(key);
    if (!score) {
      return `Keine Daten für Projekt ${key}. Bitte zuerst einen Scan starten.`;
    }

    const findings = await getProjectFindings(key, 10);
    const topFindings = findings.slice(0, 5).map((f: any, i: number) =>
      `${i + 1}. [${String(f.severity).toUpperCase()}] ${String(f.item_key)}: ${String(f.message)}`
    ).join('\n');

    const grade = Number(score.overall_score) >= 90 ? 'A' : Number(score.overall_score) >= 75 ? 'B' : Number(score.overall_score) >= 60 ? 'C' : Number(score.overall_score) >= 40 ? 'D' : 'F';

    return `Qualitätsbericht für Projekt ${key}:

Note: ${grade} (${Math.round(Number(score.overall_score))}/100)
- Aktualität: ${Math.round(Number(score.staleness_score))}
- Vollständigkeit: ${Math.round(Number(score.completeness_score))}
- Konsistenz: ${Math.round(Number(score.consistency_score))}
- Querverweise: ${Math.round(Number(score.cross_ref_score))}
- Probleme: ${Number(score.findings_count)}
- Letzter Scan: ${String(score.calculated_at)}

Top-5 Probleme:
${topFindings || 'Keine Probleme gefunden.'}`;
  } catch (err: any) {
    console.error('[RovoAgent] Report failed:', err);
    return `Bericht für ${key} konnte nicht geladen werden.`;
  }
};
