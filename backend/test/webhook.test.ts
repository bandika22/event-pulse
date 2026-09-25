import { createHmac } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRegistry } from '../src/channels/registry.js';
import type { Notification } from '../src/channels/types.js';
import { classifyWebhookResponse, createWebhookChannel } from '../src/channels/webhook.js';
import { processDueDeliveries } from '../src/delivery/worker.js';
import { ingestEvent } from '../src/pipeline/ingest.js';
import { ValidationError } from '../src/types.js';
import { addAlert, addDestination, addUser, makeDb, quake, T1 } from './helpers.js';

// A real local receiver: records requests; /status/<code> answers with that code, /redirect answers 302.
let server: Server;
let base: string;
let received: { path: string; headers: IncomingHttpHeaders; body: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push({ path: req.url ?? '', headers: req.headers, body });
      const m = /^\/status\/(\d{3})$/.exec(req.url ?? '');
      if (req.url === '/redirect') { res.writeHead(302, { Location: 'http://169.254.169.254/' }).end(); return; }
      res.writeHead(m ? Number(m[1]) : 200).end(m ? 'nope' : 'ok');
    });
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
beforeEach(() => { received = []; });

const n: Notification = {
  title: 'M 6.4 - Somewhere', category: 'earthquake', severity: 'M6.4', occurredAt: '2026-09-25T10:00:00.000Z',
  url: 'https://example.com/e', alertName: 'Big quakes', reason: 'M6.4 ≥ your threshold M5', synthetic: false,
};
const channel = () => createWebhookChannel({ allowedPrefixes: [base], now: () => 1_790_000_000_000 });

describe('webhook channel', () => {
  it('POSTs the notification as JSON with a verifiable HMAC signature', async () => {
    expect(await channel().send(n, { url: `${base}/hook`, secret: 's3cret' })).toEqual({ ok: true });
    const [req] = received;
    expect(JSON.parse(req.body)).toMatchObject({ type: 'event-pulse.notification', title: n.title, alert: 'Big quakes', synthetic: false });
    expect(req.headers['x-eventpulse-timestamp']).toBe('1790000000');
    // Recompute independently of the code under test, from the documented format: HMAC-SHA256(secret, `${timestamp}.${body}`).
    const expected = `sha256=${createHmac('sha256', 's3cret').update(`1790000000.${req.body}`).digest('hex')}`;
    expect(req.headers['x-eventpulse-signature']).toBe(expected);
  });

  it('sends no signature header without a secret', async () => {
    await channel().send(n, { url: `${base}/hook` });
    expect(received[0].headers['x-eventpulse-signature']).toBeUndefined();
  });

  it('classifies responses: 408/429/5xx retryable, other 4xx permanent, network errors retryable', async () => {
    expect(await channel().send(n, { url: `${base}/status/503` })).toMatchObject({ ok: false, retryable: true, error: 'HTTP 503: nope' });
    expect(await channel().send(n, { url: `${base}/status/410` })).toMatchObject({ ok: false, retryable: false });
    expect(classifyWebhookResponse(408, '')).toMatchObject({ retryable: true });
    expect(classifyWebhookResponse(429, '')).toMatchObject({ retryable: true });
    const down = createWebhookChannel({ allowedPrefixes: ['http://localhost:1/'] });
    expect(await down.send(n, { url: 'http://localhost:1/x' })).toMatchObject({ ok: false, retryable: true, error: expect.stringMatching(/^network: /) });
  });

  it('does not follow redirects (they could leave the allowlist)', async () => {
    const r = await channel().send(n, { url: `${base}/redirect` });
    expect(r).toMatchObject({ ok: false, retryable: false, error: expect.stringMatching(/^HTTP 302/) });
    expect(received.map((x) => x.path)).toEqual(['/redirect']);
  });

  it('validates config against the allowlist and drops an empty secret', () => {
    const ch = channel();
    expect(ch.validateConfig({ url: `${base}/a`, secret: '  ' })).toEqual({ url: `${base}/a` });
    expect(ch.validateConfig({ url: `${base}/a`, secret: 'k' })).toEqual({ url: `${base}/a`, secret: 'k' });
    expect(() => ch.validateConfig({ url: 'http://169.254.169.254/latest' })).toThrow(ValidationError);
    expect(() => ch.validateConfig({ url: 'nope' })).toThrow(ValidationError);
  });

  it('marks the secret as sensitive and the secret field as optional', () => {
    expect(channel().configFields.map((f) => [f.name, f.required, !!f.sensitive])).toEqual([['url', true, false], ['secret', false, true]]);
  });
});

describe('webhook through the unchanged pipeline', () => {
  it('an ingested event is delivered by the worker to a webhook destination', async () => {
    const db = makeDb();
    const userId = addUser(db);
    const destId = addDestination(db, userId, 'webhook', { url: `${base}/pipeline`, secret: 'k' });
    addAlert(db, { userId, category: 'earthquake', filters: { minMagnitude: 5 }, destinationIds: [destId] });
    ingestEvent(db, quake('q1', 6.3), T1);
    await processDueDeliveries(db, createRegistry([channel()]), new Date(T1));
    expect(db.prepare('SELECT status, attempts FROM deliveries').get()).toEqual({ status: 'sent', attempts: 1 });
    expect(JSON.parse(received[0].body)).toMatchObject({ title: 'M 6.3 - Somewhere', severity: 'M6.3' });
  });
});
