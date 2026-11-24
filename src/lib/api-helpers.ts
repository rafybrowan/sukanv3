// ===== Helper bersama untuk API routes (server-side) =====
import { db } from '@/lib/db';
import type { Schedule } from '@prisma/client';
import type { ReservationDTO } from '@/lib/types';
import type { AppSettings } from '@/lib/types';

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    pricePerPerson: Number(map.pricePerPerson ?? 25000),
    idealGroupSize: Number(map.idealGroupSize ?? 7),
    location: map.location ?? 'Desa Panembangan, Kec. Cilongok, Kab. Banyumas',
  };
}

export function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function yyMMdd(dateStr: string): string {
  return dateStr.slice(2, 4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
}

export async function generateCode(prefix: 'SRT' | 'PAY', dateStr: string): Promise<string> {
  // hitung jumlah reservation/payment dengan tanggal kode yang sama, lalu +1
  const like = `${prefix}-${yyMMdd(dateStr)}-%`;
  let seq = prefix === 'SRT'
    ? 1 + (await db.reservation.count({ where: { reservationCode: { startsWith: like } } }))
    : 1 + (await db.payment.count({ where: { transactionCode: { startsWith: like } } }));
  // pastikan unik
  for (let i = 0; i < 50; i++) {
    const code = `${prefix}-${yyMMdd(dateStr)}-${String(seq).padStart(3, '0')}`;
    const exists = prefix === 'SRT'
      ? await db.reservation.findUnique({ where: { reservationCode: code } })
      : await db.payment.findFirst({ where: { transactionCode: code } });
    if (!exists) return code;
    seq++;
  }
  return `${prefix}-${yyMMdd(dateStr)}-${Date.now().toString().slice(-5)}`;
}

export interface ScheduleWithStats {
  id: string;
  date: string;
  time: string;
  capacity: number;
  status: string;
  currentParticipants: number;
  remaining: number;
  utilization: number; // 0-100
  availability: 'TERSEDIA' | 'HAMPIR_PENUH' | 'PENUH' | 'DITUTUP' | 'DITUNDA';
  reservationCount: number;
}

export function computeScheduleStats(
  sch: Schedule,
  currentParticipants: number,
  reservationCount = 0
): ScheduleWithStats {
  const remaining = Math.max(0, sch.capacity - currentParticipants);
  const utilization = sch.capacity > 0 ? Math.round((currentParticipants / sch.capacity) * 100) : 0;
  let availability: ScheduleWithStats['availability'] = 'TERSEDIA';
  if (sch.status === 'DITUTUP') availability = 'DITUTUP';
  else if (sch.status === 'DITUNDA') availability = 'DITUNDA';
  else if (remaining <= 0) availability = 'PENUH';
  else if (utilization >= 80) availability = 'HAMPIR_PENUH';
  return {
    id: sch.id, date: sch.date, time: sch.time, capacity: sch.capacity, status: sch.status,
    currentParticipants, remaining, utilization, availability, reservationCount,
  };
}

/** Jumlah peserta terisi pada sebuah jadwal (reservasi aktif saja) */
export async function countParticipants(scheduleId: string): Promise<{ participants: number; count: number }> {
  const rows = await db.reservation.findMany({
    where: { scheduleId, reservationStatus: { not: 'DIBATALKAN' } },
    select: { participantCount: true },
  });
  return { participants: rows.reduce((s, r) => s + r.participantCount, 0), count: rows.length };
}

/** Map reservation Prisma -> DTO untuk frontend */
export function toReservationDTO(
  res: any,
  opts: { includePayment?: boolean; includeGroup?: boolean; includeChanges?: boolean } = {}
): ReservationDTO {
  const dto: any = {
    id: res.id,
    reservationCode: res.reservationCode,
    name: res.name,
    phone: res.phone,
    email: res.email,
    participantCount: res.participantCount,
    paymentParticipantCount: res.paymentParticipantCount,
    groupingOption: res.groupingOption,
    reservationStatus: res.reservationStatus,
    groupingStatus: res.groupingStatus,
    totalPrice: res.totalPrice,
    actualParticipantCount: res.actualParticipantCount,
    createdAt: res.createdAt,
    schedule: res.schedule,
  };
  if (opts.includePayment !== false && res.payment) {
    dto.payment = {
      id: res.payment.id,
      paymentMethod: res.payment.paymentMethod,
      totalAmount: res.payment.totalAmount,
      amountPaid: res.payment.amountPaid,
      remainingAmount: res.payment.remainingAmount,
      paymentStatus: res.payment.paymentStatus,
      transactionCode: res.payment.transactionCode,
      paidAt: res.payment.paidAt,
      createdAt: res.payment.createdAt,
      history: res.payment.history?.map((h: any) => ({
        id: h.id, amount: h.amount, type: h.type, transactionCode: h.transactionCode, note: h.note, createdAt: h.createdAt,
      })),
    };
  }
  if (res.groupMembers && res.groupMembers.length > 0) {
    const gm = res.groupMembers[0];
    dto.group = { groupCode: gm.group.groupCode, status: gm.group.status };
    dto.groupMembers = gm.group.members.map((m: any) => ({
      name: m.reservation.name, participantCount: m.participantCount, groupCode: gm.group.groupCode,
    }));
  }
  if (res.changeRequests) dto.changeRequests = res.changeRequests;
  return dto;
}

export const RESERVATION_INCLUDE = {
  schedule: true,
  payment: { include: { history: { orderBy: { createdAt: 'asc' as const } } } },
  groupMembers: { include: { group: { include: { members: { include: { reservation: true } } } } } },
  changeRequests: { orderBy: { createdAt: 'desc' as const } },
} as const;

// ===== Algoritma rekomendasi pengelompokan =====
export interface WaitingRes {
  id: string;
  reservationCode: string;
  name: string;
  participantCount: number;
  groupingStatus: string;
}

/**
 * Cari kombinasi reservasi waiting yang totalnya tepat 7 (ideal),
 * lalu kombinasi parsial (< 7) sebagai fallback.
 * Greedy: urutkan desc, DFS dengan pruning.
 */
export function findGroupCombos(waiting: WaitingRes[], ideal: number) {
  const exact: WaitingRes[][] = [];
  const partial: WaitingRes[][] = [];
  const sorted = [...waiting].sort((a, b) => b.participantCount - a.participantCount);
  const used = new Set<string>();

  // combo tepat ideal (7): DFS subset-sum
  const dfs = (start: number, sum: number, picked: WaitingRes[]) => {
    if (sum === ideal) { exact.push([...picked]); return; }
    if (sum > ideal || picked.length >= 5) return;
    for (let i = start; i < sorted.length; i++) {
      if (used.has(sorted[i].id)) continue;
      if (sum + sorted[i].participantCount > ideal) continue;
      used.add(sorted[i].id);
      picked.push(sorted[i]);
      dfs(i + 1, sum + sorted[i].participantCount, picked);
      picked.pop();
      used.delete(sorted[i].id);
    }
  };
  // kumpulkan hingga 4 combo non-overlap: iterasi dengan titik awal berbeda
  for (let s = 0; s < sorted.length && exact.length < 4; s++) {
    used.clear();
    dfs(s, 0, []);
  }
  // hapus combo yang overlap dengan combo sebelumnya
  const nonOverlap: WaitingRes[][] = [];
  const assigned = new Set<string>();
  for (const combo of exact) {
    if (combo.every((c) => !assigned.has(c.id))) {
      nonOverlap.push(combo);
      combo.forEach((c) => assigned.add(c.id));
    }
  }

  // parsial: reservasi tersisa yang belum terpakai (>= 2 reservasi, total < ideal)
  const rest = sorted.filter((w) => !assigned.has(w.id));
  if (rest.length >= 2) {
    const totalRest = rest.reduce((s, r) => s + r.participantCount, 0);
    if (totalRest < ideal) partial.push(rest);
  }

  return { exact: nonOverlap, partial };
}
