import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/admin/payments?method=&status=&date=&q= — manajemen pembayaran */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const method = searchParams.get('method') || '';
  const status = searchParams.get('status') || '';
  const date = searchParams.get('date') || '';
  const q = (searchParams.get('q') || '').trim();

  const where: any = { reservation: {} };
  if (method) where.paymentMethod = method;
  if (status) where.paymentStatus = status;
  if (date) where.reservation = { schedule: { date } };
  if (q) {
    where.reservation = {
      ...(where.reservation || {}),
      OR: [{ name: { contains: q } }, { reservationCode: { contains: q.toUpperCase() } }],
    };
  }

  const rows = await db.payment.findMany({
    where,
    include: {
      reservation: { include: { schedule: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return Response.json({ payments: rows });
}
