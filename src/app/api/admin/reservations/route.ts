import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { RESERVATION_INCLUDE, toReservationDTO } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/admin/reservations?date=&time=&status=&method=&paymentStatus=&groupStatus=&q= */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';
  const status = searchParams.get('status') || '';
  const method = searchParams.get('method') || '';
  const paymentStatus = searchParams.get('paymentStatus') || '';
  const groupStatus = searchParams.get('groupStatus') || '';
  const q = (searchParams.get('q') || '').trim();

  const where: any = {};
  if (date) where.schedule = { ...(where.schedule || {}), date };
  if (time) where.schedule = { ...(where.schedule || {}), time };
  if (status) where.reservationStatus = status;
  if (groupStatus) where.groupingStatus = groupStatus;
  if (method || paymentStatus) {
    where.payment = {};
    if (method) where.payment.paymentMethod = method;
    if (paymentStatus) where.payment.paymentStatus = paymentStatus;
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { reservationCode: { contains: q.toUpperCase() } },
      { phone: { contains: q } },
    ];
  }

  const rows = await db.reservation.findMany({
    where,
    include: { ...RESERVATION_INCLUDE, payment: { include: { history: { orderBy: { createdAt: 'asc' } } } } },
    orderBy: [{ schedule: { date: 'asc' } }, { schedule: { time: 'asc' } }, { createdAt: 'asc' }],
    take: 500,
  });

  return Response.json({ reservations: rows.map((r) => toReservationDTO(r)) });
}
