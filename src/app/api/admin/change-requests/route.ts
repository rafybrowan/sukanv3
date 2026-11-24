import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/admin/change-requests — daftar pengajuan perubahan */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const rows = await db.changeRequest.findMany({
    include: { reservation: { select: { reservationCode: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return Response.json({ changeRequests: rows });
}

/** PATCH /api/admin/change-requests — setujui / tolak (id di body) */
export async function PATCH(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return Response.json({ error: 'Status harus APPROVED atau REJECTED.' }, { status: 400 });
  }
  const cr = await db.changeRequest.findUnique({ where: { id } });
  if (!cr) return Response.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 });
  if (cr.status !== 'PENDING') {
    return Response.json({ error: 'Pengajuan ini sudah diproses.' }, { status: 409 });
  }
  const updated = await db.changeRequest.update({
    where: { id },
    data: { status, adminNote: body.adminNote ? String(body.adminNote) : null },
  });
  return Response.json({ changeRequest: updated });
}
