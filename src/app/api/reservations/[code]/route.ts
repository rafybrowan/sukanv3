import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/format';
import { RESERVATION_INCLUDE, toReservationDTO } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/reservations/[code]?phone=08xxx — detail reservasi (public, verifikasi via nomor WA) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone') || '';
  const res = await db.reservation.findUnique({
    where: { reservationCode: decodeURIComponent(code).trim().toUpperCase() },
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!res || normalizePhone(res.phone) !== normalizePhone(phone)) {
    return Response.json({ error: 'Reservasi tidak ditemukan atau nomor WhatsApp tidak sesuai.' }, { status: 404 });
  }
  return Response.json({ reservation: toReservationDTO(res) });
}
