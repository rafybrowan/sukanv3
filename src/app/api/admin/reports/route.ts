import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { jakartaToday } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports?from=&to=&scheduleId=&status=&method=
 * Laporan reservasi & pendapatan untuk admin.
 */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const scheduleId = searchParams.get('scheduleId') || '';
  const status = searchParams.get('status') || '';
  const method = searchParams.get('method') || '';
  const today = jakartaToday();

  const where: any = { schedule: {} };
  if (from) where.schedule.date = { ...(where.schedule.date || {}), gte: from };
  if (to) where.schedule.date = { ...(where.schedule.date || {}), lte: to };
  if (scheduleId) where.scheduleId = scheduleId;
  if (status) where.reservationStatus = status;
  if (method) where.payment = { paymentMethod: method };

  const rows = await db.reservation.findMany({
    where,
    include: { schedule: true, payment: true, groupMembers: true },
    orderBy: [{ schedule: { date: 'asc' } }, { schedule: { time: 'asc' } }],
    take: 1000,
  });

  const active = rows.filter((r) => r.reservationStatus !== 'DIBATALKAN');
  const cancelled = rows.filter((r) => r.reservationStatus === 'DIBATALKAN');
  const groupIds = new Set<string>();
  for (const r of active) for (const gm of r.groupMembers) groupIds.add(gm.groupId);

  const sum = (fn: (r: typeof rows[number]) => number, list = active) => list.reduce((s, r) => s + fn(r), 0);

  // Tiga kelompok pembayaran saling lepas (metode-aware) — tiap reservasi aktif
  // hanya dihitung sekali di salah satu kelompok.
  const lunasCount = active.filter((r) => r.payment?.paymentStatus === 'PAID').length;
  const belumBayarCount = active.filter((r) => r.payment?.paymentStatus === 'UNPAID' && r.payment?.paymentMethod === 'FULL_PAYMENT').length;
  const onsiteCount = active.filter((r) => r.payment?.paymentStatus === 'UNPAID' && r.payment?.paymentMethod === 'ONSITE').length;

  const summary = {
    totalReservations: rows.length,
    totalParticipants: sum((r) => r.participantCount),
    totalRevenue: sum((r) => r.payment?.amountPaid || 0),
    totalPotential: sum((r) => r.totalPrice),
    lunasCount,
    belumBayarCount,
    onsiteCount,
    totalRemaining: sum((r) => r.payment?.remainingAmount || 0),
    groupCount: groupIds.size,
    cancellationCount: cancelled.length,
  };

  const table = rows.map((r) => ({
    id: r.id,
    date: r.schedule.date,
    time: r.schedule.time,
    reservationCode: r.reservationCode,
    name: r.name,
    participantCount: r.participantCount,
    paymentMethod: r.payment?.paymentMethod || null,
    paymentStatus: r.payment?.paymentStatus || null,
    totalPrice: r.totalPrice,
    amountPaid: r.payment?.amountPaid || 0,
    remainingAmount: r.payment?.remainingAmount || 0,
    reservationStatus: r.reservationStatus,
  }));

  return Response.json({ summary, table, generatedAt: new Date().toISOString(), today });
}
