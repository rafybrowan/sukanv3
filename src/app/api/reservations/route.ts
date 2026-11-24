import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, generateCode, computeScheduleStats, countParticipants, jakartaToday } from '@/lib/api-helpers';
import { normalizePhone } from '@/lib/format';
import { RESERVATION_INCLUDE, toReservationDTO } from '@/lib/api-helpers';
import type { GroupingOption, PaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reservations — buat reservasi baru (public, tanpa login)
 * Body: { scheduleId, name, phone, email?, participantCount, groupingOption, paymentMethod }
 *
 * BUSINESS LOGIC KELOMPOK 7 ORANG:
 * - peserta >= 7  -> KELOMPOK LENGKAP, bayar sesuai jumlah peserta
 * - peserta < 7 + TUNGGU KUMPUL  -> MENUNGGU PENGELOMPOKAN, bayar sesuai jumlah peserta
 * - peserta < 7 + TETAP BERANGKAT -> SIAP BERANGKAT, bayar minimal 7 orang
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scheduleId = String(body.scheduleId || '');
    const name = String(body.name || '').trim();
    const phone = normalizePhone(String(body.phone || ''));
    const email = body.email ? String(body.email).trim() : null;
    let participantCount = Number(body.participantCount);
    let groupingOption = body.groupingOption as GroupingOption;
    const paymentMethod = body.paymentMethod as PaymentMethod;

    // ===== validasi dasar =====
    if (!scheduleId) return Response.json({ error: 'Jadwal belum dipilih.' }, { status: 400 });
    if (name.length < 3) return Response.json({ error: 'Nama pemesan minimal 3 karakter.' }, { status: 400 });
    if (phone.length < 10 || phone.length > 14) {
      return Response.json({ error: 'Nomor WhatsApp tidak valid (contoh: 081234567890).' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }
    if (!Number.isFinite(participantCount) || participantCount < 1 || participantCount > 100) {
      return Response.json({ error: 'Jumlah peserta harus antara 1 sampai 100 orang.' }, { status: 400 });
    }
    participantCount = Math.round(participantCount);
    if (!['FULL_PAYMENT', 'ONSITE'].includes(paymentMethod)) {
      return Response.json({ error: 'Metode pembayaran tidak valid.' }, { status: 400 });
    }

    // ===== validasi jadwal =====
    const schedule = await db.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return Response.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    if (schedule.status !== 'AKTIF') {
      return Response.json(
        { error: 'Reservasi untuk jadwal ini sementara ditutup.', code: 'SCHEDULE_CLOSED' },
        { status: 409 }
      );
    }
    if (schedule.date < jakartaToday()) {
      return Response.json({ error: 'Tidak dapat memesan jadwal yang sudah lewat.' }, { status: 409 });
    }

    // ===== CEK KAPASITAS =====
    const { participants: currentParticipants } = await countParticipants(scheduleId);
    if (currentParticipants + participantCount > schedule.capacity) {
      const remaining = Math.max(0, schedule.capacity - currentParticipants);
      return Response.json(
        {
          error: 'Kapasitas Tidak Mencukupi',
          message: `Jadwal pukul ${schedule.time} hanya memiliki ${remaining} slot tersisa.`,
          remaining,
          code: 'CAPACITY_EXCEEDED',
        },
        { status: 409 }
      );
    }

    // ===== LOGIC KELOMPOK 7 ORANG =====
    const settings = await getSettings();
    const ideal = settings.idealGroupSize; // 7
    let paymentParticipantCount: number;
    let groupingStatus: string;

    if (participantCount >= ideal) {
      groupingOption = 'COMPLETE';
      paymentParticipantCount = participantCount;
      groupingStatus = 'KELOMPOK_LENGKAP';
    } else {
      if (groupingOption !== 'WAIT_GROUP' && groupingOption !== 'DEPART_NOW') {
        return Response.json({ error: 'Pilihan pengelompokan tidak valid.' }, { status: 400 });
      }
      if (groupingOption === 'WAIT_GROUP') {
        paymentParticipantCount = participantCount;
        groupingStatus = 'MENUNGGU_PENGELOMPOKAN';
      } else {
        // Tetap Berangkat: bayar berdasarkan 7 orang
        paymentParticipantCount = ideal;
        groupingStatus = 'SIAP_BERANGKAT';
      }
    }

    const totalPrice = paymentParticipantCount * settings.pricePerPerson;

    // ===== status pembayaran awal =====
    // Dua metode: Lunas (bayar penuh online) dan Bayar di Tempat (dibayar di lokasi hari H).
    // Keduanya dimulai dari BELUM BAYAR (UNPAID) — Bayar di Tempat TIDAK dianggap sudah membayar.
    const isOnsite = paymentMethod === 'ONSITE';
    const reservationStatus = isOnsite ? 'TERKONFIRMASI' : 'MENUNGGU_PEMBAYARAN';

    const reservationCode = await generateCode('SRT', schedule.date);

    const res = await db.reservation.create({
      data: {
        reservationCode,
        scheduleId,
        name,
        phone,
        email,
        participantCount,
        paymentParticipantCount,
        groupingOption,
        reservationStatus,
        groupingStatus,
        totalPrice,
      },
    });

    const payment = await db.payment.create({
      data: {
        reservationId: res.id,
        paymentMethod,
        totalAmount: totalPrice,
        amountPaid: 0,
        remainingAmount: totalPrice,
        paymentStatus: 'UNPAID',
      },
    });

    const full = await db.reservation.findUnique({
      where: { id: res.id },
      include: { ...RESERVATION_INCLUDE, payment: { include: { history: true } } },
    });

    return Response.json({ reservation: toReservationDTO(full) }, { status: 201 });
  } catch (e: any) {
    console.error('create reservation error:', e);
    return Response.json({ error: 'Gagal membuat reservasi. Silakan coba lagi.' }, { status: 500 });
  }
}
