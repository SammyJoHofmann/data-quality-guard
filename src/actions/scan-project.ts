// ============================================================
// FILE: scan-project.ts
// PATH: src/actions/scan-project.ts
// PROJECT: DataQualityGuard
// PURPOSE: Rovo Agent action — triggers a project scan
// ============================================================

import { initializeDatabase } from '../db/schema';
import { runProjectScan } from '../scanner/run-scan';

export const handler = async ({ payload, context }: any) => {
  await initializeDatabase();
  const projectKey = payload?.projectKey;
  if (!projectKey || typeof projectKey !== 'string') {
    return 'Bitte gib einen Projekt-Key an (z.B. "KAN").';
  }

  const key = projectKey.toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return `Ungültiger Projekt-Key: "${projectKey}". Format: 2-10 Großbuchstaben/Zahlen.`;
  }

  try {
    const score = await runProjectScan(key);
    return `Scan abgeschlossen für Projekt ${key}:
- Gesamtnote: ${score.overallScore}/100
- Aktualität: ${score.stalenessScore}
- Vollständigkeit: ${score.completenessScore}
- Konsistenz: ${score.consistencyScore}
- Querverweise: ${score.crossRefScore}
- Gefundene Probleme: ${score.findingsCount}
- Gescannte Tickets: ${score.totalIssues}`;
  } catch (err: any) {
    console.error('[RovoAgent] Scan failed:', err);
    return `Scan für ${key} fehlgeschlagen. Bitte versuche es erneut.`;
  }
};
