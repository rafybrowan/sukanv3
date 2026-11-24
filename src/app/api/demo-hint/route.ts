import { db } from '@/lib/db';
import { jakartaToday } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** Hint pasangan demo untuk halaman Cek Reservasi */
export async function GET() {
  const today = jakartaToday();
  const res = await db.reservation.findFirst({
    where: { name: 'Rafy Ramadhan', reservationStatus: { not: 'DIBATALKAN' } },
    orderBy: { createdAt: 'asc' },
    select: { reservationCode: true, phone: true, name: true },
  });
  return Response.json({
    hint: res ? { code: res.reservationCode, phone: res.phone, name: res.name } : null,
    today,
  });
}
