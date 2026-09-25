import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistry } from '../src/channels/registry.js';
import type { Channel, SendResult } from '../src/channels/types.js';
import type { DB } from '../src/db.js';
import { MAX_ATTEMPTS, processDueDeliveries, RETRY_DELAYS_MS, retryDelivery } from '../src/delivery/worker.js';
import { ingestEvent } from '../src/pipeline/ingest.js';
import { addAlert, addDestination, addUser, makeDb, quake, T1 } from './helpers.js';

function fakeChannel(results: SendResult[]): Channel & { sent: string[] } {
  const sent: string[] = [];
  return {
    type: 'fake', displayName: 'Fake', configFields: [], sent,
    validateConfig: (raw) => raw as Record<string, string>,
    async send(n) { sent.push(n.title); return results.shift() ?? { ok: true }; },
  };
}

let db: DB;
const t = (ms: number) => new Date(new Date(T1).getTime() + ms);

function setup(channelType = 'fake') {
  db = makeDb();
  const userId = addUser(db);
  const destId = addDestination(db, userId, channelType, {});
  addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
  ingestEvent(db, quake('q1', 6.2), T1);
}

const delivery = () => db.prepare('SELECT status, attempts, last_error FROM deliveries').get();
const attempts = () => db.prepare('SELECT attempt, ok, retryable FROM delivery_attempts ORDER BY attempt').all();

describe('delivery worker (D11 / AC11)', () => {
  beforeEach(() => setup());

  it('sends and marks the delivery sent, recording the attempt', async () => {
    const ch = fakeChannel([{ ok: true }]);
    await processDueDeliveries(db, createRegistry([ch]), t(0));
    expect(ch.sent).toEqual(['M 6.2 - Somewhere']);
    expect(delivery()).toEqual({ status: 'sent', attempts: 1, last_error: null });
    expect(attempts()).toEqual([{ attempt: 1, ok: 1, retryable: null }]);
  });

  it('retries retryable failures with backoff, then fails after the limit', async () => {
    const ch = fakeChannel(Array(MAX_ATTEMPTS).fill({ ok: false, retryable: true, error: 'HTTP 500' }));
    const reg = createRegistry([ch]);
    await processDueDeliveries(db, reg, t(0));
    expect(delivery()).toMatchObject({ status: 'retrying', attempts: 1 });
    // Not due yet: nothing happens.
    expect(await processDueDeliveries(db, reg, t(RETRY_DELAYS_MS[0] - 1))).toBe(0);
    let elapsed = 0;
    for (const d of RETRY_DELAYS_MS) { elapsed += d; await processDueDeliveries(db, reg, t(elapsed)); }
    expect(delivery()).toEqual({ status: 'failed', attempts: MAX_ATTEMPTS, last_error: 'HTTP 500' });
    expect(attempts()).toHaveLength(MAX_ATTEMPTS);
  });

  it('fails permanent errors immediately', async () => {
    await processDueDeliveries(db, createRegistry([fakeChannel([{ ok: false, retryable: false, error: 'HTTP 404: no_service' }])]), t(0));
    expect(delivery()).toEqual({ status: 'failed', attempts: 1, last_error: 'HTTP 404: no_service' });
  });

  it('manual retry queues one more attempt for a failed delivery', async () => {
    const ch = fakeChannel([{ ok: false, retryable: false, error: 'boom' }, { ok: true }]);
    const reg = createRegistry([ch]);
    await processDueDeliveries(db, reg, t(0));
    expect(retryDelivery(db, 1, t(1000))).toBe(true);
    await processDueDeliveries(db, reg, t(1000));
    expect(delivery()).toMatchObject({ status: 'sent', attempts: 2 });
    expect(retryDelivery(db, 1, t(2000))).toBe(false); // only failed deliveries
  });
});

describe('delivery worker edge cases', () => {
  it('fails a delivery whose channel type is not registered', async () => {
    setup('removed-channel');
    await processDueDeliveries(db, createRegistry([]), t(0));
    expect(delivery()).toEqual({ status: 'failed', attempts: 1, last_error: 'unknown channel type: removed-channel' });
  });

  it('treats an invalid stored config as permanent, not retryable', async () => {
    setup();
    const ch = { ...fakeChannel([]), validateConfig: () => { throw new Error('bad url'); } };
    await processDueDeliveries(db, createRegistry([ch]), t(0));
    expect(delivery()).toMatchObject({ status: 'failed', last_error: 'invalid destination config: bad url' });
  });

  it('retries a channel that throws instead of returning a result', async () => {
    setup();
    const ch = { ...fakeChannel([]), send: async () => { throw new Error('socket hang up'); } };
    await processDueDeliveries(db, createRegistry([ch]), t(0));
    expect(delivery()).toMatchObject({ status: 'retrying', last_error: 'channel threw: socket hang up' });
  });
});
