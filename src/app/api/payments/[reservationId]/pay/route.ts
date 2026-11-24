import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateCode } from '@/lib/api-helpers';
import { RESERVATION_INCLUDE, toReservationDTO } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/[reservationId]/pay — SIMULASI payment gateway
 * Dipakai setelah user menekan "Bayar Sekarang" pada modal pembayaran.
 * Hanya untuk metode LUNAS (FULL_PAYMENT) yang belum dibayar —
 * metode Bayar di Tempat tidak melakukan pembayaran online.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const payment = await db.payment.findUnique({
    where: { reservationId },
    include: { reservation: { include: { schedule: true } } },
  });
  if (!payment) return Response.json({ error: 'Pembayaran tidak ditemukan.' }, { status: 404 });
  if (payment.paymentMethod === 'ONSITE') {
    return Response.json({ error: 'Metode bayar di tempat tidak memerlukan pembayaran online.' }, { status: 400 });
  }
  if (payment.paymentStatus !== 'UNPAID') {
    return Response.json({ error: 'Pembayaran untuk reservasi ini sudah diproses.' }, { status: 409 });
  }

  const dateStr = payment.reservation.schedule.date;
  const transactionCode = await generateCode('PAY', dateStr);
  const now = new Date();

  const amountPaid = payment.totalAmount;
  const remaining = 0;
  const newStatus = 'PAID';
  const historyType = 'FULL';

  await db.payment.update({
    where: { id: payment.id },
    data: {
      amountPaid,
      remainingAmount: remaining,
      paymentStatus: newStatus,
      transactionCode,
      paidAt: now,
    },
  });
  await db.paymentHistory.create({
    data: { paymentId: payment.id, amount: amountPaid, type: historyType, transactionCode, note: 'Simulasi payment gateway' },
  });
  await db.reservation.update({
    where: { id: payment.reservationId },
    data: { reservationStatus: 'TERKONFIRMASI' },
  });

  const full = await db.reservation.findUnique({
    where: { id: payment.reservationId },
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
  });

  return Response.json({
    reservation: toReservationDTO(full),
    transaction: { transactionCode, amount: amountPaid, status: newStatus },
  });
}
