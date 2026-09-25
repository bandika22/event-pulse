import type { Category } from '../types.js';

/** Describes one config input so the Angular app can render destination forms generically (AC9). */
export interface ConfigField {
  name: string;
  label: string;
  kind: 'text' | 'email' | 'url';
  required: boolean;
  /** Masked when destinations are listed (e.g. webhook URLs, signing secrets). */
  sensitive?: boolean;
  help?: string;
}

/** Channel-neutral notification (D21). Each channel formats it itself. */
export interface Notification {
  title: string;
  category: Category;
  severity: string;
  occurredAt: string;
  url: string | null;
  alertName: string;
  reason: string;
  synthetic: boolean;
}

export type SendResult = { ok: true } | { ok: false; retryable: boolean; error: string };

export type ChannelConfig = Record<string, string>;

export interface Channel {
  type: string;
  displayName: string;
  configFields: ConfigField[];
  /** Throws ValidationError on bad input; returns the normalized config to store. */
  validateConfig(raw: unknown): ChannelConfig;
  send(notification: Notification, config: ChannelConfig): Promise<SendResult>;
}
