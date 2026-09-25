import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createRegistry } from '../src/channels/registry.js';
import { createEmailChannel } from '../src/channels/email.js';
import { createSlackChannel } from '../src/channels/slack.js';
import type { DB } from '../src/db.js';
import { seedDemoUsers } from '../src/seed.js';
import { makeDb } from './helpers.js';

let server: Server;
let base: string;
let db: DB;

beforeAll(async () => {
  db = makeDb();
  seedDemoUsers(db);
  const registry = createRegistry([
    createEmailChannel({ host: 'localhost', port: 1025, from: 'x@y.z' }),
    createSlackChannel({ allowedPrefixes: ['http://localhost:4010/'] }),
  ]);
  const app = createApp({
    db, registry, sessionSecret: 'test',
    syntheticFixturesDir: fileURLToPath(new URL('../../fixtures/synthetic', import.meta.url)),
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0];
}

function api(cookie: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
}

describe('HTTP API end to end (in-process)', () => {
  it('rejects bad credentials and anonymous access', async () => {
    const bad = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alice@example.com', password: 'wrong' }) });
    expect(bad.status).toBe(401);
    expect((await fetch(`${base}/api/alerts`)).status).toBe(401);
  });

  it('user sets up destinations and an alert; admin injects an event; deliveries are queued', async () => {
    const user = api(await login('alice@example.com', 'alice123'));
    const admin = api(await login('admin@example.com', 'admin123'));

    const channels = await user('GET', '/api/channels');
    expect(channels.body.map((c: { type: string }) => c.type)).toEqual(['email', 'slack']);

    const email = await user('POST', '/api/destinations', { channelType: 'email', label: 'Work', config: { address: 'alice@example.com' } });
    const slack = await user('POST', '/api/destinations', { channelType: 'slack', config: { webhookUrl: 'http://localhost:4010/hook/alice' } });
    expect(email.status).toBe(201);
    expect(slack.body.config.webhookUrl).toMatch(/…$/); // sensitive field masked

    const tooLow = await user('POST', '/api/alerts', { name: 'x', category: 'earthquake', filters: { minMagnitude: 3 }, destinationIds: [email.body.id] });
    expect(tooLow).toMatchObject({ status: 400, body: { error: expect.stringMatching(/baseline/) } });

    const alert = await user('POST', '/api/alerts', {
      name: 'Big quakes', category: 'earthquake', filters: { minMagnitude: 6 }, destinationIds: [email.body.id, slack.body.id],
    });
    expect(alert).toMatchObject({ status: 201, body: { enabled: true, filters: { minMagnitude: 6 }, destinationIds: [email.body.id, slack.body.id] } });

    expect((await user('POST', '/api/admin/events/inject', { category: 'earthquake', magnitude: 7, place: 'Test' })).status).toBe(403);
    const injected = await admin('POST', '/api/admin/events/inject', { category: 'earthquake', magnitude: 7.1, place: 'Demo Bay', id: 'demo-1' });
    expect(injected.body).toMatchObject({ status: 'new', baselinePassed: true, notificationsCreated: 1 });

    const deliveries = await admin('GET', '/api/admin/deliveries');
    expect(deliveries.body.map((d: { channelType: string; status: string }) => [d.channelType, d.status]).sort())
      .toEqual([['email', 'pending'], ['slack', 'pending']]);

    const events = await admin('GET', '/api/admin/events');
    expect(events.body[0]).toMatchObject({ title: 'M 7.1 - Demo Bay', synthetic: true, baselinePassed: true, notificationCount: 1 });
  });

  it('admin can disable an alert, and disabled alerts stop matching', async () => {
    const admin = api(await login('admin@example.com', 'admin123'));
    const disabled = await admin('POST', '/api/admin/alerts/1/disable');
    expect(disabled.body.enabled).toBe(false);
    const r = await admin('POST', '/api/admin/events/inject', { category: 'earthquake', magnitude: 7.5, place: 'Elsewhere', id: 'demo-2' });
    expect(r.body.notificationsCreated).toBe(0);
  });

  it('replays the synthetic fixtures', async () => {
    const admin = api(await login('admin@example.com', 'admin123'));
    const r = await admin('POST', '/api/admin/fixtures/replay');
    expect(r.body).toHaveLength(6);
    expect(r.body.filter((x: { baselinePassed: boolean }) => !x.baselinePassed)).toHaveLength(1); // MSFT +1.1%
  });
});
