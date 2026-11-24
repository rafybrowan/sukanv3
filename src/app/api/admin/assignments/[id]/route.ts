import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { guideUnavailableReason, syncGuideStatus, syncGroupStatus, toAssignmentDTO } from '@/lib/guide-helpers';
import { recordGroupEvent } from '@/lib/status-workflow';

export const dynamic = 'force-dynamic';

async function adminName(req: NextRequest): Promise<string> {
  const adminId = getAdminId(req)!;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  return admin?.name || admin?.email || 'Admin';
}

/**
 * POST /api/admin/assignments/[id] — aksi penugasan.
 * Body: { action: 'change' | 'complete' | 'cancel' | 'honor', guideId?, paymentStatus? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const action = String(body.action || '');

  const assignment = await db.guideAssignment.findUnique({
    where: { id },
    include: { guide: true, group: true, schedule: true },
  });
  if (!assignment) return Response.json({ error: 'Penugasan tidak ditemukan.' }, { status: 404 });

  // ===== GANTI GUIDE =====
  if (action === 'change') {
    if (assignment.assignmentStatus !== 'DITUGASKAN') {
      return Response.json({ error: 'Guide hanya dapat diganti sebelum kegiatan selesai.' }, { status: 409 });
    }
    const newGuideId = String(body.guideId || '');
    if (newGuideId === assignment.guideId) {
      return Response.json({ error: 'Guide baru tidak boleh sama dengan guide saat ini.' }, { status: 400 });
    }
    const reason = await guideUnavailableReason(newGuideId, assignment.scheduleId, assignment.id);
    if (reason) return Response.json({ error: reason }, { status: 409 });

    const newGuide = await db.guide.findUnique({ where: { id: newGuideId } });
    const oldGuideId = assignment.guideId;

    await db.guideAssignment.update({
      where: { id },
      data: {
        guideId: newGuideId,
        rate: newGuide!.rate, // honor mengikuti tarif guide baru
      },
    });
    // status guide lama kembali TERSEDIA bila tak ada penugasan aktif lain
    await syncGuideStatus(oldGuideId);
    await syncGuideStatus(newGuideId);

    // catat event penggantian guide (status utama tidak berubah)
    await recordGroupEvent(
      assignment.groupId,
      await adminName(req),
      `Guide diganti dari ${assignment.guide.name} menjadi ${newGuide!.name}.`
    );

    const updated = await db.guideAssignment.findUnique({ where: { id }, include: { guide: true, group: true } });
    return Response.json({
      assignment: toAssignmentDTO(updated),
      message: `Guide ${assignment.group.groupCode} diganti dari ${assignment.guide.name} menjadi ${newGuide!.name}.`,
    });
  }

  // ===== TANDAI SELESAI =====
  if (action === 'complete') {
    if (assignment.assignmentStatus !== 'DITUGASKAN') {
      return Response.json({ error: 'Hanya penugasan berstatus DITUGASKAN yang dapat diselesaikan.' }, { status: 409 });
    }
    await db.guideAssignment.update({
      where: { id },
      data: {
        assignmentStatus: 'SELESAI',
        completedAt: new Date(),
        paymentStatus: 'SIAP_DIBAYARKAN', // kegiatan selesai -> honor siap dibayar
      },
    });
    await syncGuideStatus(assignment.guideId);
    // catat event selesai — status utama pengelompokan tidak berubah (admin yang menentukan)
    await recordGroupEvent(
      assignment.groupId,
      await adminName(req),
      `Kegiatan selesai — honor ${assignment.guide.name} tercatat, administrasi penugasan lengkap.`
    );
    return Response.json({
      ok: true,
      message: `Penugasan ${assignment.group.groupCode} selesai. Honor ${assignment.guide.name} (${assignment.rate}) masuk daftar honor.`,
    });
  }

  // ===== BATALKAN =====
  if (action === 'cancel') {
    if (assignment.assignmentStatus !== 'DITUGASKAN') {
      return Response.json({ error: 'Penugasan yang sudah selesai tidak dapat dibatalkan.' }, { status: 409 });
    }
    await db.guideAssignment.update({
      where: { id },
      data: { assignmentStatus: 'DIBATALKAN' },
    });
    await syncGuideStatus(assignment.guideId);
    await syncGroupStatus(assignment.groupId);
    // guide hilang -> catat event, admin perlu menugaskan guide lain
    await recordGroupEvent(
      assignment.groupId,
      await adminName(req),
      'Penugasan guide dibatalkan — tugaskan guide lain agar kelompok siap.'
    );
    return Response.json({
      ok: true,
      message: `Penugasan guide untuk ${assignment.group.groupCode} dibatalkan. Silakan tugaskan guide lain.`,
    });
  }

  // ===== UBAH STATUS HONOR =====
  if (action === 'honor') {
    const ps = String(body.paymentStatus || '');
    if (!['BELUM_DIPROSES', 'SIAP_DIBAYARKAN', 'SUDAH_DIBAYARKAN'].includes(ps)) {
      return Response.json({ error: 'Status honor tidak valid.' }, { status: 400 });
    }
    // transisi sah: BELUM_DIPROSES -> SIAP_DIBAYARKAN -> SUDAH_DIBAYARKAN
    const order = ['BELUM_DIPROSES', 'SIAP_DIBAYARKAN', 'SUDAH_DIBAYARKAN'];
    const from = order.indexOf(assignment.paymentStatus);
    const to = order.indexOf(ps);
    if (to < from) {
      return Response.json({ error: 'Status honor tidak dapat mundur.' }, { status: 409 });
    }
    if (ps === 'SUDAH_DIBAYARKAN' && assignment.assignmentStatus !== 'SELESAI') {
      return Response.json(
        { error: 'Honor hanya dapat dibayar setelah penugasan ditandai SELESAI.' },
        { status: 409 }
      );
    }
    await db.guideAssignment.update({ where: { id }, data: { paymentStatus: ps } });
    return Response.json({ ok: true, message: `Status honor ${assignment.guide.name} diperbarui.` });
  }

  return Response.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
}
