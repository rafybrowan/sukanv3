import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { computeScheduleStats, jakartaToday } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/schedules?date=YYYY-MM-DD  (default: hari ini s/d +21 hari) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const from = date || jakartaToday();
  const where: any = { date: date ? from : { gte: from } };

  const schedules = await db.schedule.findMany({
    where,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });

  // hitung peserta terisi per jadwal (sekali query)
  const activeRes = await db.reservation.findMany({
    where: { scheduleId: { in: schedules.map((s) => s.id) }, reservationStatus: { not: 'DIBATALKAN' } },
    select: { scheduleId: true, participantCount: true },
  });
  const fillMap = new Map<string, { participants: number; count: number }>();
  for (const r of activeRes) {
    const cur = fillMap.get(r.scheduleId) || { participants: 0, count: 0 };
    cur.participants += r.participantCount;
    cur.count += 1;
    fillMap.set(r.scheduleId, cur);
  }

  const result = schedules.map((s) => {
    const f = fillMap.get(s.id) || { participants: 0, count: 0 };
    return computeScheduleStats(s, f.participants, f.count);
  });

  return Response.json({ schedules: result, today: jakartaToday() });
}
