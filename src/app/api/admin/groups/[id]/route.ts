import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { getSettings } from '@/lib/api-helpers';
import { syncGuideStatus } from '@/lib/guide-helpers';
import {
  PROGRESS_STATUSES, CONDITION_STATUSES, setProgressStatus, setConditionStatus,
  recordGroupEvent, validateProgressTransition, PROGRESS_STATUS_LABEL, CONDITION_STATUS_LABEL,
  type GroupProgressStatus,
} from '@/lib/status-workflow';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/groups/[id] — aksi kelompok
 * Body: { action: 'add' | 'finalize' | 'disband' | 'status' | 'condition',
 *         reservationId?, progressStatus?, conditionStatus?, note? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminId(req)) return unauthorized();
  const { id } = await params;
  const body = await req.json();
  const action = String(body.action || '');
  const group = await db.group.findUnique({
    where: { id },
    include: { members: true, assignments: { where: { assignmentStatus: 'DITUGASKAN' }, include: { guide: true } } },
  });
  if (!group) return Response.json({ error: 'Kelompok tidak ditemukan.' }, { status: 404 });
  const settings = await getSettings();
  const ideal = settings.idealGroupSize;

  const adminId = getAdminId(req)!;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  const changedBy = admin?.name || admin?.email || 'Admin';

  if (action === 'add') {
    const reservationId = String(body.reservationId || '');
    const res = await db.reservation.findUnique({ where: { id: reservationId }, include: { groupMembers: true, schedule: true } });
    if (!res) return Response.json({ error: 'Reservasi tidak ditemukan.' }, { status: 404 });
    if (res.groupMembers.length > 0) {
      return Response.json({ error: 'Reservasi ini sudah tergabung dalam kelompok lain.' }, { status: 409 });
    }
    if (res.scheduleId !== group.scheduleId) {
      return Response.json({ error: 'Reservasi harus pada jadwal yang sama dengan kelompok.' }, { status: 409 });
    }
    if (res.reservationStatus !== 'TERKONFIRMASI') {
      return Response.json({ error: 'Hanya reservasi terkonfirmasi yang dapat dikelompokkan.' }, { status: 409 });
    }
    const total = group.members.reduce((s, m) => s + m.participantCount, 0);
    if (total + res.participantCount > ideal) {
      return Response.json(
        { error: `Tidak dapat digabungkan: kelompok ${group.groupCode} hanya sisa ${ideal - total} slot.` },
        { status: 409 }
      );
    }
    await db.groupMember.create({
      data: { groupId: group.id, reservationId: res.id, participantCount: res.participantCount },
    });
    await db.reservation.update({ where: { id: res.id }, data: { groupingStatus: 'TERKELOMPOK' } });
    const newTotal = total + res.participantCount;
    await recordGroupEvent(group.id, changedBy, `Peserta berhasil dikelompokkan: ${res.name} (+${res.participantCount}, total ${newTotal} peserta).`);
    if (newTotal >= ideal) {
      await db.group.update({ where: { id: group.id }, data: { status: 'LENGKAP' } });
      // kelompok genap — tidak lagi menunggu peserta
      await setConditionStatus(group.id, 'NORMAL', changedBy, `Kelompok genap ${newTotal} peserta — siap konfirmasi & penugasan guide.`);
    } else if (group.conditionStatus !== 'PENDING') {
      await setConditionStatus(group.id, 'PENDING', changedBy, `Menunggu ${ideal - newTotal} peserta lagi untuk melengkapi kelompok.`);
    }
    // menambah peserta adalah bagian dari proses — pastikan tidak tertinggal di TERBARU
    if (group.progressStatus === 'NEW') {
      await setProgressStatus(group.id, 'IN_PROGRESS', changedBy, 'Admin mulai memproses pengelompokan.');
    }
  } else if (action === 'finalize') {
    await db.group.update({ where: { id }, data: { status: 'LENGKAP' } });
    await recordGroupEvent(group.id, changedBy, `Kelompok dikonfirmasi — total ${group.members.reduce((s, m) => s + m.participantCount, 0)} peserta.`);
    // konfirmasi adalah bagian dari proses — pastikan tidak tertinggal di TERBARU
    if (group.progressStatus === 'NEW') {
      await setProgressStatus(group.id, 'IN_PROGRESS', changedBy, 'Admin mulai memproses pengelompokan.');
    }
    if (group.conditionStatus === 'PENDING') {
      await setConditionStatus(group.id, 'NORMAL', changedBy, 'Kelompok dikonfirmasi — tidak lagi menunggu peserta.');
    }
  } else if (action === 'status') {
    // ===== ubah status utama (progress): NEW -> IN_PROGRESS -> DONE =====
    const target = String(body.progressStatus || '') as GroupProgressStatus;
    if (!PROGRESS_STATUSES.includes(target)) {
      return Response.json({ error: 'Status progress tidak valid.' }, { status: 400 });
    }
    const error = validateProgressTransition(group.progressStatus as GroupProgressStatus, target);
    if (error) return Response.json({ error }, { status: 409 });
    const note = body.note ? String(body.note).trim() : null;
    const changed = await setProgressStatus(id, target, changedBy, note);
    if (!changed) {
      return Response.json({ error: `Status pengelompokan sudah ${PROGRESS_STATUS_LABEL[target]}.` }, { status: 400 });
    }
    // pengelompokan selesai -> kondisi overdue/pending tidak relevan lagi
    if (target === 'DONE' && group.conditionStatus !== 'NORMAL') {
      await setConditionStatus(id, 'NORMAL', 'SISTEM', 'Pengelompokan telah selesai — kondisi kembali normal.');
    }
    return Response.json({
      ok: true,
      message: `Status pengelompokan ${group.groupCode} diubah menjadi ${PROGRESS_STATUS_LABEL[target]}.`,
    });
  } else if (action === 'condition') {
    // ===== ubah status kondisi (NORMAL <-> PENDING; OVERDUE otomatis oleh sistem) =====
    const target = String(body.conditionStatus || '');
    if (!CONDITION_STATUSES.includes(target as any)) {
      return Response.json({ error: 'Status kondisi tidak valid.' }, { status: 400 });
    }
    if (target === 'OVERDUE') {
      return Response.json(
        { error: 'Status kondisi Overdue ditentukan otomatis oleh sistem berdasarkan waktu keberangkatan.' },
        { status: 409 }
      );
    }
    if (group.conditionStatus === 'OVERDUE') {
      return Response.json(
        { error: 'Kondisi kelompok saat ini Overdue (ditentukan sistem berdasarkan waktu keberangkatan) dan tidak dapat diubah manual.' },
        { status: 409 }
      );
    }
    if (group.conditionStatus === target) {
      return Response.json({ error: `Kondisi kelompok sudah ${CONDITION_STATUS_LABEL[target]}.` }, { status: 400 });
    }
    const note = body.note ? String(body.note).trim() : null;
    const changed = await setConditionStatus(id, target as any, changedBy, note);
    if (!changed) {
      return Response.json({ error: 'Tidak ada perubahan kondisi.' }, { status: 400 });
    }
    return Response.json({
      ok: true,
      message: `Kondisi ${group.groupCode} diubah menjadi ${CONDITION_STATUS_LABEL[target]}.`,
    });
  } else if (action === 'disband') {
    // batalkan penugasan guide aktif, lalu hapus record penugasan milik grup ini
    for (const a of group.assignments) {
      await db.guideAssignment.update({ where: { id: a.id }, data: { assignmentStatus: 'DIBATALKAN' } });
      await syncGuideStatus(a.guideId);
    }
    await db.guideAssignment.deleteMany({ where: { groupId: group.id } });
    for (const m of group.members) {
      const res = await db.reservation.findUnique({ where: { id: m.reservationId } });
      if (res) {
        const backStatus =
          res.groupingOption === 'DEPART_NOW' ? 'SIAP_BERANGKAT'
            : res.groupingOption === 'COMPLETE' ? 'KELOMPOK_LENGKAP'
              : 'MENUNGGU_PENGELOMPOKAN';
        await db.reservation.update({ where: { id: res.id }, data: { groupingStatus: backStatus } });
      }
      await db.groupMember.delete({ where: { id: m.id } });
    }
    await db.group.delete({ where: { id } });
  } else {
    return Response.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  }

  return Response.json({ ok: true });
}
