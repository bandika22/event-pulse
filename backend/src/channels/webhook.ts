import { createHmac } from 'node:crypto';
import { ValidationError } from '../types.js';
import type { Channel, ChannelConfig, Notification, SendResult } from './types.js';

/**
 * Generic outbound webhook (D15, Phase 6): POSTs the notification as JSON to any allowed URL.
 * If a secret is set, the body is signed: X-EventPulse-Signature = "sha256=" + HMAC-SHA256(secret, `${timestamp}.${body}`),
 * with the timestamp in X-EventPulse-Timestamp, so receivers can verify origin and reject replays.
 */
export interface WebhookOptions { allowedPrefixes: string[]; fetchFn?: typeof fetch; now?: () => number }

export function createWebhookChannel(opts: WebhookOptions): Channel {
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  return {
    type: 'webhook',
    displayName: 'Webhook',
    configFields: [
      { name: 'url', label: 'Endpoint URL', kind: 'url', required: true, help: 'Receives a JSON POST for each notification.' },
      { name: 'secret', label: 'Signing secret (optional)', kind: 'text', required: false, sensitive: true, help: 'If set, requests carry an HMAC-SHA256 signature header.' },
    ],
    validateConfig(raw): ChannelConfig {
      const r = (raw ?? {}) as Record<string, unknown>;
      const url = String(r.url ?? '').trim();
      try { new URL(url); } catch { throw new ValidationError('url must be a valid URL'); }
      if (!opts.allowedPrefixes.some((p) => url.startsWith(p))) {
        throw new ValidationError(`url must start with one of: ${opts.allowedPrefixes.join(', ') || '(none configured)'}`);
      }
      const secret = String(r.secret ?? '').trim();
      return secret ? { url, secret } : { url };
    },
    async send(n, config) {
      const body = JSON.stringify(toPayload(n));
      const timestamp = String(Math.floor(now() / 1000));
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-EventPulse-Timestamp': timestamp };
      if (config.secret) headers['X-EventPulse-Signature'] = signature(config.secret, timestamp, body);
      let res: Response;
      try {
        // No redirects: following one could send the request to a URL outside the allowlist.
        res = await fetchFn(config.url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      } catch (err) {
        return { ok: false, retryable: true, error: `network: ${(err as Error).message}` };
      }
      return classifyWebhookResponse(res.status, await res.text().catch(() => ''));
    },
  };
}

export function toPayload(n: Notification) {
  return {
    type: 'event-pulse.notification',
    title: n.title,
    category: n.category,
    severity: n.severity,
    occurredAt: n.occurredAt,
    url: n.url,
    alert: n.alertName,
    reason: n.reason,
    synthetic: n.synthetic,
  };
}

export function signature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/** 2xx ok; 408, 429 and 5xx retryable; anything else (other 4xx, and 3xx since redirects aren't followed) permanent. */
export function classifyWebhookResponse(status: number, body: string): SendResult {
  if (status >= 200 && status < 300) return { ok: true };
  const retryable = status === 408 || status === 429 || status >= 500;
  return { ok: false, retryable, error: `HTTP ${status}: ${body.slice(0, 200) || '(empty body)'}` };
}
