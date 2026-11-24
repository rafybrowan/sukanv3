import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/format';
import { RESERVATION_INCLUDE, toReservationDTO } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

async function findByCodeAndPhone(code: string, phone: string) {
  const normalized = normalizePhone(phone);
  const res = await db.reservation.findUnique({
    where: { reservationCode: code.trim().toUpperCase() },
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!res) return null;
  if (normalizePhone(res.phone) !== normalized) return null;
  return res;
}

/** POST /api/reservations/check — cek reservasi dengan kode + nomor WhatsApp */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || '').trim();
    const phone = String(body.phone || '').trim();
    if (!code || !phone) {
      return Response.json({ error: 'Kode reservasi dan nomor WhatsApp wajib diisi.' }, { status: 400 });
    }
    const res = await findByCodeAndPhone(code, phone);
    if (!res) {
      return Response.json(
        { error: 'Reservasi tidak ditemukan. Periksa kembali kode reservasi dan nomor WhatsApp Anda.' },
        { status: 404 }
      );
    }
    return Response.json({ reservation: toReservationDTO(res) });
  } catch {
    return Response.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
}
