import { ValidationError } from '../types.js';
import type { Channel, Notification, SendResult } from './types.js';

export interface SlackOptions { allowedPrefixes: string[]; fetchFn?: typeof fetch }

export function createSlackChannel(opts: SlackOptions): Channel {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    type: 'slack',
    displayName: 'Slack',
    configFields: [{
      name: 'webhookUrl',
      label: 'Incoming webhook URL',
      kind: 'url',
      required: true,
      sensitive: true,
      help: 'Create one in Slack under Apps → Incoming Webhooks. Messages go to the channel chosen there.',
    }],
    validateConfig(raw) {
      const webhookUrl = String((raw as Record<string, unknown> | null)?.webhookUrl ?? '').trim();
      try { new URL(webhookUrl); } catch { throw new ValidationError('webhookUrl must be a valid URL'); }
      if (!opts.allowedPrefixes.some((p) => webhookUrl.startsWith(p))) {
        throw new ValidationError(`webhookUrl must start with one of: ${opts.allowedPrefixes.join(', ')}`);
      }
      return { webhookUrl };
    },
    async send(n, config) {
      let res: Response;
      try {
        res = await fetchFn(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: formatSlackText(n) }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        return { ok: false, retryable: true, error: `network: ${(err as Error).message}` };
      }
      return classifySlackResponse(res.status, await res.text().catch(() => ''));
    },
  };
}

/**
 * Verified in Phase 4: an invalid workspace returns 404 with a plain-text body (`no_team`), not JSON.
 * Slack's docs list 400/403/404 error strings (invalid_payload, no_service, channel_is_archived, ...),
 * all of which are permanent. 429 isn't documented for webhooks; it's retried as standard HTTP practice.
 */
export function classifySlackResponse(status: number, body: string): SendResult {
  if (status >= 200 && status < 300) return { ok: true };
  const retryable = status === 429 || status >= 500;
  return { ok: false, retryable, error: `HTTP ${status}: ${body.slice(0, 200) || '(empty body)'}` };
}

export function formatSlackText(n: Notification): string {
  const lines = [
    `*${esc(n.title)}*`,
    `${esc(n.severity)} · ${n.category}${n.synthetic ? ' _(synthetic demo data)_' : ''}`,
    `Why: ${esc(n.reason)}`,
    `Alert: ${esc(n.alertName)}`,
  ];
  if (n.url) lines.push(`<${n.url}|Source>`);
  return lines.join('\n');
}

// Slack mrkdwn requires escaping these three characters in message text.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
