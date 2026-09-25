import type { DB } from '../db.js';
import { ingestEvent } from '../pipeline/ingest.js';
import type { NormalizedEvent } from '../types.js';

export const USGS_SOURCE = 'usgs';

// Field names verified against real feed responses in Phase 2 (fixtures/usgs/).
interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url: string;
    title: string;
    type: string;
  };
}

export function normalizeUsgsFeed(geojson: unknown): NormalizedEvent[] {
  const features = (geojson as { features?: UsgsFeature[] }).features;
  if (!Array.isArray(features)) throw new Error('USGS response has no features array');
  const out: NormalizedEvent[] = [];
  for (const f of features) {
    const p = f.properties;
    // Can't judge importance without a magnitude; non-earthquake types (e.g. quarry blasts) aren't in scope.
    if (p.mag === null || p.type !== 'earthquake') continue;
    out.push({
      source: USGS_SOURCE,
      sourceEventId: f.id,
      category: 'earthquake',
      title: p.title,
      url: p.url,
      occurredAt: new Date(p.time).toISOString(),
      sourceUpdatedAt: new Date(p.updated).toISOString(),
      synthetic: false,
      data: { magnitude: p.mag, place: p.place ?? 'Unknown location' },
    });
  }
  return out;
}

export interface PollResult { fetched: number; new: number; updated: number; notifications: number }

export async function pollUsgs(db: DB, feedUrl: string, now = () => new Date().toISOString(), fetchFn: typeof fetch = fetch): Promise<PollResult> {
  try {
    const res = await fetchFn(feedUrl, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'event-pulse/0.1' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = normalizeUsgsFeed(await res.json());
    const result: PollResult = { fetched: events.length, new: 0, updated: 0, notifications: 0 };
    for (const e of events) {
      const r = ingestEvent(db, e, now());
      if (r.status === 'new') result.new++;
      if (r.status === 'updated') result.updated++;
      result.notifications += r.notificationsCreated;
    }
    db.prepare(
      `INSERT INTO source_status (source, last_success_at) VALUES (?, ?)
       ON CONFLICT (source) DO UPDATE SET last_success_at = excluded.last_success_at`,
    ).run(USGS_SOURCE, now());
    return result;
  } catch (err) {
    db.prepare(
      `INSERT INTO source_status (source, last_error, last_error_at) VALUES (?, ?, ?)
       ON CONFLICT (source) DO UPDATE SET last_error = excluded.last_error, last_error_at = excluded.last_error_at`,
    ).run(USGS_SOURCE, String((err as Error).message ?? err), now());
    throw err;
  }
}
