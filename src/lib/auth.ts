// ===== Autentikasi Admin (server-side) =====
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';

const SECRET = process.env.ADMIN_SESSION_SECRET || 'sukan-river-tubing-prototype-secret-2026';
export const ADMIN_COOKIE = 'srt_admin_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pw, salt, 64).toString('hex');
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return test.length === ref.length && timingSafeEqual(test, ref);
}

export function createToken(adminId: string): string {
  const exp = Date.now() + SESSION_DURATION_MS;
  const payload = `${adminId}.${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(b64, 'base64url').toString();
  } catch {
    return null;
  }
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [adminId, expStr] = payload.split('.');
  if (!adminId || !expStr || Number(expStr) < Date.now()) return null;
  return adminId;
}

/** Ambil adminId dari cookie session pada request. null jika tidak valid. */
export function getAdminId(req: NextRequest): string | null {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function unauthorized(): Response {
  return Response.json({ error: 'Tidak diizinkan. Silakan login sebagai admin.' }, { status: 401 });
}
