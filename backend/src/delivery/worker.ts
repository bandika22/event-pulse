import type { ChannelRegistry } from '../channels/registry.js';
import type { Notification, SendResult } from '../channels/types.js';
import type { DB } from '../db.js';
import { fmtPct } from '../pipeline/importance.js';
import type { Category } from '../types.js';

// D11: retry with backoff up to a limit, then mark failed. Delays apply after attempts 1, 2, 3.
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

interface DueRow {
  id: number;
  attempts: number;
  channel_type: string;
  config_json: string;
  alert_name: string;
  reason: string;
  title: string;
  category: Category;
  url: string | null;
  occurred_at: string;
  data_json: string;
  synthetic: number;
}

export async function processDueDeliveries(db: DB, registry: ChannelRegistry, now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const due = db.prepare(
    `SELECT d.id, d.attempts, dest.channel_type, dest.config_json, a.name AS alert_name, n.reason,
            e.title, e.category, e.url, e.occurred_at, e.data_json, e.synthetic
       FROM deliveries d
       JOIN destinations dest ON dest.id = d.destination_id
       JOIN notifications n ON n.id = d.notification_id
       JOIN alerts a ON a.id = n.alert_id
       JOIN events e ON e.id = n.event_id
      WHERE d.status IN ('pending', 'retrying') AND d.next_attempt_at <= ?
      ORDER BY d.next_attempt_at
      LIMIT 20`,
  ).all(nowIso) as DueRow[];

  for (const row of due) {
    const result = await attempt(registry, row);
    recordAttempt(db, row, result, now);
  }
  return due.length;
}

async function attempt(registry: ChannelRegistry, row: DueRow): Promise<SendResult> {
  const channel = registry.get(row.channel_type);
  if (!channel) return { ok: false, retryable: false, error: `unknown channel type: ${row.channel_type}` };
  let config;
  try {
    config = channel.validateConfig(JSON.parse(row.config_json));
  } catch (err) {
    // Retrying won't fix a destination whose stored config no longer validates.
    return { ok: false, retryable: false, error: `invalid destination config: ${(err as Error).message}` };
  }
  try {
    return await channel.send(toNotification(row), config);
  } catch (err) {
    // A channel that throws instead of returning a SendResult: don't lose the delivery, retry it.
    return { ok: false, retryable: true, error: `channel threw: ${(err as Error).message}` };
  }
}

function recordAttempt(db: DB, row: DueRow, result: SendResult, now: Date): void {
  const attemptNo = row.attempts + 1;
  const nowIso = now.toISOString();
  db.transaction(() => {
    db.prepare('INSERT INTO delivery_attempts (delivery_id, attempt, at, ok, retryable, error) VALUES (?, ?, ?, ?, ?, ?)')
      .run(row.id, attemptNo, nowIso, result.ok ? 1 : 0, result.ok ? null : result.retryable ? 1 : 0, result.ok ? null : result.error);
    if (result.ok) {
      db.prepare("UPDATE deliveries SET status = 'sent', attempts = ?, sent_at = ?, next_attempt_at = NULL, last_error = NULL WHERE id = ?")
        .run(attemptNo, nowIso, row.id);
    } else if (result.retryable && attemptNo < MAX_ATTEMPTS) {
      const next = new Date(now.getTime() + RETRY_DELAYS_MS[attemptNo - 1]).toISOString();
      db.prepare("UPDATE deliveries SET status = 'retrying', attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?")
        .run(attemptNo, result.error, next, row.id);
    } else {
      db.prepare("UPDATE deliveries SET status = 'failed', attempts = ?, last_error = ?, next_attempt_at = NULL WHERE id = ?")
        .run(attemptNo, result.error, row.id);
    }
  })();
}

/** Admin manual retry (D11): queues one more attempt for a failed delivery. */
export function retryDelivery(db: DB, deliveryId: number, now: Date = new Date()): boolean {
  const res = db.prepare("UPDATE deliveries SET status = 'pending', next_attempt_at = ? WHERE id = ? AND status = 'failed'")
    .run(now.toISOString(), deliveryId);
  return res.changes === 1;
}

export function toNotification(row: Pick<DueRow, 'alert_name' | 'reason' | 'title' | 'category' | 'url' | 'occurred_at' | 'data_json' | 'synthetic'>): Notification {
  const data = JSON.parse(row.data_json);
  const severity =
    row.category === 'earthquake' ? `M${data.magnitude}`
      : row.category === 'market' ? `${data.symbol} ${fmtPct(data.changePct)}`
        : 'Headline';
  return {
    title: row.title,
    category: row.category,
    severity,
    occurredAt: row.occurred_at,
    url: row.url,
    alertName: row.alert_name,
    reason: row.reason,
    synthetic: row.synthetic === 1,
  };
}

export function startWorker(db: DB, registry: ChannelRegistry, tickMs: number): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await processDueDeliveries(db, registry); }
    catch (err) { console.error('[worker]', err); }
    finally { running = false; }
  }, tickMs);
  return () => clearInterval(timer);
}
