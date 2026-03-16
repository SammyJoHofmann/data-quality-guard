// ============================================================
// FILE: score-calculator.ts
// PATH: src/analyzers/score-calculator.ts
// PROJECT: DataQualityGuard
// PURPOSE: Calculates weighted quality scores from findings
// ============================================================

import { Finding, ProjectScore } from '../scanner/types';

export function calculateProjectScore(
  findings: Finding[],
  projectKey: string,
  totalItems: number,
  hasConfluence = false
): ProjectScore {
  // Dynamic weights based on available data
  const weights = hasConfluence
    ? { staleness: 0.30, completeness: 0.30, consistency: 0.20, cross_reference: 0.20 }
    : { staleness: 0.45, completeness: 0.45, consistency: 0.10, cross_reference: 0.00 };

  // Group findings by check type
  const grouped: Record<string, Finding[]> = {
    staleness: [],
    completeness: [],
    consistency: [],
    cross_reference: [],
  };

  for (const f of findings) {
    const key = f.checkType in grouped ? f.checkType : 'consistency';
    grouped[key].push(f);
  }

  const stalenessScore = calculateSubScore(grouped.staleness, totalItems);
  const completenessScore = calculateSubScore(grouped.completeness, totalItems);
  const consistencyScore = calculateSubScore(grouped.consistency, totalItems);
  const crossRefScore = calculateSubScore(grouped.cross_reference, totalItems);

  const overallScore = Math.round(
    stalenessScore * weights.staleness +
    completenessScore * weights.completeness +
    consistencyScore * weights.consistency +
    crossRefScore * weights.cross_reference
  );

  return {
    projectKey,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    stalenessScore: Math.round(stalenessScore),
    completenessScore: Math.round(completenessScore),
    consistencyScore: Math.round(consistencyScore),
    crossRefScore: Math.round(crossRefScore),
    totalIssues: totalItems,
    findingsCount: findings.length,
  };
}

function calculateSubScore(findings: Finding[], totalItems: number): number {
  if (totalItems === 0 || findings.length === 0) return 100;

  const severityPenalty: Record<string, number> = {
    critical: 5.0, high: 3.0, medium: 1.5, low: 0.5, info: 0.1,
  };

  let totalPenalty = 0;
  for (const f of findings) {
    totalPenalty += severityPenalty[f.severity] || 1.0;
  }

  const maxPenalty = totalItems * 2;
  const normalizedPenalty = Math.min(totalPenalty / maxPenalty, 1.0);
  return 100 * (1 - normalizedPenalty);
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

export function getTrendArrow(current: number, previous: number): string {
  const diff = current - previous;
  if (diff > 5) return '↑';
  if (diff < -5) return '↓';
  return '→';
}
