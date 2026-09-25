import nodemailer from 'nodemailer';
import { ValidationError } from '../types.js';
import { plainTextLines } from './format.js';
import type { Channel, SendResult } from './types.js';

export interface EmailOptions { host: string; port: number; from: string }

export function createEmailChannel(opts: EmailOptions): Channel {
  const transport = nodemailer.createTransport({ host: opts.host, port: opts.port, secure: false });
  return {
    type: 'email',
    displayName: 'Email',
    configFields: [{ name: 'address', label: 'Email address', kind: 'email', required: true }],
    validateConfig(raw) {
      const address = String((raw as Record<string, unknown> | null)?.address ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new ValidationError('a valid email address is required');
      return { address };
    },
    async send(n, config) {
      const lines = plainTextLines(n);
      try {
        await transport.sendMail({
          from: opts.from,
          to: config.address,
          subject: `[Event Pulse] ${n.title}`,
          text: lines.join('\n'),
          html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(''),
        });
        return { ok: true };
      } catch (err) {
        return classifySmtpError(err);
      }
    },
  };
}

/**
 * SMTP replies: 5xx = permanent (e.g. unknown mailbox), 4xx = transient.
 * nodemailer sets err.responseCode from the server's reply (verified in its smtp-connection source);
 * connection failures have no responseCode and are treated as transient.
 */
export function classifySmtpError(err: unknown): SendResult {
  const e = err as { responseCode?: number; code?: string; message?: string };
  const error = `${e.responseCode ?? e.code ?? 'error'}: ${e.message ?? String(err)}`;
  const permanent = typeof e.responseCode === 'number' && e.responseCode >= 500 && e.responseCode < 600;
  return { ok: false, retryable: !permanent, error };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
