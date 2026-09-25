import type { AppConfig } from '../config.js';
import { createEmailChannel } from './email.js';
import { createRegistry, type ChannelRegistry } from './registry.js';
import { createSlackChannel } from './slack.js';
import { createWebhookChannel } from './webhook.js';

/** The registration point: adding a channel means a new file plus an entry here (AC9). */
export function buildChannels(config: AppConfig): ChannelRegistry {
  return createRegistry([
    createEmailChannel(config.smtp),
    createSlackChannel({ allowedPrefixes: config.slackAllowedPrefixes }),
    createWebhookChannel({ allowedPrefixes: config.webhookAllowedPrefixes }),
  ]);
}
