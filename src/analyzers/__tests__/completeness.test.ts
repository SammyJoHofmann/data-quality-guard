// ============================================================
// FILE: completeness.test.ts
// PATH: src/analyzers/__tests__/completeness.test.ts
// PROJECT: DataQualityGuard
// PURPOSE: Unit tests for completeness analyzer
// ============================================================

import { describe, it, expect } from 'vitest';
import { analyzeCompleteness } from '../completeness';
import { JiraIssue } from '../../scanner/types';

function makeIssue(overrides: Partial<JiraIssue['fields']> = {}): JiraIssue {
  return {
    key: 'TEST-1',
    id: '1',
    fields: {
      summary: 'Test issue with proper summary',
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A proper description with enough content to pass the 20 char minimum' }] }],
      } as unknown as string,
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: { displayName: 'Test User', accountId: 'user-123' },
      reporter: { displayName: 'Reporter', accountId: 'rep-123' },
      priority: { name: 'Medium' },
      labels: ['feature'],
      components: [{ name: 'Backend' }],
      issuetype: { name: 'Task' },
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-01T00:00:00.000Z',
      resolution: null,
      project: { key: 'TEST', name: 'Test Project' },
      ...overrides,
    },
  };
}

describe('analyzeCompleteness', () => {
  it('returns no findings for a complete issue', () => {
    const findings = analyzeCompleteness([makeIssue()], 'TEST');
    expect(findings.length).toBe(0);
  });

  it('returns empty array for empty issues list', () => {
    const findings = analyzeCompleteness([], 'TEST');
    expect(findings).toEqual([]);
  });

  // --- Description checks ---

  it('detects missing description (null)', () => {
    const findings = analyzeCompleteness([makeIssue({ description: null })], 'TEST');
    expect(findings.some(f => f.message.includes('Beschreibung'))).toBe(true);
    expect(findings.some(f => f.checkType === 'completeness')).toBe(true);
  });

  it('detects too-short description', () => {
    const findings = analyzeCompleteness([makeIssue({ description: 'short' })], 'TEST');
    expect(findings.some(f => f.message.includes('Beschreibung'))).toBe(true);
  });

  it('marks missing description as high severity for open issues', () => {
    const findings = analyzeCompleteness([makeIssue({ description: null })], 'TEST');
    const descFinding = findings.find(f => f.message.includes('Beschreibung'));
    expect(descFinding?.severity).toBe('high');
  });

  it('marks missing description as low severity for resolved issues', () => {
    const findings = analyzeCompleteness([makeIssue({
      description: null,
      status: { name: 'Done', statusCategory: { key: 'done' } },
    })], 'TEST');
    const descFinding = findings.find(f => f.message.includes('Beschreibung'));
    expect(descFinding?.severity).toBe('low');
  });

  // --- Assignee checks ---

  it('detects missing assignee on open issues', () => {
    const findings = analyzeCompleteness([makeIssue({ assignee: null })], 'TEST');
    expect(findings.some(f => f.message.includes('Zuständiger'))).toBe(true);
  });

  it('does NOT flag missing assignee on resolved issues', () => {
    const findings = analyzeCompleteness([makeIssue({
      assignee: null,
      status: { name: 'Done', statusCategory: { key: 'done' } },
    })], 'TEST');
    expect(findings.some(f => f.message.includes('Zuständiger'))).toBe(false);
  });

  it('sets assignee finding severity to medium', () => {
    const findings = analyzeCompleteness([makeIssue({ assignee: null })], 'TEST');
    const assigneeFinding = findings.find(f => f.message.includes('Zuständiger'));
    expect(assigneeFinding?.severity).toBe('medium');
  });

  // --- Labels/Components checks ---

  it('detects missing labels AND components', () => {
    const findings = analyzeCompleteness([makeIssue({ labels: [], components: [] })], 'TEST');
    expect(findings.some(f => f.message.includes('Labels'))).toBe(true);
  });

  it('does NOT flag when labels exist but components are empty', () => {
    const findings = analyzeCompleteness([makeIssue({ labels: ['bug'], components: [] })], 'TEST');
    expect(findings.some(f => f.message.includes('Labels'))).toBe(false);
  });

  it('does NOT flag when components exist but labels are empty', () => {
    const findings = analyzeCompleteness([makeIssue({ labels: [], components: [{ name: 'API' }] })], 'TEST');
    expect(findings.some(f => f.message.includes('Labels'))).toBe(false);
  });

  // --- Priority checks ---

  it('detects missing priority (null)', () => {
    const findings = analyzeCompleteness([makeIssue({ priority: null })], 'TEST');
    expect(findings.some(f => f.message.includes('Priorität'))).toBe(true);
  });

  it('detects priority set to None', () => {
    const findings = analyzeCompleteness([makeIssue({ priority: { name: 'None' } })], 'TEST');
    expect(findings.some(f => f.message.includes('Priorität'))).toBe(true);
  });

  it('does NOT flag when priority is set', () => {
    const findings = analyzeCompleteness([makeIssue({ priority: { name: 'High' } })], 'TEST');
    expect(findings.some(f => f.message.includes('Priorität'))).toBe(false);
  });

  // --- Story acceptance criteria checks ---

  it('detects story without acceptance criteria', () => {
    const findings = analyzeCompleteness([makeIssue({
      issuetype: { name: 'Story' },
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Just a normal story description that explains what the user wants but has no structured requirements' }] }],
      } as unknown as string,
    })], 'TEST');
    expect(findings.some(f => f.message.includes('Akzeptanzkriterien'))).toBe(true);
  });

  it('does NOT flag story with acceptance criteria keyword', () => {
    const findings = analyzeCompleteness([makeIssue({
      issuetype: { name: 'Story' },
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Given a user, When they login, Then they see dashboard' }] }],
      } as unknown as string,
    })], 'TEST');
    expect(findings.some(f => f.message.includes('Akzeptanzkriterien'))).toBe(false);
  });

  it('does NOT check acceptance criteria for non-story issue types', () => {
    const findings = analyzeCompleteness([makeIssue({
      issuetype: { name: 'Bug' },
    })], 'TEST');
    expect(findings.some(f => f.message.includes('Akzeptanzkriterien'))).toBe(false);
  });

  // --- Multiple issues ---

  it('analyzes multiple issues independently', () => {
    const issues = [
      makeIssue({ description: null }),
      makeIssue({ assignee: null }),
    ];
    // Override keys for uniqueness
    issues[0].key = 'TEST-1';
    issues[1].key = 'TEST-2';
    const findings = analyzeCompleteness(issues, 'TEST');
    expect(findings.some(f => f.itemKey === 'TEST-1' && f.message.includes('Beschreibung'))).toBe(true);
    expect(findings.some(f => f.itemKey === 'TEST-2' && f.message.includes('Zuständiger'))).toBe(true);
  });

  it('sets correct projectKey on all findings', () => {
    const findings = analyzeCompleteness([makeIssue({ description: null })], 'MY-PROJ');
    for (const f of findings) {
      expect(f.projectKey).toBe('MY-PROJ');
    }
  });

  it('sets all findings to checkType completeness', () => {
    const findings = analyzeCompleteness([makeIssue({
      description: null,
      assignee: null,
      labels: [],
      components: [],
      priority: null,
    })], 'TEST');
    for (const f of findings) {
      expect(f.checkType).toBe('completeness');
    }
  });
});
