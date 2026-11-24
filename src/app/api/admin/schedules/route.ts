import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();
  const date = String(body.date || '').trim();
  const time = String(body.time || '').trim();
  const capacity = Number(body.capacity);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!dateRe.test(date) || !timeRe.test(time)) {
    return Response.json({ error: 'Format tanggal (YYYY-MM-DD) atau jam (HH:mm) tidak valid.' }, { status: 400 });
  }
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) {
    return Response.json({ error: 'Kapasitas harus antara 1 sampai 500.' }, { status: 400 });
  }
  const exists = await db.schedule.findUnique({ where: { date_time: { date, time } } });
  if (exists) {
    return Response.json({ error: `Jadwal ${date} pukul ${time} sudah tersedia.` }, { status: 409 });
  }
  const sch = await db.schedule.create({ data: { date, time, capacity: Math.round(capacity), status: 'AKTIF' } });
  return Response.json({ schedule: sch });
}
