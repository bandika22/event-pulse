import { describe, expect, it } from 'vitest';
import { evaluateBaseline, validateFilters } from '../src/pipeline/importance.js';
import { containsWord, matchAlert } from '../src/pipeline/matching.js';
import { normalizeSynthetic } from '../src/sources/synthetic.js';
import { ValidationError } from '../src/types.js';
import { quake } from './helpers.js';

describe('baseline (D2 / AC7)', () => {
  it('earthquakes pass at M5.0 and above, with a stated reason', () => {
    expect(evaluateBaseline(quake('a', 5.0))).toEqual({ passed: true, reason: 'M5 ≥ baseline M5.0' });
    expect(evaluateBaseline(quake('b', 4.9)).passed).toBe(false);
  });

  it('market moves pass at |2%| in either direction', () => {
    expect(evaluateBaseline(normalizeSynthetic({ category: 'market', symbol: 'AAPL', changePct: -2 })).passed).toBe(true);
    expect(evaluateBaseline(normalizeSynthetic({ category: 'market', symbol: 'AAPL', changePct: 1.99 })).passed).toBe(false);
  });

  it('news always passes the baseline and says why', () => {
    const v = evaluateBaseline(normalizeSynthetic({ category: 'news', headline: 'Anything' }));
    expect(v.passed).toBe(true);
    expect(v.reason).toMatch(/no objective importance signal/);
  });
});

describe('filters: users can raise the baseline but not lower it', () => {
  it('rejects thresholds below the baseline', () => {
    expect(() => validateFilters('earthquake', { minMagnitude: 4.5 })).toThrow(ValidationError);
    expect(() => validateFilters('market', { symbol: 'AAPL', minChangePct: 1 })).toThrow(ValidationError);
  });

  it('defaults to the baseline and normalizes input', () => {
    expect(validateFilters('earthquake', {})).toEqual({ minMagnitude: 5 });
    expect(validateFilters('market', { symbol: ' aapl ' })).toEqual({ symbol: 'AAPL', minChangePct: 2 });
    expect(validateFilters('news', { keywords: [' war ', 'war', ''] })).toEqual({ keywords: ['war'] });
  });

  it('requires keywords for news and a symbol for market', () => {
    expect(() => validateFilters('news', { keywords: [] })).toThrow(ValidationError);
    expect(() => validateFilters('market', {})).toThrow(ValidationError);
  });
});

describe('matching', () => {
  it('matches keywords as whole words, case-insensitively', () => {
    expect(containsWord('Software update released', 'war')).toBe(false);
    expect(containsWord('War breaks out', 'war')).toBe(true);
    expect(containsWord('New C++ standard', 'c++')).toBe(true);
  });

  it('market alerts only match their own symbol', () => {
    const e = normalizeSynthetic({ category: 'market', symbol: 'TSLA', changePct: 6 });
    expect(matchAlert({ symbol: 'AAPL', minChangePct: 2 }, e).matched).toBe(false);
    expect(matchAlert({ symbol: 'TSLA', minChangePct: 5 }, e).matched).toBe(true);
  });
});

describe('synthetic events (D4)', () => {
  it('are always marked synthetic and key market events by symbol + trading day (D8)', () => {
    const e = normalizeSynthetic({ category: 'market', symbol: 'aapl', changePct: 3, tradingDay: '2026-09-24' });
    expect(e.synthetic).toBe(true);
    expect(e.sourceEventId).toBe('AAPL:2026-09-24');
  });

  it('rejects unknown categories and missing fields', () => {
    expect(() => normalizeSynthetic({ category: 'weather' })).toThrow(ValidationError);
    expect(() => normalizeSynthetic({ category: 'market', symbol: 'AAPL' })).toThrow(ValidationError);
  });
});
