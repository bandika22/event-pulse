import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeUsgsFeed, pollUsgs } from '../src/sources/usgs.js';
import { count, makeDb, T0 } from './helpers.js';

// Real payloads recorded in Phase 2.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/usgs/${name}`, import.meta.url), 'utf8'));

describe('USGS normalization against recorded feeds', () => {
  it('normalizes every event in the 4.5_day fixture', () => {
    const events = normalizeUsgsFeed(fixture('4.5_day.geojson'));
    expect(events).toHaveLength(12);
    for (const e of events) {
      if (e.category !== 'earthquake') throw new Error(`unexpected category ${e.category}`);
      expect(e.synthetic).toBe(false);
      expect(e.sourceEventId).toMatch(/^[a-z]+[0-9a-z]+$/);
      expect(e.occurredAt).toMatch(/Z$/);
      expect(typeof e.data.magnitude).toBe('number');
    }
  });

  it('maps the significant M6.4 event with its USGS id, url and times', () => {
    const [e] = normalizeUsgsFeed(fixture('significant_week.geojson'));
    expect(e).toMatchObject({
      sourceEventId: 'us7000tiqc',
      title: 'M 6.4 - 49 km NNE of Kainantu, Papua New Guinea',
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000tiqc',
      data: { magnitude: 6.4, place: '49 km NNE of Kainantu, Papua New Guinea' },
    });
    expect(e.sourceUpdatedAt > e.occurredAt).toBe(true);
  });

  it('skips events without a magnitude or that are not earthquakes', () => {
    const feed = { features: [
      { id: 'x1', properties: { mag: null, place: 'p', time: 0, updated: 0, url: 'u', title: 't', type: 'earthquake' } },
      { id: 'x2', properties: { mag: 5, place: 'p', time: 0, updated: 0, url: 'u', title: 't', type: 'quarry blast' } },
    ] };
    expect(normalizeUsgsFeed(feed)).toEqual([]);
  });
});

describe('pollUsgs', () => {
  it('ingests the feed and records source health', async () => {
    const db = makeDb();
    const fakeFetch = (async () => new Response(JSON.stringify(fixture('4.5_day.geojson')))) as typeof fetch;
    const r = await pollUsgs(db, 'http://feed', () => T0, fakeFetch);
    expect(r).toMatchObject({ fetched: 12, new: 12, updated: 0 });
    expect(count(db, 'events')).toBe(12);
    // Re-polling the same payload changes nothing.
    expect(await pollUsgs(db, 'http://feed', () => T0, fakeFetch)).toMatchObject({ new: 0, updated: 0 });
    expect(db.prepare("SELECT last_success_at FROM source_status WHERE source = 'usgs'").get()).toEqual({ last_success_at: T0 });
  });

  it('records the error when the feed fails', async () => {
    const db = makeDb();
    const failing = (async () => new Response('down', { status: 503 })) as typeof fetch;
    await expect(pollUsgs(db, 'http://feed', () => T0, failing)).rejects.toThrow('HTTP 503');
    expect(db.prepare("SELECT last_error FROM source_status WHERE source = 'usgs'").get()).toEqual({ last_error: 'HTTP 503' });
  });
});
