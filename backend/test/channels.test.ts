import { describe, expect, it } from 'vitest';
import { classifySmtpError, createEmailChannel } from '../src/channels/email.js';
import { createRegistry } from '../src/channels/registry.js';
import { classifySlackResponse, createSlackChannel, formatSlackText } from '../src/channels/slack.js';
import type { Notification } from '../src/channels/types.js';
import { ValidationError } from '../src/types.js';

const n: Notification = {
  title: 'M 6.4 - A & B <town>', category: 'earthquake', severity: 'M6.4', occurredAt: '2026-09-25T10:00:00.000Z',
  url: 'https://example.com/e', alertName: 'Big quakes', reason: 'M6.4 ≥ your threshold M5', synthetic: false,
};

describe('slack channel', () => {
  const allowed = ['https://hooks.slack.com/', 'http://localhost:4010/'];

  it('classifies responses: 2xx ok, 429/5xx retryable, other 4xx permanent', () => {
    expect(classifySlackResponse(200, 'ok')).toEqual({ ok: true });
    // The real response observed in Phase 4 for an invalid workspace.
    expect(classifySlackResponse(404, 'no_team')).toEqual({ ok: false, retryable: false, error: 'HTTP 404: no_team' });
    expect(classifySlackResponse(400, 'invalid_payload')).toMatchObject({ retryable: false });
    expect(classifySlackResponse(429, '')).toMatchObject({ retryable: true, error: 'HTTP 429: (empty body)' });
    expect(classifySlackResponse(503, 'x')).toMatchObject({ retryable: true });
  });

  it('posts JSON text to the webhook and treats network errors as retryable', async () => {
    const calls: { url: string; body: string }[] = [];
    const ok = createSlackChannel({ allowedPrefixes: allowed, fetchFn: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response('ok');
    }) as unknown as typeof fetch });
    expect(await ok.send(n, { webhookUrl: 'http://localhost:4010/hook/a' })).toEqual({ ok: true });
    expect(JSON.parse(calls[0].body).text).toContain('*M 6.4 - A &amp; B &lt;town&gt;*');

    const down = createSlackChannel({ allowedPrefixes: allowed, fetchFn: (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch });
    expect(await down.send(n, { webhookUrl: 'http://localhost:4010/hook/a' })).toEqual({ ok: false, retryable: true, error: 'network: ECONNREFUSED' });
  });

  it('only accepts webhook URLs with an allowed prefix (SSRF guard)', () => {
    const ch = createSlackChannel({ allowedPrefixes: allowed });
    expect(ch.validateConfig({ webhookUrl: 'https://hooks.slack.com/services/T/B/X' })).toEqual({ webhookUrl: 'https://hooks.slack.com/services/T/B/X' });
    expect(() => ch.validateConfig({ webhookUrl: 'http://169.254.169.254/latest' })).toThrow(ValidationError);
    expect(() => ch.validateConfig({ webhookUrl: 'not a url' })).toThrow(ValidationError);
  });

  it('marks synthetic data and links the source', () => {
    const text = formatSlackText({ ...n, synthetic: true });
    expect(text).toContain('_(synthetic demo data)_');
    expect(text).toContain('<https://example.com/e|Source>');
  });
});

describe('email channel', () => {
  it('classifies SMTP errors: 5xx permanent, 4xx and connection errors retryable', () => {
    expect(classifySmtpError(Object.assign(new Error('mailbox unavailable'), { responseCode: 550 }))).toMatchObject({ retryable: false });
    expect(classifySmtpError(Object.assign(new Error('try later'), { responseCode: 451 }))).toMatchObject({ retryable: true });
    expect(classifySmtpError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }))).toMatchObject({ retryable: true, error: 'ECONNECTION: connect ECONNREFUSED' });
  });

  it('validates the address', () => {
    const ch = createEmailChannel({ host: 'localhost', port: 1025, from: 'x@y.z' });
    expect(ch.validateConfig({ address: ' a@b.co ' })).toEqual({ address: 'a@b.co' });
    expect(() => ch.validateConfig({ address: 'nope' })).toThrow(ValidationError);
  });
});

describe('registry', () => {
  it('rejects duplicate channel types', () => {
    const ch = createEmailChannel({ host: 'localhost', port: 1025, from: 'x@y.z' });
    expect(() => createRegistry([ch, ch])).toThrow('Duplicate channel type: email');
  });
});
