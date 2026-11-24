// ===== Alur status pengelompokan (Progress Tracking) — server-side =====
// Alur utama (progress): NEW -> IN_PROGRESS -> DONE (Terbaru -> Sedang Diproses -> Selesai)
// Kondisi tambahan (condition): NORMAL | PENDING | OVERDUE — tidak mengubah alur utama.
//   PENDING : menunggu peserta / pembayaran / konfirmasi admin / keputusan pengelompokan.
//   OVERDUE : waktu keberangkatan (tanggal + jam) mendekati/melewati batas tetapi proses
//             belum selesai — ditandai otomatis oleh sistem.
import { db } from '@/lib/db';

export const PROGRESS_STATUSES = ['NEW', 'IN_PROGRESS', 'DONE'] as const;
export type GroupProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const CONDITION_STATUSES = ['NORMAL', 'PENDING', 'OVERDUE'] as const;
export type GroupConditionStatus = (typeof CONDITION_STATUSES)[number];

export const PROGRESS_STATUS_LABEL: Record<GroupProgressStatus, string> = {
  NEW: 'Terbaru',
  IN_PROGRESS: 'Sedang Diproses',
  DONE: 'Selesai',
};

export const PROGRESS_STATUS_DESC: Record<GroupProgressStatus, string> = {
  NEW: 'Reservasi/pengelompokan baru yang belum diproses.',
  IN_PROGRESS: 'Pengelompokan yang sedang ditangani oleh admin.',
  DONE: 'Pengelompokan yang telah selesai dan dikonfirmasi.',
};

export const CONDITION_STATUS_LABEL: Record<GroupConditionStatus, string> = {
  NORMAL: 'Normal',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
};

export const CONDITION_STATUS_DESC: Record<GroupConditionStatus, string> = {
  NORMAL: 'Proses berjalan normal, tidak ada hal yang ditunggu.',
  PENDING: 'Menunggu peserta, pembayaran, konfirmasi admin, atau keputusan pengelompokan.',
  OVERDUE: 'Waktu keberangkatan mendekati/melewati batas — perlu perhatian admin segera.',
};

/** Batas "mendekati waktu keberangkatan" (jam) sebelum jadwal dianggap perlu perhatian. */
export const OVERDUE_WARNING_HOURS = 3;

/** Tanggal+jam jadwal sebagai Date (WIB / Asia/Jakarta). */
export function scheduleDateTime(date: string, time: string): Date {
  // "2026-09-27" + "09:00" -> 2026-09-27T09:00:00+07:00
  return new Date(`${date}T${(time || '00:00').padStart(5, '0')}:00+07:00`);
}

/**
 * Kondisi OVERDUE: waktu keberangkatan sudah terlewat ATAU mendekati
 * (dalam OVERDUE_WARNING_HOURS jam) sementara proses pengelompokan belum selesai.
 */
export function isDepartureCritical(date: string, time: string, now = new Date()): boolean {
  const dt = scheduleDateTime(date, time);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() - now.getTime() < OVERDUE_WARNING_HOURS * 3600 * 1000;
}

/** Kelompok terlambat bila tanggal+jam jadwal sudah terlewat. */
export function isSchedulePassed(date: string, time: string, now = new Date()): boolean {
  const dt = scheduleDateTime(date, time);
  return !Number.isNaN(dt.getTime()) && dt.getTime() < now.getTime();
}

/** Catat riwayat (progress / kondisi / event) pada kelompok. */
export async function recordHistory(
  groupId: string,
  changeType: 'PROGRESS' | 'CONDITION' | 'EVENT',
  previousStatus: string | null,
  newStatus: string,
  changedBy: string,
  note?: string | null,
  createdAt?: Date
): Promise<void> {
  await db.groupStatusHistory.create({
    data: { groupId, changeType, previousStatus, newStatus, changedBy, note: note ?? null, ...(createdAt ? { createdAt } : {}) },
  });
}

/** Ubah progressStatus kelompok + catat riwayat (hanya bila benar-benar berubah). */
export async function setProgressStatus(
  groupId: string,
  newStatus: GroupProgressStatus,
  changedBy: string,
  note?: string | null
): Promise<boolean> {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) return false;
  if (group.progressStatus === newStatus) return false;
  await db.group.update({ where: { id: groupId }, data: { progressStatus: newStatus } });
  await recordHistory(groupId, 'PROGRESS', group.progressStatus, newStatus, changedBy, note);
  return true;
}

/** Ubah conditionStatus kelompok + catat riwayat (hanya bila benar-benar berubah). */
export async function setConditionStatus(
  groupId: string,
  newStatus: GroupConditionStatus,
  changedBy: string,
  note?: string | null
): Promise<boolean> {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) return false;
  if (group.conditionStatus === newStatus) return false;
  await db.group.update({ where: { id: groupId }, data: { conditionStatus: newStatus } });
  await recordHistory(groupId, 'CONDITION', group.conditionStatus, newStatus, changedBy, note);
  return true;
}

