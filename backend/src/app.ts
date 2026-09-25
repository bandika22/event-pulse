import express, { type NextFunction, type Request, type Response } from 'express';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  authMiddleware, createSessionToken, requireAdmin, requireUser, SESSION_COOKIE, sessionCookieOptions, verifyPassword,
  type SessionUser,
} from './auth.js';
import type { ChannelRegistry } from './channels/registry.js';
import type { ChannelConfig } from './channels/types.js';
import type { DB } from './db.js';
import { retryDelivery } from './delivery/worker.js';
import { ingestEvent } from './pipeline/ingest.js';
import { validateFilters } from './pipeline/importance.js';
import { normalizeSynthetic } from './sources/synthetic.js';
import { CATEGORIES, NotFoundError, ValidationError, type Category } from './types.js';

export interface AppDeps {
  db: DB;
  registry: ChannelRegistry;
  sessionSecret: string;
  syntheticFixturesDir: string;
  pollUsgsNow?: () => Promise<unknown>;
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const { db, registry } = deps;
  const now = deps.now ?? (() => new Date());
  const app = express();
  app.use(express.json());
  app.use(authMiddleware(db, deps.sessionSecret));
  const me = (res: Response) => res.locals.user as SessionUser;

  // --- auth ---
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const row = db.prepare('SELECT id, email, role, password_hash FROM users WHERE email = ?').get(String(email ?? '').trim().toLowerCase()) as
      (SessionUser & { password_hash: string }) | undefined;
    if (!row || !verifyPassword(String(password ?? ''), row.password_hash)) { res.status(401).json({ error: 'invalid email or password' }); return; }
    res.cookie(SESSION_COOKIE, createSessionToken(row.id, deps.sessionSecret), sessionCookieOptions());
    res.json({ id: row.id, email: row.email, role: row.role });
  });
  app.post('/api/auth/logout', (_req, res) => { res.clearCookie(SESSION_COOKIE, { path: '/' }); res.json({ ok: true }); });
  app.get('/api/auth/me', requireUser, (_req, res) => { res.json(me(res)); });

  // --- channels and destinations (D7) ---
  app.get('/api/channels', requireUser, (_req, res) => {
    res.json(registry.list().map((c) => ({ type: c.type, displayName: c.displayName, configFields: c.configFields })));
  });

  app.get('/api/destinations', requireUser, (_req, res) => {
    const rows = db.prepare('SELECT id, channel_type, label, config_json, created_at FROM destinations WHERE user_id = ? ORDER BY id')
      .all(me(res).id) as { id: number; channel_type: string; label: string; config_json: string; created_at: string }[];
    res.json(rows.map((r) => ({
      id: r.id, channelType: r.channel_type, label: r.label, createdAt: r.created_at,
      config: maskConfig(registry, r.channel_type, JSON.parse(r.config_json)),
    })));
  });

  app.post('/api/destinations', requireUser, (req, res) => {
    const { channelType, label, config } = req.body ?? {};
    const channel = registry.get(String(channelType));
    if (!channel) throw new ValidationError(`unknown channel type: ${channelType}`);
    const cleanLabel = String(label ?? '').trim() || channel.displayName;
    const cfg = channel.validateConfig(config);
    const r = db.prepare('INSERT INTO destinations (user_id, channel_type, label, config_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(me(res).id, channel.type, cleanLabel, JSON.stringify(cfg), now().toISOString());
    res.status(201).json({ id: Number(r.lastInsertRowid), channelType: channel.type, label: cleanLabel, config: maskConfig(registry, channel.type, cfg) });
  });

  // --- alerts (AC1). No edit/pause/delete for users (nice-to-have, not built). ---
  app.get('/api/alerts', requireUser, (_req, res) => {
    res.json(listAlerts(db, 'WHERE a.user_id = ?', [me(res).id]));
  });

  app.post('/api/alerts', requireUser, (req, res) => {
    const { name, category, filters, destinationIds } = req.body ?? {};
    const cleanName = String(name ?? '').trim();
    if (!cleanName) throw new ValidationError('name is required');
    if (!CATEGORIES.includes(category)) throw new ValidationError(`category must be one of: ${CATEGORIES.join(', ')}`);
    const f = validateFilters(category as Category, filters);
    const ids = Array.isArray(destinationIds) ? [...new Set(destinationIds.map(Number))] : [];
    if (ids.length === 0) throw new ValidationError('at least one destination is required');
    const owned = db.prepare(`SELECT COUNT(*) AS n FROM destinations WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`)
      .get(me(res).id, ...ids) as { n: number };
    if (owned.n !== ids.length) throw new ValidationError('unknown destination');

    const id = db.transaction(() => {
      const r = db.prepare('INSERT INTO alerts (user_id, name, category, filters_json, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)')
        .run(me(res).id, cleanName, category, JSON.stringify(f), now().toISOString());
      const alertId = Number(r.lastInsertRowid);
      const link = db.prepare('INSERT INTO alert_destinations (alert_id, destination_id) VALUES (?, ?)');
      for (const d of ids) link.run(alertId, d);
      return alertId;
    })();
    res.status(201).json(listAlerts(db, 'WHERE a.id = ?', [id])[0]);
  });

  // --- admin (D13) ---
  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/users', (_req, res) => {
    res.json(db.prepare(
      `SELECT u.id, u.email, u.role, u.created_at AS createdAt, COUNT(a.id) AS alertCount
         FROM users u LEFT JOIN alerts a ON a.user_id = u.id GROUP BY u.id ORDER BY u.id`,
    ).all());
  });

  admin.get('/alerts', (_req, res) => { res.json(listAlerts(db, '', [])); });

  admin.post('/alerts/:id/:action', (req, res) => {
    const action = req.params.action;
    if (action !== 'disable' && action !== 'enable') throw new NotFoundError('unknown action');
    const r = db.prepare('UPDATE alerts SET enabled = ? WHERE id = ?').run(action === 'enable' ? 1 : 0, Number(req.params.id));
    if (r.changes === 0) throw new NotFoundError('alert not found');
    res.json(listAlerts(db, 'WHERE a.id = ?', [Number(req.params.id)])[0]);
  });

  admin.get('/events', (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const rows = db.prepare(
      `SELECT e.id, e.source, e.source_event_id AS sourceEventId, e.category, e.title, e.url, e.occurred_at AS occurredAt,
              e.first_seen_at AS firstSeenAt, e.last_updated_at AS lastUpdatedAt, e.synthetic, e.data_json,
              e.baseline_passed AS baselinePassed, e.baseline_reason AS baselineReason,
              (SELECT COUNT(*) FROM notifications n WHERE n.event_id = e.id) AS notificationCount
         FROM events e ORDER BY e.last_updated_at DESC, e.id DESC LIMIT ?`,
    ).all(limit) as Record<string, unknown>[];
    res.json(rows.map(({ data_json, synthetic, baselinePassed, ...r }) => ({
      ...r, synthetic: synthetic === 1, baselinePassed: baselinePassed === 1, data: JSON.parse(String(data_json)),
    })));
  });

  admin.post('/events/inject', (req, res) => {
    const event = normalizeSynthetic(req.body, now());
    res.status(201).json(ingestEvent(db, event, now().toISOString()));
  });

  admin.post('/fixtures/replay', (_req, res) => {
    const results = [];
    for (const file of readdirSync(deps.syntheticFixturesDir).filter((f) => f.endsWith('.json')).sort()) {
      const items = JSON.parse(readFileSync(join(deps.syntheticFixturesDir, file), 'utf8')) as unknown[];
      for (const item of items) {
        results.push({ file, ...ingestEvent(db, normalizeSynthetic(item, now()), now().toISOString()) });
      }
    }
    res.json(results);
  });

  admin.get('/deliveries', (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    const rows = db.prepare(
      `SELECT d.id, d.status, d.attempts, d.last_error AS lastError, d.next_attempt_at AS nextAttemptAt, d.sent_at AS sentAt,
              d.created_at AS createdAt, dest.channel_type AS channelType, dest.label AS destinationLabel,
              a.id AS alertId, a.name AS alertName, u.email AS userEmail, e.id AS eventId, e.title AS eventTitle
         FROM deliveries d
         JOIN destinations dest ON dest.id = d.destination_id
         JOIN notifications n ON n.id = d.notification_id
         JOIN alerts a ON a.id = n.alert_id
         JOIN users u ON u.id = a.user_id
         JOIN events e ON e.id = n.event_id
        ${status ? 'WHERE d.status = ?' : ''}
        ORDER BY d.id DESC LIMIT 200`,
    ).all(...(status ? [status] : [])) as { id: number }[];
    const attemptsOf = db.prepare('SELECT attempt, at, ok, retryable, error FROM delivery_attempts WHERE delivery_id = ? ORDER BY attempt');
    res.json(rows.map((r) => ({ ...r, attemptLog: attemptsOf.all(r.id) })));
  });

  admin.post('/deliveries/:id/retry', (req, res) => {
    if (!retryDelivery(db, Number(req.params.id), now())) throw new ValidationError('only failed deliveries can be retried');
    res.json({ ok: true });
  });

  admin.get('/sources', (_req, res) => {
    res.json(db.prepare('SELECT source, last_success_at AS lastSuccessAt, last_error AS lastError, last_error_at AS lastErrorAt FROM source_status').all());
  });

  admin.post('/sources/usgs/poll', async (_req, res) => {
    if (!deps.pollUsgsNow) throw new ValidationError('USGS polling is disabled');
    res.json(await deps.pollUsgsNow());
  });

  app.use('/api/admin', admin);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) { res.status(400).json({ error: err.message }); return; }
    if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return; }
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

function maskConfig(registry: ChannelRegistry, type: string, cfg: ChannelConfig): ChannelConfig {
  const fields = registry.get(type)?.configFields ?? [];
  const out: ChannelConfig = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = fields.find((f) => f.name === k)?.sensitive ? `${v.slice(0, 24)}…` : v;
  }
  return out;
}

function listAlerts(db: DB, where: string, params: unknown[]) {
  const rows = db.prepare(
    `SELECT a.id, a.name, a.category, a.filters_json, a.enabled, a.created_at AS createdAt, u.email AS userEmail,
            (SELECT COUNT(*) FROM notifications n WHERE n.alert_id = a.id) AS notificationCount
       FROM alerts a JOIN users u ON u.id = a.user_id ${where} ORDER BY a.id`,
  ).all(...params) as { id: number; filters_json: string; enabled: number }[];
  const dests = db.prepare('SELECT destination_id FROM alert_destinations WHERE alert_id = ? ORDER BY destination_id');
  return rows.map(({ filters_json, enabled, ...r }) => ({
    ...r,
    enabled: enabled === 1,
    filters: JSON.parse(filters_json),
    destinationIds: (dests.all(r.id) as { destination_id: number }[]).map((d) => d.destination_id),
  }));
}
