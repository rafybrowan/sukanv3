import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { guideUnavailableReason, syncGuideStatus, syncGroupStatus, toAssignmentDTO } from '@/lib/guide-helpers';
import { recordGroupEvent } from '@/lib/status-workflow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/assignments — daftar penugasan (dasar halaman Honor Guide).
 * Query: ?date=YYYY-MM-DD &guideId= &paymentStatus= (BELUM_DIPROSES|SIAP_DIBAYARKAN|SUDAH_DIBAYARKAN)
 *         &assignmentStatus= &upcoming=1 (hanya DITUGASKAN)
 */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date') || undefined;
  const guideId = sp.get('guideId') || undefined;
  const paymentStatus = sp.get('paymentStatus') || undefined;
  const assignmentStatus = sp.get('assignmentStatus') || undefined;

  const where: Record<string, unknown> = {
    assignmentStatus: { not: 'DIBATALKAN' },
    ...(date ? { assignmentDate: date } : {}),
    ...(guideId ? { guideId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(assignmentStatus ? { assignmentStatus } : {}),
  };

  const assignments = await db.guideAssignment.findMany({
    where,
    include: { guide: true, group: true, schedule: true },
    orderBy: [{ assignmentDate: 'desc' }, { startTime: 'asc' }],
    take: 300,
  });

  const rows = assignments.map(toAssignmentDTO);
  const allActive = rows.filter((a: any) => a.assignmentStatus !== 'DIBATALKAN');
  const summary = {
    totalAssignments: allActive.length,
    totalHonor: allActive.reduce((s: number, a: any) => s + a.rate, 0),
    honorUnpaid: allActive
      .filter((a: any) => a.paymentStatus !== 'SUDAH_DIBAYARKAN')
      .reduce((s: number, a: any) => s + a.rate, 0),
    honorPaid: allActive
      .filter((a: any) => a.paymentStatus === 'SUDAH_DIBAYARKAN')
      .reduce((s: number, a: any) => s + a.rate, 0),
  };

  return Response.json({ assignments: rows, summary });
}

/**
 * POST /api/admin/assignments — tugaskan guide ke kelompok.
 * Body: { groupId, guideId }
 * Aturan: kelompok harus berstatus LENGKAP (dikonfirmasi), guide tersedia utk jadwal tsb,
 * kelompok belum punya penugasan aktif.
 */
export async function POST(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();
  const groupId = String(body.groupId || '');
  const guideId = String(body.guideId || '');

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { schedule: true, members: true, assignments: { where: { assignmentStatus: 'DITUGASKAN' } } },
  });
  if (!group) return Response.json({ error: 'Kelompok tidak ditemukan.' }, { status: 404 });

  if (group.status === 'MENUNGGU') {
    return Response.json(
      { error: `Kelompok ${group.groupCode} belum dikonfirmasi. Konfirmasikan kelompok terlebih dahulu sebelum menugaskan guide.` },
      { status: 409 }
    );
  }
  if (group.assignments.length > 0) {
    return Response.json(
      { error: `Kelompok ${group.groupCode} sudah memiliki guide aktif. Gunakan "Ganti Guide" bila ingin mengubah.` },
      { status: 409 }
    );
  }

  const reason = await guideUnavailableReason(guideId, group.scheduleId);
  if (reason) return Response.json({ error: reason }, { status: 409 });

  const guide = await db.guide.findUnique({ where: { id: guideId } });
  const total = group.members.reduce((s, m) => s + m.participantCount, 0);

  const assignment = await db.guideAssignment.create({
    data: {
      guideId,
      groupId: group.id,
      scheduleId: group.scheduleId,
      assignmentDate: group.schedule.date,
      startTime: group.schedule.time,
      participantCount: total,
      rate: guide!.rate,
      assignmentStatus: 'DITUGASKAN',
      paymentStatus: 'BELUM_DIPROSES',
    },
  });

  await syncGuideStatus(guideId);
  await syncGroupStatus(group.id);

  // catat event penugasan guide ke timeline pengelompokan
  // (tidak mengubah status utama — penugasan guide adalah bagian dari proses IN_PROGRESS)
  const adminId = getAdminId(req)!;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  await recordGroupEvent(
    group.id,
    admin?.name || admin?.email || 'Admin',
    `Guide ${guide!.name} (${guide!.guideCode}) ditugaskan ke kelompok.`
  );

  const created = await db.guideAssignment.findUnique({
    where: { id: assignment.id },
    include: { guide: true, group: true },
  });

  return Response.json(
    { assignment: toAssignmentDTO(created), message: `${guide!.name} ditugaskan ke ${group.groupCode}.` },
    { status: 201 }
  );
}
