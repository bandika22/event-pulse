import type { DB } from '../db.js';
import type { Filters, NormalizedEvent } from '../types.js';
import { evaluateBaseline } from './importance.js';
import { matchAlert } from './matching.js';

export interface IngestResult {
  eventId: number;
  status: 'new' | 'updated' | 'unchanged';
  baselinePassed: boolean;
  notificationsCreated: number;
}

interface EventRow { id: number; first_seen_at: string; source_updated_at: string; data_json: string; baseline_passed: number }
interface AlertRow { id: number; filters_json: string }

/**
 * Upserts one normalized event and, if it passes the baseline, matches it against alerts.
 * New and revised events are both evaluated. Dedup relies on UNIQUE(alert_id, event_id):
 * a revision never re-notifies an alert, but an event revised into an alert's threshold notifies then (D8).
 */
export function ingestEvent(db: DB, event: NormalizedEvent, now: string): IngestResult {
  return db.transaction((): IngestResult => {
    const dataJson = JSON.stringify(event.data);
    const existing = db
      .prepare('SELECT id, first_seen_at, source_updated_at, data_json, baseline_passed FROM events WHERE source = ? AND source_event_id = ?')
      .get(event.source, event.sourceEventId) as EventRow | undefined;

    if (existing && existing.source_updated_at === event.sourceUpdatedAt && existing.data_json === dataJson) {
      return { eventId: existing.id, status: 'unchanged', baselinePassed: existing.baseline_passed === 1, notificationsCreated: 0 };
    }

    const verdict = evaluateBaseline(event);
    let eventId: number;
    let firstSeenAt: string;
    if (existing) {
      db.prepare(
        `UPDATE events SET title = ?, url = ?, occurred_at = ?, source_updated_at = ?, data_json = ?,
           last_updated_at = ?, baseline_passed = ?, baseline_reason = ? WHERE id = ?`,
      ).run(event.title, event.url, event.occurredAt, event.sourceUpdatedAt, dataJson, now, verdict.passed ? 1 : 0, verdict.reason, existing.id);
      eventId = existing.id;
      firstSeenAt = existing.first_seen_at;
    } else {
      const res = db.prepare(
        `INSERT INTO events (source, source_event_id, category, title, url, occurred_at, source_updated_at, data_json,
           synthetic, first_seen_at, last_updated_at, baseline_passed, baseline_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(event.source, event.sourceEventId, event.category, event.title, event.url, event.occurredAt, event.sourceUpdatedAt,
        dataJson, event.synthetic ? 1 : 0, now, now, verdict.passed ? 1 : 0, verdict.reason);
      eventId = Number(res.lastInsertRowid);
      firstSeenAt = now;
    }

    const status = existing ? 'updated' : 'new';
    if (!verdict.passed) return { eventId, status, baselinePassed: false, notificationsCreated: 0 };

    // D18 (no backfill): only alerts that existed when the event was first seen.
    const alerts = db
      .prepare('SELECT id, filters_json FROM alerts WHERE category = ? AND enabled = 1 AND created_at <= ?')
      .all(event.category, firstSeenAt) as AlertRow[];

    const insertNotification = db.prepare(
      'INSERT OR IGNORE INTO notifications (alert_id, event_id, reason, created_at) VALUES (?, ?, ?, ?)',
    );
    const destinationsOf = db.prepare('SELECT destination_id FROM alert_destinations WHERE alert_id = ?');
    const insertDelivery = db.prepare(
      `INSERT INTO deliveries (notification_id, destination_id, status, attempts, next_attempt_at, created_at)
       VALUES (?, ?, 'pending', 0, ?, ?)`,
    );

    let created = 0;
    for (const alert of alerts) {
      const match = matchAlert(JSON.parse(alert.filters_json) as Filters, event);
      if (!match.matched) continue;
      const res = insertNotification.run(alert.id, eventId, match.reason, now);
      if (res.changes === 0) continue; // already notified for this event (AC10)
      created++;
      const notificationId = Number(res.lastInsertRowid);
      for (const { destination_id } of destinationsOf.all(alert.id) as { destination_id: number }[]) {
        insertDelivery.run(notificationId, destination_id, now, now);
      }
    }
    return { eventId, status, baselinePassed: true, notificationsCreated: created };
  })();
}
