export type Category = 'earthquake' | 'market' | 'news';
export const CATEGORIES: readonly Category[] = ['earthquake', 'market', 'news'];

export interface EarthquakeData { magnitude: number; place: string }
export interface MarketData { symbol: string; tradingDay: string; changePct: number; price?: number }
export interface NewsData { summary?: string }

export type NormalizedEvent =
  | (EventBase & { category: 'earthquake'; data: EarthquakeData })
  | (EventBase & { category: 'market'; data: MarketData })
  | (EventBase & { category: 'news'; data: NewsData });

interface EventBase {
  source: string;
  sourceEventId: string;
  title: string;
  url: string | null;
  occurredAt: string; // ISO UTC
  sourceUpdatedAt: string; // ISO UTC; a change means the source revised the event
  synthetic: boolean;
}

export interface EarthquakeFilters { minMagnitude: number }
export interface MarketFilters { symbol: string; minChangePct: number }
export interface NewsFilters { keywords: string[] }
export type Filters = EarthquakeFilters | MarketFilters | NewsFilters;

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
