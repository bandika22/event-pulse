import type { EarthquakeFilters, Filters, MarketFilters, NewsFilters, NormalizedEvent } from '../types.js';
import { fmtPct } from './importance.js';

export interface MatchResult { matched: boolean; reason: string }

/** Whether one alert's filters match an event. Category equality is checked by the caller. */
export function matchAlert(filters: Filters, event: NormalizedEvent): MatchResult {
  switch (event.category) {
    case 'earthquake': {
      const f = filters as EarthquakeFilters;
      const m = event.data.magnitude;
      return m >= f.minMagnitude
        ? { matched: true, reason: `M${m} ≥ your threshold M${f.minMagnitude}` }
        : { matched: false, reason: `M${m} below your threshold M${f.minMagnitude}` };
    }
    case 'market': {
      const f = filters as MarketFilters;
      if (event.data.symbol.toUpperCase() !== f.symbol) return { matched: false, reason: 'different symbol' };
      const move = Math.abs(event.data.changePct);
      return move >= f.minChangePct
        ? { matched: true, reason: `${f.symbol} moved ${fmtPct(event.data.changePct)} (≥ your ${f.minChangePct}%)` }
        : { matched: false, reason: `${f.symbol} moved ${fmtPct(event.data.changePct)} (below your ${f.minChangePct}%)` };
    }
    case 'news': {
      const f = filters as NewsFilters;
      const text = `${event.title}\n${event.data.summary ?? ''}`;
      const hit = f.keywords.find((k) => containsWord(text, k));
      return hit
        ? { matched: true, reason: `headline mentions "${hit}"` }
        : { matched: false, reason: 'no keyword match' };
    }
  }
}

/** Case-insensitive whole-word match, so "war" doesn't match "software". Works for keywords like "C++". */
export function containsWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}
