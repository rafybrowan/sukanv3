import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import { nextGuideCode } from '@/lib/guide-helpers';
import type { GuideDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/guides — daftar guide + statistik.
 * Query ?scheduleId=xxx -> tambah info ketersediaan utk jadwal tersebut (modal penugasan).
 * Query ?excludeAssignmentId=xxx -> penugasan tsb diabaikan saat cek bentrok
 *   (dipakai modal "Ganti Guide" agar guide saat ini tidak dianggap bentrok di kelompoknya sendiri).
 */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const scheduleId = req.nextUrl.searchParams.get('scheduleId') || undefined;
  const excludeAssignmentId = req.nextUrl.searchParams.get('excludeAssignmentId') || undefined;

  const guides = await db.guide.findMany({
    include: {
      assignments: { include: { group: true }, orderBy: { assignmentDate: 'desc' } },
    },
    orderBy: { guideCode: 'asc' },
  });

  // penugasan aktif per jadwal (untuk cek bentrok)
  let activeBySchedule: { guideId: string; groupCode: string }[] = [];
  if (scheduleId) {
    const rows = await db.guideAssignment.findMany({
      where: {
        scheduleId,
        assignmentStatus: 'DITUGASKAN',
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      },
      include: { group: true },
    });
    activeBySchedule = rows.map((r) => ({ guideId: r.guideId, groupCode: r.group.groupCode }));
  }

  const dtos: GuideDTO[] = guides.map((g) => {
    const active = g.assignments.filter((a) => a.assignmentStatus === 'DITUGASKAN');
    const current = active[0] ?? null;
    const busyOnSchedule = scheduleId
      ? activeBySchedule.find((x) => x.guideId === g.id) ?? null
      : null;

    let availableForSchedule = true;
    let unavailableReason: string | null = null;
    if (g.status === 'TIDAK_AKTIF') {
      availableForSchedule = false;
      unavailableReason = 'Guide sedang tidak aktif.';
    } else if (scheduleId && busyOnSchedule) {
      availableForSchedule = false;
      unavailableReason = `Sudah ditugaskan ke ${busyOnSchedule.groupCode} pada jadwal ini.`;
    }

    return {
      id: g.id,
      guideCode: g.guideCode,
      name: g.name,
      phone: g.phone,
      rate: g.rate,
      status: g.status as GuideDTO['status'],
      notes: g.notes,
      createdAt: g.createdAt.toISOString(),
      currentAssignment: current
        ? {
            id: current.id,
            groupCode: current.group.groupCode,
            date: current.assignmentDate,
            time: current.startTime,
            participantCount: current.participantCount,
          }
        : null,
      totalAssignments: g.assignments.filter((a) => a.assignmentStatus !== 'DIBATALKAN').length,
      completedAssignments: g.assignments.filter((a) => a.assignmentStatus === 'SELESAI').length,
      totalHonor: g.assignments
        .filter((a) => a.assignmentStatus === 'SELESAI')
        .reduce((s, a) => s + a.rate, 0),
      availableForSchedule,
      unavailableReason,
    };
  });

  return Response.json({ guides: dtos });
}

/** POST /api/admin/guides — tambah guide baru */
export async function POST(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const body = await req.json();

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const rate = Number(body.rate);
  const status = ['TERSEDIA', 'TIDAK_AKTIF'].includes(body.status) ? body.status : 'TERSEDIA';
  const notes = body.notes ? String(body.notes).trim() : null;

  if (!name || !phone) {
    return Response.json({ error: 'Nama dan nomor telepon wajib diisi.' }, { status: 400 });
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return Response.json({ error: 'Tarif/honor harus berupa angka lebih dari 0.' }, { status: 400 });
  }

  const guideCode = await nextGuideCode();
  const guide = await db.guide.create({
    data: { guideCode, name, phone, rate: Math.round(rate), status, notes },
  });

  return Response.json({ guide }, { status: 201 });
}
