import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const sch = await db.schedule.findUnique({ where: { id } });
  if (!sch) return Response.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });

  const data: any = {};
  if (body.date !== undefined || body.time !== undefined) {
    const date = String(body.date || sch.date);
    const time = String(body.time || sch.time);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!dateRe.test(date) || !timeRe.test(time)) {
      return Response.json({ error: 'Format tanggal atau jam tidak valid.' }, { status: 400 });
    }
    if (date !== sch.date || time !== sch.time) {
      const exists = await db.schedule.findUnique({ where: { date_time: { date, time } } });
      if (exists) return Response.json({ error: `Jadwal ${date} pukul ${time} sudah ada.` }, { status: 409 });
    }
    data.date = date;
    data.time = time;
  }
  if (body.capacity !== undefined) {
    const cap = Number(body.capacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 500) {
      return Response.json({ error: 'Kapasitas harus antara 1 sampai 500.' }, { status: 400 });
    }
    // cek apakah kapasitas baru < peserta terisi
    const filled = await db.reservation.aggregate({
      where: { scheduleId: id, reservationStatus: { not: 'DIBATALKAN' } },
      _sum: { participantCount: true },
    });
    const used = filled._sum.participantCount || 0;
    if (cap < used) {
      return Response.json({ error: `Kapasitas tidak boleh kurang dari peserta terisi (${used} orang).` }, { status: 400 });
    }
    data.capacity = Math.round(cap);
  }
  if (body.status !== undefined) {
    if (!['AKTIF', 'DITUTUP', 'DITUNDA'].includes(body.status)) {
      return Response.json({ error: 'Status harus AKTIF, DITUTUP, atau DITUNDA.' }, { status: 400 });
    }
    data.status = body.status;
  }
  const updated = await db.schedule.update({ where: { id }, data });
  return Response.json({ schedule: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const count = await db.reservation.count({ where: { scheduleId: id } });
  if (count > 0) {
    return Response.json(
      { error: `Tidak dapat menghapus jadwal: sudah ada ${count} reservasi. Gunakan "Ditutup" sebagai gantinya.` },
      { status: 400 }
    );
  }
  await db.schedule.delete({ where: { id } });
  return Response.json({ ok: true });
}
