import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** POST /api/change-requests — user mengajukan perubahan (verifikasi kode + WA) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || '').trim().toUpperCase();
    const phone = normalizePhone(String(body.phone || ''));
    const type = String(body.type || 'OTHER');
    const requestedChange = String(body.requestedChange || '').trim();
    const reason = body.reason ? String(body.reason).trim() : null;

    if (!['RESCHEDULE', 'PARTICIPANTS', 'CANCEL', 'OTHER'].includes(type)) {
      return Response.json({ error: 'Jenis perubahan tidak valid.' }, { status: 400 });
    }
    if (requestedChange.length < 5) {
      return Response.json({ error: 'Jelaskan perubahan yang Anda ajukan (minimal 5 karakter).' }, { status: 400 });
    }
    const res = await db.reservation.findUnique({ where: { reservationCode: code } });
    if (!res || normalizePhone(res.phone) !== phone) {
      return Response.json({ error: 'Reservasi tidak ditemukan atau nomor WhatsApp tidak sesuai.' }, { status: 404 });
    }
    if (res.reservationStatus === 'DIBATALKAN') {
      return Response.json({ error: 'Reservasi sudah dibatalkan.' }, { status: 409 });
    }
    const cr = await db.changeRequest.create({
      data: { reservationId: res.id, type, requestedChange, reason, status: 'PENDING' },
    });
    return Response.json({
      changeRequest: cr,
      message: 'Pengajuan perubahan berhasil dikirim. Admin akan meninjau pengajuan Anda.',
    });
  } catch {
    return Response.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
}
