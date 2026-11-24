import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { generateCode } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payments/[id]/settle — konfirmasi pembayaran yang telah diterima admin.
 * - Metode BAYAR DI TEMPAT: pelanggan membayar di lokasi, admin mengonfirmasi -> LUNAS
 *   (metode pembayaran tetap BAYAR DI TEMPAT).
 * - Metode LUNAS yang belum dibayar: admin mengonfirmasi bukti pembayaran penuh -> LUNAS.
 * Body: { note? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  let body: any = {};
  try { body = await req.json(); } catch { /* body opsional */ }
  const payment = await db.payment.findUnique({ where: { id }, include: { reservation: { include: { schedule: true } } } });
  if (!payment) return Response.json({ error: 'Pembayaran tidak ditemukan.' }, { status: 404 });
  if (payment.reservation.reservationStatus === 'DIBATALKAN') {
    return Response.json({ error: 'Reservasi ini telah dibatalkan — pembayaran tidak dapat dikonfirmasi.' }, { status: 409 });
  }

  // Dapat dikonfirmasi bila pembayaran belum diterima penuh (status BELUM BAYAR).
  const settleable = payment.paymentStatus === 'UNPAID' && payment.remainingAmount > 0;
  if (!settleable) {
    return Response.json({ error: 'Pembayaran ini tidak memerlukan konfirmasi.' }, { status: 409 });
  }

  const amount = payment.remainingAmount;
  const dateStr = payment.reservation.schedule.date;
  const transactionCode = await generateCode('PAY', dateStr);
  const now = new Date();
  const isOnsite = payment.paymentMethod === 'ONSITE';

  await db.payment.update({
    where: { id },
    data: {
      amountPaid: payment.totalAmount,
      remainingAmount: 0,
      paymentStatus: 'PAID',
      transactionCode,
      paidAt: payment.paidAt || now,
    },
  });
  await db.paymentHistory.create({
    data: {
      paymentId: id,
      amount,
      type: isOnsite ? 'ONSITE' : 'FULL',
      transactionCode,
      note: body.note || (isOnsite ? 'Dibayar di lokasi' : 'Pembayaran penuh dikonfirmasi admin'),
    },
  });

  const updated = await db.payment.findUnique({
    where: { id },
    include: { reservation: { include: { schedule: true } }, history: { orderBy: { createdAt: 'asc' } } },
  });
  return Response.json({ payment: updated });
}
