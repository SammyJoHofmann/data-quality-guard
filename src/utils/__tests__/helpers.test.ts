// ============================================================
// FILE: helpers.test.ts
// PATH: src/utils/__tests__/helpers.test.ts
// PROJECT: DataQualityGuard
// PURPOSE: Unit tests for utility helper functions
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateId, daysSince, severityFromScore, stripHtml, truncate } from '../helpers';

describe('generateId', () => {
  it('starts with the given prefix', () => {
    const id = generateId('test');
    expect(id.startsWith('test_')).toBe(true);
  });

  it('generates unique IDs on consecutive calls', () => {
    const id1 = generateId('a');
    const id2 = generateId('a');
    expect(id1).not.toBe(id2);
  });

  it('contains exactly two underscore separators', () => {
    const id = generateId('prefix');
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('prefix');
  });

  it('works with empty prefix', () => {
    const id = generateId('');
    expect(id.startsWith('_')).toBe(true);
  });
});

describe('daysSince', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for today', () => {
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(daysSince('2026-03-17T00:00:00Z')).toBe(0);
  });

  it('returns correct number of days for past date', () => {
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
    expect(daysSince('2026-03-10T12:00:00Z')).toBe(7);
  });

  it('returns correct number for 30 days ago', () => {
    vi.setSystemTime(new Date('2026-03-17T00:00:00Z'));
    expect(daysSince('2026-02-15T00:00:00Z')).toBe(30);
  });

  it('returns 0 for date in the same day', () => {
    vi.setSystemTime(new Date('2026-03-17T18:00:00Z'));
    expect(daysSince('2026-03-17T06:00:00Z')).toBe(0);
  });

  it('handles ISO date string format', () => {
    vi.setSystemTime(new Date('2026-03-17T00:00:00Z'));
    const days = daysSince('2026-01-01T00:00:00.000Z');
    expect(days).toBe(75);
  });
});

describe('severityFromScore', () => {
  it('returns critical for score <= 20', () => {
    expect(severityFromScore(0)).toBe('critical');
    expect(severityFromScore(10)).toBe('critical');
    expect(severityFromScore(20)).toBe('critical');
  });

  it('returns high for score 21-40', () => {
    expect(severityFromScore(21)).toBe('high');
    expect(severityFromScore(30)).toBe('high');
    expect(severityFromScore(40)).toBe('high');
  });

  it('returns medium for score 41-60', () => {
    expect(severityFromScore(41)).toBe('medium');
    expect(severityFromScore(50)).toBe('medium');
    expect(severityFromScore(60)).toBe('medium');
  });

  it('returns low for score 61-80', () => {
    expect(severityFromScore(61)).toBe('low');
    expect(severityFromScore(70)).toBe('low');
    expect(severityFromScore(80)).toBe('low');
  });

  it('returns info for score > 80', () => {
    expect(severityFromScore(81)).toBe('info');
    expect(severityFromScore(100)).toBe('info');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('removes nested HTML tags', () => {
    expect(stripHtml('<div><p><strong>Bold</strong> text</p></div>')).toBe('Bold text');
  });

  it('collapses multiple spaces', () => {
    expect(stripHtml('<p>Hello</p>   <p>World</p>')).toBe('Hello World');
  });

  it('trims whitespace', () => {
    expect(stripHtml('  <p>Hello</p>  ')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('No HTML here')).toBe('No HTML here');
  });

  it('handles self-closing tags', () => {
    expect(stripHtml('Hello<br/>World')).toBe('Hello World');
  });

  it('handles tags with attributes', () => {
    expect(stripHtml('<a href="https://example.com">Link</a>')).toBe('Link');
  });
});

describe('truncate', () => {
  it('returns original string when shorter than maxLen', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('returns original string when exactly maxLen', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('truncates and adds ellipsis when longer than maxLen', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('handles maxLen of 3 (minimum for ellipsis)', () => {
    expect(truncate('Hello', 3)).toBe('...');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('preserves exact length with ellipsis', () => {
    const result = truncate('A very long string that needs truncating', 15);
    expect(result.length).toBe(15);
    expect(result.endsWith('...')).toBe(true);
  });
});
