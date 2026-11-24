import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { jakartaToday, getSettings } from '@/lib/api-helpers';
import { addDaysStr } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** GET /api/admin/stats — data kartu & grafik dashboard */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const today = jakartaToday();
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const [totalReservations, reservationsTodayRows, waitingGrouping, allActiveRows] = await Promise.all([
    db.reservation.count(),
    db.reservation.findMany({
      where: { schedule: { date: today }, reservationStatus: { not: 'DIBATALKAN' } },
      select: { id: true, participantCount: true },
    }),
    db.reservation.count({ where: { groupingStatus: 'MENUNGGU_PENGELOMPOKAN', reservationStatus: 'TERKONFIRMASI' } }),
    db.reservation.findMany({
      where: { reservationStatus: { not: 'DIBATALKAN' } },
      select: { participantCount: true },
    }),
  ]);

  const payments = await db.payment.findMany({
    where: { reservation: { reservationStatus: { not: 'DIBATALKAN' } } },
    select: { paymentMethod: true, paymentStatus: true, amountPaid: true, remainingAmount: true },
  });

  // Tiga kelompok pembayaran saling lepas (metode-aware):
  // Belum Bayar = Lunas (online) yang belum dibayar; Lunas = pembayaran penuh diterima;
  // Bayar di Tempat = memilih metode di lokasi dan belum menyelesaikan pembayaran.
  const unpaidCount = payments.filter((p) => p.paymentStatus === 'UNPAID' && p.paymentMethod === 'FULL_PAYMENT').length;
  const paidCount = payments.filter((p) => p.paymentStatus === 'PAID').length;
  const onsitePendingCount = payments.filter((p) => p.paymentStatus === 'UNPAID' && p.paymentMethod === 'ONSITE').length;

  const activeSchedules = await db.schedule.count({ where: { status: 'AKTIF', date: { gte: today } } });

  // ===== grafik 14 hari terakhir =====
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(addDaysStr(today, -i));
  const pastRes = await db.reservation.findMany({
    where: { schedule: { date: { in: days } } },
    select: { id: true, participantCount: true, totalPrice: true, reservationStatus: true, payment: { select: { amountPaid: true } }, schedule: { select: { date: true } } },
  });
  const perDay = days.map((d) => {
    const rows = pastRes.filter((r) => r.schedule.date === d && r.reservationStatus !== 'DIBATALKAN');
    return {
      date: d,
      reservations: rows.length,
      participants: rows.reduce((s, r) => s + r.participantCount, 0),
      revenue: rows.reduce((s, r) => s + (r.payment?.amountPaid || 0), 0),
    };
  });

  // ===== metode pembayaran =====
  const methodCounts = [
    { method: 'FULL_PAYMENT', label: 'Lunas', value: payments.filter((p) => p.paymentMethod === 'FULL_PAYMENT').length },
    { method: 'ONSITE', label: 'Bayar di Tempat', value: payments.filter((p) => p.paymentMethod === 'ONSITE').length },
  ];

  // ===== tingkat kapasitas 7 hari ke depan =====
  const upcomingDays: string[] = [];
  for (let i = 0; i <= 6; i++) upcomingDays.push(addDaysStr(today, i));
  const upcomingSchedules = await db.schedule.findMany({
    where: { date: { in: upcomingDays } },
    select: { id: true, date: true, capacity: true },
  });
  const fills = await db.reservation.findMany({
    where: { scheduleId: { in: upcomingSchedules.map((s) => s.id) }, reservationStatus: { not: 'DIBATALKAN' } },
    select: { scheduleId: true, participantCount: true },
  });
  const capacityPerDay = upcomingDays.map((d) => {
    const schs = upcomingSchedules.filter((s) => s.date === d);
    const cap = schs.reduce((s, x) => s + x.capacity, 0);
    const filled = schs.reduce((s, x) => {
      return s + fills.filter((f) => f.scheduleId === x.id).reduce((ss, f) => ss + f.participantCount, 0);
    }, 0);
    return { date: d, capacity: cap, filled, utilization: cap > 0 ? Math.round((filled / cap) * 100) : 0 };
  });

  // ===== reservasi terbaru =====
  const latest = await db.reservation.findMany({
    include: { schedule: true, payment: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  // ===== statistik pemandu / guide =====
  const [guideAvailable, guideOnDuty, groupsWOGuide, assignmentsToday, guideAssignments] = await Promise.all([
    db.guide.count({ where: { status: 'TERSEDIA' } }),
    db.guide.count({ where: { status: 'DITUGASKAN' } }),
    db.group.count({
      where: {
        status: 'LENGKAP',
        schedule: { date: { gte: today } }, // hanya kegiatan hari ini/mendatang
        assignments: { none: { assignmentStatus: 'DITUGASKAN' } },
      },
    }),
    db.guideAssignment.count({ where: { assignmentDate: today, assignmentStatus: 'DITUGASKAN' } }),
    db.guideAssignment.findMany({
      where: { assignmentStatus: { in: ['DITUGASKAN', 'SELESAI'] } },
      select: { rate: true, paymentStatus: true, assignmentStatus: true, assignmentDate: true },
    }),
  ]);

  const guideStats = {
    guideAvailable,
    guideOnDuty,
    groupsWithoutGuide: groupsWOGuide,
    assignmentsToday,
    honorUnprocessed: guideAssignments
      .filter((a) => a.paymentStatus === 'BELUM_DIPROSES')
      .reduce((s, a) => s + a.rate, 0),
    honorReady: guideAssignments
      .filter((a) => a.paymentStatus === 'SIAP_DIBAYARKAN')
      .reduce((s, a) => s + a.rate, 0),
    honorThisMonth: guideAssignments
      .filter((a) => a.assignmentStatus === 'SELESAI' && a.assignmentDate.startsWith(monthPrefix))
      .reduce((s, a) => s + a.rate, 0),
  };

  return Response.json({
    cards: {
      totalReservations,
      reservationsToday: reservationsTodayRows.length,
      totalParticipants: allActiveRows.reduce((s, r) => s + r.participantCount, 0),
      waitingGrouping,
      unpaidCount,
      paidCount,
      onsitePendingCount,
      activeSchedules,
    },
    charts: { perDay, methodCounts, capacityPerDay },
    guideStats,
    latest: latest.map((r) => ({
      id: r.id,
      reservationCode: r.reservationCode,
      name: r.name,
      date: r.schedule.date,
      time: r.schedule.time,
      participantCount: r.participantCount,
      reservationStatus: r.reservationStatus,
      paymentMethod: r.payment?.paymentMethod || null,
      paymentStatus: r.payment?.paymentStatus || null,
      totalPrice: r.totalPrice,
    })),
  });
}
