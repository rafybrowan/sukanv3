// ===== Helper modul Pemandu / Guide (server-side) =====
import { db } from '@/lib/db';

/**
 * Sinkronkan status seorang guide berdasarkan penugasan aktifnya:
 * - punya penugasan DITUGASKAN  -> DITUGASKAN
 * - tidak punya                 -> TERSEDIA (TIDAK_AKTIF tidak pernah diubah otomatis)
 */
export async function syncGuideStatus(guideId: string): Promise<void> {
  const guide = await db.guide.findUnique({ where: { id: guideId } });
  if (!guide || guide.status === 'TIDAK_AKTIF') return;
  const activeCount = await db.guideAssignment.count({
    where: { guideId, assignmentStatus: 'DITUGASKAN' },
  });
  const next = activeCount > 0 ? 'DITUGASKAN' : 'TERSEDIA';
  if (next !== guide.status) {
    await db.guide.update({ where: { id: guideId }, data: { status: next } });
  }
}

/** Sinkronkan status grup: punya penugasan aktif -> SIAP_BERANGKAT, tidak -> LENGKAP (bila sebelumnya SIAP_BERANGKAT) */
export async function syncGroupStatus(groupId: string): Promise<void> {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) return;
  const active = await db.guideAssignment.findFirst({
    where: { groupId, assignmentStatus: 'DITUGASKAN' },
  });
  if (active && group.status === 'LENGKAP') {
    await db.group.update({ where: { id: groupId }, data: { status: 'SIAP_BERANGKAT' } });
  } else if (!active && group.status === 'SIAP_BERANGKAT') {
    await db.group.update({ where: { id: groupId }, data: { status: 'LENGKAP' } });
  }
}

/**
 * Validasi ketersediaan guide untuk sebuah jadwal.
 * Return null jika tersedia, atau string alasan jika tidak.
 */
export async function guideUnavailableReason(
  guideId: string,
  scheduleId: string,
  currentAssignmentId?: string
): Promise<string | null> {
  const guide = await db.guide.findUnique({ where: { id: guideId } });
  if (!guide) return 'Guide tidak ditemukan.';
  if (guide.status === 'TIDAK_AKTIF') return `${guide.name} sedang tidak aktif.`;

  // bentrok: penugasan aktif lain pada jadwal yang sama
  const clash = await db.guideAssignment.findFirst({
    where: {
      guideId,
      scheduleId,
      assignmentStatus: 'DITUGASKAN',
      ...(currentAssignmentId ? { id: { not: currentAssignmentId } } : {}),
    },
    include: { group: true },
  });
  if (clash) {
    return `${guide.name} sudah ditugaskan ke ${clash.group.groupCode} pada jadwal yang sama.`;
  }
  return null;
}

/** Generate kode guide berikutnya: G-001, G-002, … */
export async function nextGuideCode(): Promise<string> {
  const count = await db.guide.count();
  for (let i = count + 1; i < count + 50; i++) {
    const code = `G-${String(i).padStart(3, '0')}`;
    const exists = await db.guide.findUnique({ where: { guideCode: code } });
    if (!exists) return code;
  }
  return `G-${Date.now().toString().slice(-5)}`;
}

/** Map GuideAssignment (prisma, dengan include guide & group) -> DTO ringkas */
export function toAssignmentDTO(a: any) {
  return {
    id: a.id,
    guideId: a.guideId,
    guideCode: a.guide?.guideCode ?? '',
    guideName: a.guide?.name ?? '',
    guidePhone: a.guide?.phone ?? '',
    groupId: a.groupId,
    groupCode: a.group?.groupCode ?? '',
    scheduleId: a.scheduleId,
    assignmentDate: a.assignmentDate,
    startTime: a.startTime,
    participantCount: a.participantCount,
    rate: a.rate,
    assignmentStatus: a.assignmentStatus,
    paymentStatus: a.paymentStatus,
    assignedAt: a.assignedAt,
    completedAt: a.completedAt,
  };
}

export const ASSIGNMENT_INCLUDE = {
  guide: true,
  group: true,
  schedule: true,
} as const;
