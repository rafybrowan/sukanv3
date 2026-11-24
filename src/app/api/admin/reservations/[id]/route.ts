import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { RESERVATION_INCLUDE, toReservationDTO, getSettings } from '@/lib/api-helpers';
import { normalizePhone } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/reservations/[id] — edit data reservasi oleh admin */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const res = await db.reservation.findUnique({ where: { id }, include: { payment: true, schedule: true } });
  if (!res) return Response.json({ error: 'Reservasi tidak ditemukan.' }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 3) return Response.json({ error: 'Nama minimal 3 karakter.' }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) {
    const phone = normalizePhone(String(body.phone));
    if (phone.length < 10) return Response.json({ error: 'Nomor WhatsApp tidak valid.' }, { status: 400 });
    data.phone = phone;
  }
  if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;

  // ubah jumlah peserta — hanya jika pembayaran belum diproses (belum ada dana diterima)
  if (body.participantCount !== undefined) {
    const count = Number(body.participantCount);
    if (!Number.isFinite(count) || count < 1 || count > 100) {
      return Response.json({ error: 'Jumlah peserta harus 1-100.' }, { status: 400 });
    }
    const paid = !!res.payment && (res.payment.paymentStatus !== 'UNPAID' || res.payment.amountPaid > 0);
    if (paid) {
      return Response.json(
        { error: 'Jumlah peserta tidak dapat diubah karena pembayaran sudah diproses. Minta pelanggan mengajukan perubahan.' },
        { status: 409 }
      );
    }
    // cek kapasitas
    const others = await db.reservation.aggregate({
      where: { scheduleId: res.scheduleId, id: { not: id }, reservationStatus: { not: 'DIBATALKAN' } },
      _sum: { participantCount: true },
    });
    const used = others._sum.participantCount || 0;
    if (used + count > res.schedule.capacity) {
      return Response.json(
        { error: `Kapasitas tidak mencukupi. Sisa slot: ${res.schedule.capacity - used}.` },
        { status: 409 }
      );
    }
    // hitung ulang berdasarkan grouping option
    const settings = await getSettings();
    const ideal = settings.idealGroupSize;
    let payCount = count;
    let groupingStatus = res.groupingStatus;
    let groupingOption = res.groupingOption;
    if (count >= ideal) {
      groupingOption = 'COMPLETE';
      groupingStatus = 'KELOMPOK_LENGKAP';
    } else if (res.groupingOption === 'DEPART_NOW') {
      payCount = ideal;
      groupingStatus = 'SIAP_BERANGKAT';
    } else {
      groupingOption = 'WAIT_GROUP';
      groupingStatus = 'MENUNGGU_PENGELOMPOKAN';
    }
    const total = payCount * settings.pricePerPerson;
    data.participantCount = count;
    data.paymentParticipantCount = payCount;
    data.groupingOption = groupingOption;
    data.groupingStatus = groupingStatus;
    data.totalPrice = total;
    if (res.payment) {
      await db.payment.update({
        where: { id: res.payment.id },
        data: { totalAmount: total, remainingAmount: total, amountPaid: 0 },
      });
    }
  }

  await db.reservation.update({ where: { id }, data });
  const full = await db.reservation.findUnique({
    where: { id },
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
  });
  return Response.json({ reservation: toReservationDTO(full) });
}

/** POST /api/admin/reservations/[id] — aksi: cancel | confirm | complete | actual */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const action = String(body.action || '');
  const res = await db.reservation.findUnique({ where: { id }, include: { groupMembers: true, payment: true } });
  if (!res) return Response.json({ error: 'Reservasi tidak ditemukan.' }, { status: 404 });

  if (action === 'cancel') {
    // keluarkan dari kelompok jika ada
    for (const gm of res.groupMembers) {
      await db.groupMember.delete({ where: { id: gm.id } });
      const grp = await db.group.findUnique({ where: { id: gm.groupId }, include: { members: true } });
      if (grp && grp.members.length === 0) {
        await db.group.delete({ where: { id: grp.id } });
      }
    }
    if (res.payment && res.payment.paymentStatus === 'UNPAID' && res.payment.amountPaid === 0) {
      await db.payment.update({ where: { id: res.payment.id }, data: { paymentStatus: 'FAILED', remainingAmount: 0 } });
    }
    await db.reservation.update({ where: { id }, data: { reservationStatus: 'DIBATALKAN' } });
  } else if (action === 'confirm') {
    if (res.reservationStatus !== 'MENUNGGU_PEMBAYARAN') {
      return Response.json({ error: 'Hanya reservasi menunggu pembayaran yang bisa dikonfirmasi manual.' }, { status: 409 });
    }
    await db.reservation.update({ where: { id }, data: { reservationStatus: 'TERKONFIRMASI' } });
  } else if (action === 'complete') {
    await db.reservation.update({ where: { id }, data: { reservationStatus: 'SELESAI' } });
  } else if (action === 'actual') {
    const actual = Number(body.actualCount);
    if (!Number.isFinite(actual) || actual < 0 || actual > 200) {
      return Response.json({ error: 'Jumlah peserta aktual tidak valid.' }, { status: 400 });
    }
    await db.reservation.update({ where: { id }, data: { actualParticipantCount: Math.round(actual) } });
  } else {
    return Response.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  }

  const full = await db.reservation.findUnique({
    where: { id },
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
  });
  return Response.json({ reservation: toReservationDTO(full) });
}
