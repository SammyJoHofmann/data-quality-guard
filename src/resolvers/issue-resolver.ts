// ============================================================
// FILE: issue-resolver.ts
// PATH: src/resolvers/issue-resolver.ts
// PROJECT: DataQualityGuard
// PURPOSE: Resolver for Jira issue panel
// ============================================================

import Resolver from '@forge/resolver';
import { getIssueFindings } from '../db/queries';
import { initializeDatabase } from '../db/schema';

const resolver = new Resolver();

resolver.define('getIssueQuality', async ({ context }: any) => {
  await initializeDatabase();
  const issueKey = context?.extension?.issue?.key;
  if (!issueKey) return { findings: [], score: 100 };

  const rawFindings = await getIssueFindings(issueKey);

  // Sanitize all DB values to primitive types (Forge SQL returns Decimal objects)
  const findings = (rawFindings || []).map((f: any) => ({
    id: String(f.id || ''),
    item_type: String(f.item_type || ''),
    item_key: String(f.item_key || ''),
    project_key: String(f.project_key || ''),
    check_type: String(f.check_type || ''),
    score: Number(f.score) || 0,
    severity: String(f.severity || 'info'),
    message: String(f.message || ''),
    details: f.details ? String(f.details) : null,
    scanned_at: String(f.scanned_at || ''),
  }));

  // Calculate issue-level score
  let score = 100;
  for (const f of findings) {
    const sev = String(f.severity);
    const penalty = sev === 'critical' ? 30 : sev === 'high' ? 20 : sev === 'medium' ? 10 : 5;
    score -= penalty;
  }
  score = Math.max(0, score);

  return { findings, score };
});

export const handler = resolver.getDefinitions();
