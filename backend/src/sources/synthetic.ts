import { createHash, randomUUID } from 'node:crypto';
import type { NormalizedEvent } from '../types.js';
import { ValidationError } from '../types.js';

// D4: market and news are synthetic. Every event created here is marked synthetic and shown as such.

export function normalizeSynthetic(raw: unknown, now: Date = new Date()): NormalizedEvent {
  const input = (raw ?? {}) as Record<string, unknown>;
  const nowIso = now.toISOString();
  switch (input.category) {
    case 'market': {
      const symbol = str(input.symbol, 'symbol').toUpperCase();
      const changePct = num(input.changePct, 'changePct');
      const tradingDay = input.tradingDay === undefined ? nowIso.slice(0, 10) : str(input.tradingDay, 'tradingDay');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDay)) throw new ValidationError('tradingDay must be YYYY-MM-DD');
      const price = input.price === undefined ? undefined : num(input.price, 'price');
      return {
        source: 'synthetic-market',
        // D8 (revised in Phase 3): symbol + trading day. A growing move is a revision of the same event.
        sourceEventId: `${symbol}:${tradingDay}`,
        category: 'market',
        title: `${symbol} ${changePct >= 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(2)}% on ${tradingDay}`,
        url: null,
        occurredAt: nowIso,
        sourceUpdatedAt: nowIso,
        synthetic: true,
        data: { symbol, tradingDay, changePct, ...(price === undefined ? {} : { price }) },
      };
    }
    case 'news': {
      const headline = str(input.headline, 'headline');
      const summary = input.summary === undefined ? undefined : str(input.summary, 'summary');
      const id = input.id === undefined ? createHash('sha1').update(headline).digest('hex').slice(0, 16) : str(input.id, 'id');
      return {
        source: 'synthetic-news',
        sourceEventId: id,
        category: 'news',
        title: headline,
        url: typeof input.url === 'string' ? input.url : null,
        occurredAt: nowIso,
        sourceUpdatedAt: nowIso,
        synthetic: true,
        data: summary === undefined ? {} : { summary },
      };
    }
    case 'earthquake': {
      // For demoing the disaster path on demand; the real disaster source is USGS.
      const magnitude = num(input.magnitude, 'magnitude');
      const place = str(input.place, 'place');
      return {
        source: 'synthetic-earthquake',
        sourceEventId: input.id === undefined ? randomUUID() : str(input.id, 'id'),
        category: 'earthquake',
        title: `M ${magnitude.toFixed(1)} - ${place}`,
        url: null,
        occurredAt: nowIso,
        sourceUpdatedAt: nowIso,
        synthetic: true,
        data: { magnitude, place },
      };
    }
    default:
      throw new ValidationError('category must be one of: market, news, earthquake');
  }
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new ValidationError(`${name} is required`);
  return v.trim();
}

function num(v: unknown, name: string): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new ValidationError(`${name} must be a number`);
  return n;
}
