import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adminId = getAdminId(req);
  if (!adminId) return unauthorized();
  const admin = await db.admin.findUnique({ where: { id: adminId }, select: { id: true, name: true, email: true } });
  if (!admin) return unauthorized();
  return Response.json({ admin });
}
