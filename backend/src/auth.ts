import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DB } from './db.js';

export interface SessionUser { id: number; email: string; role: 'user' | 'admin' }

export const SESSION_COOKIE = 'ep_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function createSessionToken(userId: number, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string, secret: string, now = Date.now()): number | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof uid === 'number' && typeof exp === 'number' && exp > now ? uid : null;
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: SESSION_TTL_MS };
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function authMiddleware(db: DB, secret: string) {
  const findUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?');
  return (req: Request, res: Response, next: NextFunction) => {
    const token = readCookie(req, SESSION_COOKIE);
    const uid = token ? readSessionToken(token, secret) : null;
    const user = uid === null ? undefined : (findUser.get(uid) as SessionUser | undefined);
    if (user) res.locals.user = user;
    next();
  };
}

export function requireUser(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) { res.status(401).json({ error: 'not logged in' }); return; }
  next();
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) { res.status(401).json({ error: 'not logged in' }); return; }
  if ((res.locals.user as SessionUser).role !== 'admin') { res.status(403).json({ error: 'admin only' }); return; }
  next();
}
