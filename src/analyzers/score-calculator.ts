// ============================================================
// FILE: score-calculator.ts
// PATH: src/analyzers/score-calculator.ts
// PROJECT: DataQualityGuard
// PURPOSE: Calculates weighted quality scores from findings
// ============================================================

import { Finding, ProjectScore } from '../scanner/types';

// Weights for score categories (must sum to 1.0)
const WEIGHTS = {
  staleness: 0.30,
  completeness: 0.30,
  consistency: 0.20,
  cross_reference: 0.20,
};

function getScoreGroup(checkType: string): string {
  if (checkType === 'staleness' || checkType === 'stale_documentation') return 'staleness';
  if (checkType === 'completeness' || checkType === 'sprint_readiness' || checkType === 'lost_knowledge') return 'completeness';
  if (checkType === 'cross_reference') return 'cross_reference';
  return 'consistency'; // consistency, ai_contradiction, and anything else
}

export function calculateProjectScore(
  findings: Finding[],
  projectKey: string,
  totalIssues: number
): ProjectScore {
  // Group findings by check type
  const grouped: Record<string, Finding[]> = {
    staleness: [],
    completeness: [],
    consistency: [],
    cross_reference: [],
  };

  for (const f of findings) {
    const group = getScoreGroup(f.checkType);
    grouped[group].push(f);
  }

  // Calculate sub-scores
  // Score = 100 - penalty
  // Penalty is based on number and severity of findings relative to total items
  const stalenessScore = calculateSubScore(grouped.staleness, totalIssues);
  const completenessScore = calculateSubScore(grouped.completeness, totalIssues);
  const consistencyScore = calculateSubScore(grouped.consistency, totalIssues);
  const crossRefScore = calculateSubScore(grouped.cross_reference, totalIssues);

  // Weighted overall score
  const overallScore = Math.round(
    stalenessScore * WEIGHTS.staleness +
    completenessScore * WEIGHTS.completeness +
    consistencyScore * WEIGHTS.consistency +
    crossRefScore * WEIGHTS.cross_reference
  );

  return {
    projectKey,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    stalenessScore: Math.round(stalenessScore),
    completenessScore: Math.round(completenessScore),
    consistencyScore: Math.round(consistencyScore),
    crossRefScore: Math.round(crossRefScore),
    totalIssues,
    findingsCount: findings.length,
  };
}

function calculateSubScore(findings: Finding[], totalItems: number): number {
  if (totalItems === 0 || findings.length === 0) return 100;

  // Severity weights for penalty calculation
  const severityPenalty: Record<string, number> = {
    critical: 5.0,
    high: 3.0,
    medium: 1.5,
    low: 0.5,
    info: 0.1,
  };

  let totalPenalty = 0;
  for (const f of findings) {
    totalPenalty += severityPenalty[f.severity] || 1.0;
  }

  // Normalize penalty relative to total items
  // Max penalty per item is 5 (critical), so max total = totalItems * 5
  const maxPenalty = totalItems * 1.2; // Stricter scoring — 5 critical at 100 issues should hurt
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