/** Catat event pengelompokan (peserta ditambah, guide ditugaskan, dll) ke timeline. */
export async function recordGroupEvent(groupId: string, changedBy: string, note: string): Promise<void> {
  const group = await db.group.findUnique({ where: { id: groupId }, select: { progressStatus: true } });
  if (!group) return;
  await recordHistory(groupId, 'EVENT', null, group.progressStatus, changedBy, note);
}

/**
 * Validasi perpindahan status utama (progress) oleh admin.
 * Return null bila sah, atau pesan error bila ditolak.
 * Aturan:
 * - Alur normal: NEW -> IN_PROGRESS -> DONE.
 * - NEW tidak boleh langsung menjadi DONE (harus melalui IN_PROGRESS).
 * - IN_PROGRESS tidak dapat kembali menjadi NEW.
 * - DONE dapat dibuka kembali menjadi IN_PROGRESS (bila ada kesalahan).
 */
export function validateProgressTransition(
  current: GroupProgressStatus,
  target: GroupProgressStatus
): string | null {
  if (current === target) {
    return `Status pengelompokan sudah ${PROGRESS_STATUS_LABEL[target]}.`;
  }
  if (current === 'NEW' && target === 'DONE') {
    return 'Pengelompokan baru harus diproses terlebih dahulu (Terbaru → Sedang Diproses) sebelum dapat diselesaikan.';
  }
  if (current === 'IN_PROGRESS' && target === 'NEW') {
    return 'Status tidak dapat dikembalikan menjadi Terbaru. Pengelompokan yang sudah diproses tetap berada di Sedang Diproses hingga selesai.';
  }
  if (current === 'DONE' && target === 'NEW') {
    return 'Pengelompokan yang sudah selesai tidak dapat dikembalikan menjadi Terbaru.';
  }
  return null;
}

/**
 * Evaluasi & perbarui kondisi otomatis untuk semua kelompok:
 * - Proses belum DONE dan waktu keberangkatan mendekati/terlewat -> OVERDUE (oleh SISTEM).
 * - Kondisi OVERDUE tetapi keadaan sudah normal kembali (proses DONE atau jadwal masih jauh)
 *   -> kembali NORMAL (oleh SISTEM).
 * Dipanggil saat admin membuka daftar kelompok. Return id kelompok yang berubah.
 */
export async function autoUpdateConditions(): Promise<string[]> {
  const now = new Date();
  const groups = await db.group.findMany({
    select: { id: true, progressStatus: true, conditionStatus: true, schedule: { select: { date: true, time: true } } },
  });
  const changed: string[] = [];
  for (const g of groups) {
    const critical = isDepartureCritical(g.schedule.date, g.schedule.time, now);
    const notDone = g.progressStatus !== 'DONE';
    if (notDone && critical && g.conditionStatus !== 'OVERDUE') {
      await db.group.update({ where: { id: g.id }, data: { conditionStatus: 'OVERDUE' } });
      await recordHistory(
        g.id,
        'CONDITION',
        g.conditionStatus,
        'OVERDUE',
        'SISTEM',
        `Waktu keberangkatan (${g.schedule.date} ${g.schedule.time} WIB) mendekati/melewati batas — proses pengelompokan belum selesai.`
      );
      changed.push(g.id);
    } else if (!notDone && g.conditionStatus === 'OVERDUE') {
      // proses selesai -> kondisi overdue tidak relevan lagi
      await db.group.update({ where: { id: g.id }, data: { conditionStatus: 'NORMAL' } });
      await recordHistory(
        g.id,
        'CONDITION',
        'OVERDUE',
        'NORMAL',
        'SISTEM',
        'Pengelompokan telah selesai — kondisi kembali normal.'
      );
      changed.push(g.id);
    }
  }
  return changed;
}

/** Hitung kondisi efektif reservasi yang belum terkelompokkan (tanpa penyimpanan). */
export function computeReservationCondition(
  date: string,
  time: string,
  paymentStatus: string | null | undefined,
  now = new Date(),
  paymentMethod?: string | null
): GroupConditionStatus {
  if (isDepartureCritical(date, time, now)) return 'OVERDUE';
  // Pembayaran hanya "menunggu" bila metode Lunas dan belum dibayar —
  // metode Bayar di Tempat memang dibayar di lokasi saat hari H,
  // sehingga tidak dianggap menunggu pembayaran.
  if (paymentMethod !== 'ONSITE' && paymentStatus && paymentStatus !== 'PAID') return 'PENDING';
  return 'NORMAL';
}
