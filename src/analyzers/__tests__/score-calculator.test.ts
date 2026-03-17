// ============================================================
// FILE: score-calculator.test.ts
// PATH: src/analyzers/__tests__/score-calculator.test.ts
// PROJECT: DataQualityGuard
// PURPOSE: Unit tests for score calculator module
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateProjectScore, getScoreColor, getScoreLabel, getTrendArrow } from '../score-calculator';
import { Finding } from '../../scanner/types';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-1',
    itemType: 'jira_issue',
    itemKey: 'TEST-1',
    projectKey: 'TEST',
    checkType: 'staleness',
    score: 10,
    severity: 'medium',
    message: 'Test finding',
    ...overrides,
  };
}

describe('calculateProjectScore', () => {
  it('returns 100 when no findings exist', () => {
    const score = calculateProjectScore([], 'TEST', 10);
    expect(score.overallScore).toBe(100);
    expect(score.findingsCount).toBe(0);
    expect(score.projectKey).toBe('TEST');
    expect(score.totalIssues).toBe(10);
  });

  it('returns 100 when totalIssues is 0 and no findings', () => {
    const score = calculateProjectScore([], 'TEST', 0);
    expect(score.overallScore).toBe(100);
  });

  it('reduces score for critical findings', () => {
    const findings: Finding[] = [
      makeFinding({ id: '1', severity: 'critical', itemKey: 'T-1' }),
      makeFinding({ id: '2', severity: 'critical', itemKey: 'T-2' }),
    ];
    const score = calculateProjectScore(findings, 'TEST', 10);
    expect(score.overallScore).toBeLessThan(100);
    expect(score.findingsCount).toBe(2);
  });

  it('critical findings reduce score more than low findings', () => {
    const criticalFindings: Finding[] = [
      makeFinding({ id: '1', severity: 'critical' }),
    ];
    const lowFindings: Finding[] = [
      makeFinding({ id: '2', severity: 'low' }),
    ];
    const criticalScore = calculateProjectScore(criticalFindings, 'TEST', 10);
    const lowScore = calculateProjectScore(lowFindings, 'TEST', 10);
    expect(criticalScore.overallScore).toBeLessThan(lowScore.overallScore);
  });

  it('clamps score between 0 and 100', () => {
    const manyFindings: Finding[] = Array.from({ length: 50 }, (_, i) =>
      makeFinding({ id: String(i), severity: 'critical', itemKey: `T-${i}` })
    );
    const score = calculateProjectScore(manyFindings, 'TEST', 5);
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
  });

  it('groups findings by checkType into correct sub-scores', () => {
    const findings: Finding[] = [
      makeFinding({ id: '1', checkType: 'completeness', severity: 'high' }),
      makeFinding({ id: '2', checkType: 'staleness', severity: 'high' }),
    ];
    const score = calculateProjectScore(findings, 'TEST', 10);
    // Both sub-scores should be reduced, while consistency and crossRef stay at 100
    expect(score.completenessScore).toBeLessThan(100);
    expect(score.stalenessScore).toBeLessThan(100);
    expect(score.consistencyScore).toBe(100);
    expect(score.crossRefScore).toBe(100);
  });

  it('routes unknown checkType to consistency bucket', () => {
    const findings: Finding[] = [
      makeFinding({ id: '1', checkType: 'unknown_type', severity: 'high' }),
    ];
    const score = calculateProjectScore(findings, 'TEST', 10);
    expect(score.consistencyScore).toBeLessThan(100);
    expect(score.stalenessScore).toBe(100);
  });

  it('returns rounded sub-scores', () => {
    const findings: Finding[] = [
      makeFinding({ id: '1', checkType: 'staleness', severity: 'medium' }),
    ];
    const score = calculateProjectScore(findings, 'TEST', 7);
    expect(Number.isInteger(score.stalenessScore)).toBe(true);
    expect(Number.isInteger(score.overallScore)).toBe(true);
  });
});

describe('getScoreColor', () => {
  it('returns green for scores >= 80', () => {
    expect(getScoreColor(80)).toBe('green');
    expect(getScoreColor(100)).toBe('green');
    expect(getScoreColor(85)).toBe('green');
  });

  it('returns yellow for scores 60-79', () => {
    expect(getScoreColor(60)).toBe('yellow');
    expect(getScoreColor(79)).toBe('yellow');
  });

  it('returns orange for scores 40-59', () => {
    expect(getScoreColor(40)).toBe('orange');
    expect(getScoreColor(59)).toBe('orange');
  });

  it('returns red for scores < 40', () => {
    expect(getScoreColor(39)).toBe('red');
    expect(getScoreColor(0)).toBe('red');
    expect(getScoreColor(30)).toBe('red');
  });
});

describe('getScoreLabel', () => {
  it('returns Excellent for scores >= 90', () => {
    expect(getScoreLabel(90)).toBe('Excellent');
    expect(getScoreLabel(95)).toBe('Excellent');
    expect(getScoreLabel(100)).toBe('Excellent');
  });

  it('returns Good for scores 80-89', () => {
    expect(getScoreLabel(80)).toBe('Good');
    expect(getScoreLabel(89)).toBe('Good');
  });

  it('returns Fair for scores 60-79', () => {
    expect(getScoreLabel(60)).toBe('Fair');
    expect(getScoreLabel(79)).toBe('Fair');
  });

  it('returns Poor for scores 40-59', () => {
    expect(getScoreLabel(40)).toBe('Poor');
    expect(getScoreLabel(59)).toBe('Poor');
  });

  it('returns Critical for scores < 40', () => {
    expect(getScoreLabel(39)).toBe('Critical');
    expect(getScoreLabel(0)).toBe('Critical');
    expect(getScoreLabel(20)).toBe('Critical');
  });
});

describe('getTrendArrow', () => {
  it('returns up arrow for improvement > 5 points', () => {
    expect(getTrendArrow(80, 70)).toBe('↑');
    expect(getTrendArrow(100, 50)).toBe('↑');
  });

  it('returns down arrow for decline > 5 points', () => {
    expect(getTrendArrow(60, 80)).toBe('↓');
    expect(getTrendArrow(10, 90)).toBe('↓');
  });

  it('returns right arrow for stable (within 5 points)', () => {
    expect(getTrendArrow(70, 72)).toBe('→');
    expect(getTrendArrow(75, 70)).toBe('→');
    expect(getTrendArrow(50, 50)).toBe('→');
  });

  it('treats exactly 5 point difference as stable', () => {
    expect(getTrendArrow(75, 70)).toBe('→');
    expect(getTrendArrow(70, 75)).toBe('→');
  });
});
