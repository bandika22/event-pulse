const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  dbPath: env.DB_PATH ?? 'data/event-pulse.db',
  sessionSecret: env.SESSION_SECRET ?? 'dev-only-secret-change-me',
  smtp: {
    host: env.SMTP_HOST ?? 'localhost',
    port: Number(env.SMTP_PORT ?? 1025), // Mailpit's SMTP port (verified in Phase 4)
    from: env.MAIL_FROM ?? 'Event Pulse <alerts@event-pulse.local>',
  },
  // Webhook URLs are user-supplied and the server POSTs to them, so restrict targets (SSRF).
  // The localhost entry is for the local Slack stub.
  slackAllowedPrefixes: (env.SLACK_ALLOWED_PREFIXES ?? 'https://hooks.slack.com/,http://localhost:4010/')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  usgs: {
    enabled: env.USGS_ENABLED !== 'false',
    feedUrl: env.USGS_FEED_URL ?? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    pollMs: Number(env.USGS_POLL_MS ?? 120_000),
  },
  workerTickMs: Number(env.WORKER_TICK_MS ?? 5_000),
};

export type AppConfig = typeof config;
