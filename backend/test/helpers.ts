import { openDb, type DB } from '../src/db.js';
import type { Category, Filters, NormalizedEvent } from '../src/types.js';

export const T0 = '2026-09-25T10:00:00.000Z';
export const T1 = '2026-09-25T11:00:00.000Z';
export const T2 = '2026-09-25T12:00:00.000Z';

export function makeDb(): DB {
  return openDb(':memory:');
}

export function addUser(db: DB, email = 'u@example.com', role: 'user' | 'admin' = 'user'): number {
  return Number(db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, 'x', ?, ?)").run(email, role, T0).lastInsertRowid);
}

export function addDestination(db: DB, userId: number, channelType = 'email', config: Record<string, string> = { address: 'u@example.com' }): number {
  return Number(db.prepare('INSERT INTO destinations (user_id, channel_type, label, config_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, channelType, channelType, JSON.stringify(config), T0).lastInsertRowid);
}

export function addAlert(db: DB, opts: { userId: number; category: Category; filters: Filters; destinationIds: number[]; createdAt?: string; enabled?: boolean }): number {
  const id = Number(db.prepare('INSERT INTO alerts (user_id, name, category, filters_json, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(opts.userId, `alert-${opts.category}`, opts.category, JSON.stringify(opts.filters), opts.enabled === false ? 0 : 1, opts.createdAt ?? T0).lastInsertRowid);
  for (const d of opts.destinationIds) db.prepare('INSERT INTO alert_destinations (alert_id, destination_id) VALUES (?, ?)').run(id, d);
  return id;
}

export function quake(id: string, magnitude: number, updatedAt = T1): NormalizedEvent {
  return {
    source: 'usgs', sourceEventId: id, category: 'earthquake', title: `M ${magnitude} - Somewhere`, url: null,
    occurredAt: T1, sourceUpdatedAt: updatedAt, synthetic: false, data: { magnitude, place: 'Somewhere' },
  };
}

export function count(db: DB, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
