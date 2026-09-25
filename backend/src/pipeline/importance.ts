import type { Category, EarthquakeFilters, Filters, MarketFilters, NewsFilters, NormalizedEvent } from '../types.js';
import { ValidationError } from '../types.js';

// D2: system baseline per category. Users can raise these per alert but not lower them.
export const BASELINE = {
  earthquakeMinMagnitude: 5.0,
  marketMinChangePct: 2,
} as const;

export interface Verdict { passed: boolean; reason: string }

export function evaluateBaseline(event: NormalizedEvent): Verdict {
  switch (event.category) {
    case 'earthquake': {
      const m = event.data.magnitude;
      return m >= BASELINE.earthquakeMinMagnitude
        ? { passed: true, reason: `M${m} ≥ baseline M${BASELINE.earthquakeMinMagnitude.toFixed(1)}` }
        : { passed: false, reason: `M${m} below baseline M${BASELINE.earthquakeMinMagnitude.toFixed(1)}` };
    }
    case 'market': {
      const move = Math.abs(event.data.changePct);
      return move >= BASELINE.marketMinChangePct
        ? { passed: true, reason: `${event.data.symbol} moved ${fmtPct(event.data.changePct)} (|move| ≥ baseline ${BASELINE.marketMinChangePct}%)` }
        : { passed: false, reason: `${event.data.symbol} moved ${fmtPct(event.data.changePct)} (below baseline ${BASELINE.marketMinChangePct}%)` };
    }
    case 'news':
      return {
        passed: true,
        reason: 'News has no objective importance signal; every headline passes the baseline and importance is decided per alert by keyword match.',
      };
  }
}

export function validateFilters(category: Category, raw: unknown): Filters {
  const f = (raw ?? {}) as Record<string, unknown>;
  switch (category) {
    case 'earthquake': {
      const minMagnitude = f.minMagnitude === undefined ? BASELINE.earthquakeMinMagnitude : Number(f.minMagnitude);
      if (!Number.isFinite(minMagnitude)) throw new ValidationError('minMagnitude must be a number');
      if (minMagnitude < BASELINE.earthquakeMinMagnitude) {
        throw new ValidationError(`minMagnitude can't be below the system baseline of ${BASELINE.earthquakeMinMagnitude}`);
      }
      return { minMagnitude } satisfies EarthquakeFilters;
    }
    case 'market': {
      const symbol = typeof f.symbol === 'string' ? f.symbol.trim().toUpperCase() : '';
      if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) throw new ValidationError('symbol is required (e.g. AAPL)');
      const minChangePct = f.minChangePct === undefined ? BASELINE.marketMinChangePct : Number(f.minChangePct);
      if (!Number.isFinite(minChangePct)) throw new ValidationError('minChangePct must be a number');
      if (minChangePct < BASELINE.marketMinChangePct) {
        throw new ValidationError(`minChangePct can't be below the system baseline of ${BASELINE.marketMinChangePct}`);
      }
      return { symbol, minChangePct } satisfies MarketFilters;
    }
    case 'news': {
      const list = Array.isArray(f.keywords) ? f.keywords : [];
      const keywords = [...new Set(list.map((k) => String(k).trim()).filter(Boolean))];
      if (keywords.length === 0) throw new ValidationError('at least one keyword is required');
      return { keywords } satisfies NewsFilters;
    }
  }
}

export function fmtPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
