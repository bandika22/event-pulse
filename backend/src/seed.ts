import { hashPassword } from './auth.js';
import type { DB } from './db.js';

// D12: seeded demo accounts. Credentials are documented in the README; they are demo-only.
export const DEMO_USERS = [
  { email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { email: 'alice@example.com', password: 'alice123', role: 'user' },
] as const;

export function seedDemoUsers(db: DB, now = new Date().toISOString()): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return false;
  const insert = db.prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)');
  for (const u of DEMO_USERS) insert.run(u.email, hashPassword(u.password), u.role, now);
  return true;
}
