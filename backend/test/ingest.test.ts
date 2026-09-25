import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../src/db.js';
import { ingestEvent } from '../src/pipeline/ingest.js';
import { normalizeSynthetic } from '../src/sources/synthetic.js';
import { addAlert, addDestination, addUser, count, makeDb, quake, T0, T1, T2 } from './helpers.js';

let db: DB;
let userId: number;
let destId: number;

beforeEach(() => {
  db = makeDb();
  userId = addUser(db);
  destId = addDestination(db, userId);
});

describe('matching and notification', () => {
  it('a matching event creates one notification and one delivery per destination (D6)', () => {
    const slackId = addDestination(db, userId, 'slack', { webhookUrl: 'http://localhost:4010/hook/a' });
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId, slackId] });
    const r = ingestEvent(db, quake('q1', 6.1), T1);
    expect(r).toMatchObject({ status: 'new', baselinePassed: true, notificationsCreated: 1 });
    expect(count(db, 'deliveries')).toBe(2);
  });

  it('below-baseline events are stored with their reason but notify nobody (AC7)', () => {
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
    const r = ingestEvent(db, quake('q1', 4.7), T1);
    expect(r.baselinePassed).toBe(false);
    expect(db.prepare('SELECT baseline_reason FROM events').get()).toEqual({ baseline_reason: 'M4.7 below baseline M5.0' });
    expect(count(db, 'notifications')).toBe(0);
  });

  it('disabled alerts are skipped', () => {
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId], enabled: false });
    expect(ingestEvent(db, quake('q1', 6), T1).notificationsCreated).toBe(0);
  });
});

describe('dedup (D8 / AC10)', () => {
  it('ingesting the same event twice notifies once', () => {
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
    ingestEvent(db, quake('q1', 6), T1);
    const again = ingestEvent(db, quake('q1', 6), T2);
    expect(again.status).toBe('unchanged');
    expect(count(db, 'notifications')).toBe(1);
    expect(count(db, 'deliveries')).toBe(1);
  });

  it('a revision does not re-notify an alert already notified', () => {
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
    ingestEvent(db, quake('q1', 6.0, T1), T1);
    const revised = ingestEvent(db, quake('q1', 6.3, T2), T2);
    expect(revised).toMatchObject({ status: 'updated', notificationsCreated: 0 });
    expect(count(db, 'notifications')).toBe(1);
  });

  it('an event revised into a higher threshold notifies that alert then', () => {
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
    const strict = addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 6.5 }, destinationIds: [destId] });
    ingestEvent(db, quake('q1', 6.0, T1), T1);
    const revised = ingestEvent(db, quake('q1', 6.7, T2), T2);
    expect(revised.notificationsCreated).toBe(1);
    expect(db.prepare('SELECT alert_id FROM notifications ORDER BY id').all()).toEqual([{ alert_id: 1 }, { alert_id: strict }]);
  });

  it('a growing market move is a revision of the same event (D8, Phase 3)', () => {
    addAlert(db, { userId, category: 'market', filters: { symbol: 'AAPL', minChangePct: 2 }, destinationIds: [destId] });
    addAlert(db, { userId, category: 'market', filters: { symbol: 'AAPL', minChangePct: 5 }, destinationIds: [destId] });
    const day = '2026-09-24';
    const first = ingestEvent(db, normalizeSynthetic({ category: 'market', symbol: 'AAPL', changePct: -2.5, tradingDay: day }, new Date(T1)), T1);
    const grown = ingestEvent(db, normalizeSynthetic({ category: 'market', symbol: 'AAPL', changePct: -5.2, tradingDay: day }, new Date(T2)), T2);
    expect(grown.eventId).toBe(first.eventId);
    expect([first.notificationsCreated, grown.notificationsCreated]).toEqual([1, 1]);
    expect(count(db, 'events')).toBe(1);
  });
});

describe('no backfill (D18)', () => {
  it('an alert created after an event was first seen never fires for it, even on revision', () => {
    ingestEvent(db, quake('q1', 6.0, T0), T0);
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId], createdAt: T1 });
    expect(ingestEvent(db, quake('q1', 6.4, T2), T2).notificationsCreated).toBe(0);
    expect(ingestEvent(db, quake('q2', 6.0, T2), T2).notificationsCreated).toBe(1);
  });
});
