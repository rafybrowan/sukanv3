import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createToken, ADMIN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return Response.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }
    const admin = await db.admin.findUnique({ where: { email } });
    if (!admin || !verifyPassword(password, admin.password)) {
      return Response.json({ error: 'Email atau password salah.' }, { status: 401 });
    }
    const token = createToken(admin.id);
    const res = Response.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
    res.headers.append(
      'Set-Cookie',
      `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    );
    return res;
  } catch {
    return Response.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
}
