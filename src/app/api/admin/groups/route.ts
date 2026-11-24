import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { jakartaToday, getSettings, findGroupCombos } from '@/lib/api-helpers';
import { formatDateID, formatDateShort } from '@/lib/format';
import { autoUpdateConditions, computeReservationCondition, recordHistory } from '@/lib/status-workflow';
import type { RecommendationDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/groups — papan progress pengelompokan
 *  (kelompok + reservasi belum terkelompokkan + rekomendasi sistem) */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const today = jakartaToday();
  const settings = await getSettings();
  const ideal = settings.idealGroupSize;
  const now = new Date();

  // perbarui kondisi OVERDUE otomatis (tanggal + jam WIB, mendekati/terlewat, belum DONE)
  await autoUpdateConditions();

  const groups = await db.group.findMany({
    include: {
      schedule: true,
      members: { include: { reservation: { select: { id: true, reservationCode: true, name: true, participantCount: true, phone: true, reservationStatus: true, createdAt: true, payment: { select: { paymentMethod: true, paymentStatus: true, totalAmount: true, amountPaid: true, remainingAmount: true } } } } } },
      assignments: { where: { assignmentStatus: { in: ['DITUGASKAN', 'SELESAI'] } }, include: { guide: true }, orderBy: { assignedAt: 'desc' }, take: 1 },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // reservasi yang menunggu pengelompokan (belum masuk kelompok, terkonfirmasi, jadwal mendatang)
  const waitingAll = await db.reservation.findMany({
    where: {
      reservationStatus: 'TERKONFIRMASI',
      groupingStatus: { in: ['MENUNGGU_PENGELOMPOKAN', 'SIAP_BERANGKAT', 'KELOMPOK_LENGKAP'] },
      groupMembers: { none: {} },
      schedule: { date: { gte: today }, status: 'AKTIF' },
    },
    include: { schedule: true, payment: true },
    orderBy: [{ schedule: { date: 'asc' } }, { schedule: { time: 'asc' } }],
  });

  // pemakaian slot per jadwal (untuk info kapasitas kartu reservasi)
  const scheduleIds = [...new Set(waitingAll.map((r) => r.scheduleId))];
  const usageRows = scheduleIds.length
    ? await db.reservation.findMany({
        where: { scheduleId: { in: scheduleIds }, reservationStatus: { not: 'DIBATALKAN' } },
        select: { scheduleId: true, participantCount: true },
      })
    : [];
  const usage = new Map<string, number>();
  for (const u of usageRows) usage.set(u.scheduleId, (usage.get(u.scheduleId) ?? 0) + u.participantCount);

  // ===== bangun rekomendasi =====
  const recommendations: RecommendationDTO[] = [];
  const bySchedule = new Map<string, typeof waitingAll>();
  for (const r of waitingAll) {
    const key = r.scheduleId;
    if (!bySchedule.has(key)) bySchedule.set(key, []);
    bySchedule.get(key)!.push(r);
  }

  const usedInExact = new Set<string>();

  for (const [scheduleId, list] of bySchedule) {
    const sch = list[0].schedule;
    const label = `${formatDateID(sch.date)} · ${sch.time}`;

    // kelompok ideal: kombinasi tepat 7
    const waiting = list
      .filter((r) => r.groupingStatus === 'MENUNGGU_PENGELOMPOKAN' && r.participantCount < ideal)
      .map((r) => ({ id: r.id, reservationCode: r.reservationCode, name: r.name, participantCount: r.participantCount, groupingStatus: r.groupingStatus }));
    const { exact, partial } = findGroupCombos(waiting, ideal);

    for (const combo of exact) {
      combo.forEach((c) => usedInExact.add(c.id));
      const names = combo.map((c) => `${c.name} (${c.participantCount})`).join(' + ');
      recommendations.push({
        id: `ideal-${scheduleId}-${combo.map((c) => c.id).join('-')}`,
        type: 'IDEAL',
        scheduleId,
        scheduleLabel: label,
        reservations: combo.map((c) => ({ id: c.id, reservationCode: c.reservationCode, name: c.name, participantCount: c.participantCount })),
        totalParticipants: ideal,
        message: `${names} = ${ideal} orang — kelompok ideal siap dibentuk.`,
      });
    }

    // kelompok parsial (belum genap 7)
    for (const combo of partial) {
      if (combo.some((c) => usedInExact.has(c.id))) continue;
      const names = combo.map((c) => `${c.name} (${c.participantCount})`).join(' + ');
      const total = combo.reduce((s, c) => s + c.participantCount, 0);
      recommendations.push({
        id: `partial-${scheduleId}-${combo.map((c) => c.id).join('-')}`,
        type: 'PARTIAL',
        scheduleId,
        scheduleLabel: label,
        reservations: combo.map((c) => ({ id: c.id, reservationCode: c.reservationCode, name: c.name, participantCount: c.participantCount })),
        totalParticipants: total,
        message: `${names} = ${total}/${ideal} orang — kelompok parsial, masih menunggu ${ideal - total} peserta lagi.`,
      });
    }
  }

  // kandidat untuk kelompok parsial yang sudah terbentuk (ADD_TO_GROUP)
  for (const g of groups) {
    if (g.status !== 'MENUNGGU') continue;
    const total = g.members.reduce((s, m) => s + m.participantCount, 0);
    const sisa = ideal - total;
    if (sisa <= 0) continue;
    const list = waitingAll.filter(
      (r) => r.scheduleId === g.scheduleId
        && r.groupingStatus === 'MENUNGGU_PENGELOMPOKAN'
        && !usedInExact.has(r.id)
        && r.participantCount <= sisa
    );
    for (const cand of list) {
      recommendations.push({
        id: `add-${g.id}-${cand.id}`,
        type: 'ADD_TO_GROUP',
        scheduleId: g.scheduleId,
        scheduleLabel: `${formatDateShort(g.schedule.date)} · ${g.schedule.time}`,
        reservations: [{ id: cand.id, reservationCode: cand.reservationCode, name: cand.name, participantCount: cand.participantCount }],
        totalParticipants: total + cand.participantCount,
        targetGroupCode: g.groupCode,
        message: `Reservasi ${cand.reservationCode} (${cand.name}) memiliki ${cand.participantCount} peserta. Disarankan digabungkan ke ${g.groupCode} (${total}/${ideal}, sisa ${sisa} slot).`,
      });
    }
  }

  // daftar reservasi belum terkelompokkan — kartu kolom TERBARU (kondisi dihitung dinamis)
  const ungrouped = waitingAll
    .filter((r) => !usedInExact.has(r.id))
    .map((r) => ({
      id: r.id,
      reservationCode: r.reservationCode,
      name: r.name,
      phone: r.phone,
      participantCount: r.participantCount,
      groupingStatus: r.groupingStatus,
      groupingOption: r.groupingOption,
      reservationStatus: r.reservationStatus,
      totalPrice: r.totalPrice,
      scheduleId: r.scheduleId,
      date: r.schedule.date,
      time: r.schedule.time,
      condition: computeReservationCondition(r.schedule.date, r.schedule.time, r.payment?.paymentStatus, now, r.payment?.paymentMethod),
      payment: r.payment
        ? {
            paymentMethod: r.payment.paymentMethod,
            paymentStatus: r.payment.paymentStatus,
            totalAmount: r.payment.totalAmount,
            amountPaid: r.payment.amountPaid,
            remainingAmount: r.payment.remainingAmount,
          }
        : null,
      scheduleCapacity: {
        capacity: r.schedule.capacity,
        used: usage.get(r.scheduleId) ?? 0,
        remaining: Math.max(0, r.schedule.capacity - (usage.get(r.scheduleId) ?? 0)),
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

  const groupsDTO = groups.map((g) => {
    const a = g.assignments[0] ?? null;
    const membersPaid = g.members.filter((m) => m.reservation.payment?.paymentStatus === 'PAID').length;
    const paymentSummary = {
      paidCount: membersPaid,
      totalCount: g.members.length,
      allPaid: g.members.length > 0 && membersPaid === g.members.length,
      unpaidCount: g.members.length - membersPaid,
      label:
        g.members.length === 0 ? '—'
          : membersPaid === g.members.length ? 'LUNAS'
            : membersPaid === 0 ? 'BELUM LUNAS'
              : `LUNAS ${membersPaid}/${g.members.length}`,
    };
    const doneEntry = g.statusHistory.find((h) => h.changeType === 'PROGRESS' && h.newStatus === 'DONE');
    const lastActivity = [
      g.createdAt,
      ...g.statusHistory.map((h) => h.createdAt),
      ...(a ? [a.updatedAt, a.assignedAt] : []),
    ].reduce((latest, d) => (d > latest ? d : latest), g.createdAt);
    return {
      id: g.id,
      groupCode: g.groupCode,
      status: g.status,
      progressStatus: g.progressStatus,
      conditionStatus: g.conditionStatus,
      scheduleId: g.scheduleId,
      schedule: { date: g.schedule.date, time: g.schedule.time },
      createdAt: g.createdAt,
      lastActivity,
      doneAt: doneEntry?.createdAt ?? null,
      members: g.members.map((m) => ({
        id: m.id,
        participantCount: m.participantCount,
        reservation: {
          id: m.reservation.id,
          reservationCode: m.reservation.reservationCode,
          name: m.reservation.name,
          participantCount: m.reservation.participantCount,
          phone: m.reservation.phone,
          reservationStatus: m.reservation.reservationStatus,
          createdAt: m.reservation.createdAt,
          payment: m.reservation.payment
            ? {
                paymentMethod: m.reservation.payment.paymentMethod,
                paymentStatus: m.reservation.payment.paymentStatus,
                totalAmount: m.reservation.payment.totalAmount,
                amountPaid: m.reservation.payment.amountPaid,
                remainingAmount: m.reservation.payment.remainingAmount,
              }
            : null,
        },
      })),
      totalParticipants: g.members.reduce((s, m) => s + m.participantCount, 0),
      mainCustomer: g.members[0]?.reservation.name ?? null,
      mainReservationCode: g.members[0]?.reservation.reservationCode ?? null,
      paymentSummary,
      statusHistory: g.statusHistory.map((h) => ({
        id: h.id,
        changeType: h.changeType,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        changedBy: h.changedBy,
        note: h.note,
        createdAt: h.createdAt,
      })),
      guideAssignment: a
        ? {
            id: a.id,
            guideId: a.guideId,
            guideCode: a.guide.guideCode,
            guideName: a.guide.name,
            guidePhone: a.guide.phone,
            guideStatus: a.guide.status,
            assignmentStatus: a.assignmentStatus,
            paymentStatus: a.paymentStatus,
            rate: a.rate,
            participantCount: a.participantCount,
            assignmentDate: a.assignmentDate,
            startTime: a.startTime,
            assignedAt: a.assignedAt,
            completedAt: a.completedAt,
            groupCode: g.groupCode,
          }
        : null,
    };
  });

  return Response.json({ groups: groupsDTO, recommendations, ungrouped });
}

/** POST /api/admin/groups — bentuk kelompok baru dari beberapa reservasi.
 *  Kelompok baru langsung berstatus IN_PROGRESS (admin sedang memproses). */
export async function POST(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();
  const reservationIds: string[] = Array.isArray(body.reservationIds) ? body.reservationIds : [];
  if (reservationIds.length === 0) {
    return Response.json({ error: 'Pilih minimal satu reservasi.' }, { status: 400 });
  }
  const reservations = await db.reservation.findMany({
    where: { id: { in: reservationIds } },
    include: { schedule: true, groupMembers: true },
  });
  if (reservations.length !== reservationIds.length) {
    return Response.json({ error: 'Sebagian reservasi tidak ditemukan.' }, { status: 404 });
  }
  const scheduleIds = new Set(reservations.map((r) => r.scheduleId));
  if (scheduleIds.size > 1) {
    return Response.json({ error: 'Semua reservasi harus pada jadwal yang sama.' }, { status: 400 });
  }
  if (reservations.some((r) => r.groupMembers.length > 0)) {
    return Response.json({ error: 'Ada reservasi yang sudah tergabung dalam kelompok lain.' }, { status: 409 });
  }
  if (reservations.some((r) => r.reservationStatus === 'DIBATALKAN' || r.reservationStatus === 'MENUNGGU_PEMBAYARAN')) {
    return Response.json({ error: 'Hanya reservasi terkonfirmasi yang dapat dikelompokkan.' }, { status: 409 });
  }

  const settings = await getSettings();
  const ideal = settings.idealGroupSize;
  const total = reservations.reduce((s, r) => s + r.participantCount, 0);
  const count = await db.group.count();
  const groupCode = `GRP-${String(count + 1).padStart(3, '0')}`;

  const adminId = getAdminId(req)!;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  const changedBy = admin?.name || admin?.email || 'Admin';

  const isFull = total >= ideal;
  const group = await db.group.create({
    data: {
      groupCode,
      scheduleId: reservations[0].scheduleId,
      status: isFull ? 'LENGKAP' : 'MENUNGGU',
      progressStatus: 'IN_PROGRESS',
      conditionStatus: isFull ? 'NORMAL' : 'PENDING',
    },
  });
  for (const r of reservations) {
    await db.groupMember.create({ data: { groupId: group.id, reservationId: r.id, participantCount: r.participantCount } });
    await db.reservation.update({ where: { id: r.id }, data: { groupingStatus: 'TERKELOMPOK' } });
  }

  const now = new Date();
  await recordHistory(group.id, 'PROGRESS', null, 'NEW', changedBy,
    `Pengelompokan dibuat dari ${reservations.length} reservasi (${total} peserta).`, now);
  await recordHistory(group.id, 'PROGRESS', 'NEW', 'IN_PROGRESS', changedBy,
    'Admin mulai memproses pengelompokan.', new Date(now.getTime() + 1000));
  if (!isFull) {
    await recordHistory(group.id, 'CONDITION', 'NORMAL', 'PENDING', changedBy,
      `Menunggu ${ideal - total} peserta lagi untuk melengkapi kelompok.`, new Date(now.getTime() + 2000));
  }

  return Response.json({ group: { ...group, totalParticipants: total } }, { status: 201 });
}
