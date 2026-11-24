'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  RESERVATION_STATUS_LABEL, GROUPING_STATUS_LABEL, PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL, AVAILABILITY_LABEL, CHANGE_REQUEST_LABEL, CHANGE_STATUS_LABEL,
  GUIDE_STATUS_LABEL, ASSIGNMENT_STATUS_LABEL, HONOR_STATUS_LABEL,
  PROGRESS_STATUS_LABEL, CONDITION_STATUS_LABEL,
  RESV_CATEGORY_LABEL, PAY_CATEGORY_LABEL, PAYMENT_DISPLAY_LABEL, paymentDisplayStatus,
} from '@/lib/format';
const STYLES: Record<string, string> = {
  // hijau
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  // amber (menunggu)
  amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  // biru air
  water: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50',
  // oranye (hampir penuh / siap)
  orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50',
  // merah
  red: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50',
  // abu netral
  slate: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100',
  // ungu lembut (info khusus)
  violet: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50',
};

const STATUS_COLOR: Record<string, keyof typeof STYLES> = {
  // status reservasi
  MENUNGGU_PEMBAYARAN: 'amber',
  TERKONFIRMASI: 'green',
  SELESAI: 'slate',
  DIBATALKAN: 'red',
  // status pengelompokan
  MENUNGGU_PENGELOMPOKAN: 'amber',
  SIAP_BERANGKAT: 'water',
  KELOMPOK_LENGKAP: 'green',
  TERKELOMPOK: 'violet',
  LENGKAP: 'green',
  MENUNGGU: 'amber',
  // status pembayaran
  UNPAID: 'orange',
  PAID: 'green',
  BAYAR_DI_TEMPAT: 'water',
  FAILED: 'red',
  CANCELLED: 'red',
  // ketersediaan jadwal
  TERSEDIA: 'green',
  HAMPIR_PENUH: 'orange',
  PENUH: 'red',
  DITUTUP: 'red',
  DITUNDA: 'slate',
  AKTIF: 'green',
  // guide & penugasan
  DITUGASKAN: 'water',
  // pengajuan perubahan
  APPROVED: 'green',
  REJECTED: 'red',
  // status guide
  TIDAK_AKTIF: 'slate',
  // status penugasan guide
  BELUM_DITUGASKAN: 'amber',
  // DITUGASKAN sudah termap ke 'water' di bawah (guide & penugasan)
  // status honor guide
  BELUM_DIPROSES: 'amber',
  SIAP_DIBAYARKAN: 'water',
  SUDAH_DIBAYARKAN: 'green',
};

// warna status progress pengelompokan (Terbaru / Sedang Diproses / Selesai) — kind="progress"
const PROGRESS_COLOR: Record<string, keyof typeof STYLES> = {
  NEW: 'water',
  IN_PROGRESS: 'amber',
  DONE: 'green',
};

// warna status kondisi (Normal / Pending / Overdue) — kind="condition"
// (terpisah dari STATUS_COLOR karena kunci PENDING bentrok dengan status pembayaran)
const CONDITION_COLOR: Record<string, keyof typeof STYLES> = {
  NORMAL: 'slate',
  PENDING: 'violet',
  OVERDUE: 'red',
};

// kategori status reservasi untuk tab Pengelompokan — kind="resv"
// (Terbaru / Menunggu / Lengkap / Selesai / Batal — dimensi status reservasi)
const RESV_CATEGORY_COLOR: Record<string, keyof typeof STYLES> = {
  TERBARU: 'water',
  MENUNGGU: 'amber',
  LENGKAP: 'violet',
  SELESAI: 'slate',
  BATAL: 'red',
};

// kategori status pembayaran — kind="payCat"
// (Lunas / Belum Bayar / Bayar di Tempat — dimensi pembayaran, metode-aware,
// terpisah dari status reservasi)
const PAY_CATEGORY_COLOR: Record<string, keyof typeof STYLES> = {
  LUNAS: 'green',
  BELUM_BAYAR: 'orange',
  BAYAR_DI_TEMPAT: 'water',
};

type BadgeKind = 'progress' | 'condition' | 'resv' | 'payCat';

const KIND_COLOR: Record<Exclude<BadgeKind, never>, Record<string, keyof typeof STYLES>> = {
  progress: PROGRESS_COLOR,
  condition: CONDITION_COLOR,
  resv: RESV_CATEGORY_COLOR,
  payCat: PAY_CATEGORY_COLOR,
};

const KIND_LABEL: Record<Exclude<BadgeKind, never>, Record<string, string>> = {
  progress: PROGRESS_STATUS_LABEL,
  condition: CONDITION_STATUS_LABEL,
  resv: RESV_CATEGORY_LABEL,
  payCat: PAY_CATEGORY_LABEL,
};

export function StatusBadge({ status, className, kind }: { status: string; className?: string; kind?: BadgeKind }) {
  const color = kind
    ? KIND_COLOR[kind][status] || 'slate'
    : STATUS_COLOR[status] || 'slate';
  const label = kind
    ? KIND_LABEL[kind][status] || status
    : RESERVATION_STATUS_LABEL[status] ||
      GROUPING_STATUS_LABEL[status] ||
      PAYMENT_STATUS_LABEL[status] ||
      AVAILABILITY_LABEL[status] ||
      CHANGE_STATUS_LABEL[status] ||
      CHANGE_REQUEST_LABEL[status] ||
      GUIDE_STATUS_LABEL[status] ||
      ASSIGNMENT_STATUS_LABEL[status] ||
      HONOR_STATUS_LABEL[status] ||
      status;
  return (
    <Badge variant="outline" className={cn('font-medium whitespace-nowrap', STYLES[color], className)}>
      {label}
    </Badge>
  );
}

/**
 * Badge METODE pembayaran: Lunas (online penuh) atau Bayar di Tempat (di lokasi).
 * Metode pembayaran TIDAK sama dengan status pembayaran — gunakan
 * PaymentStatusBadge untuk status (Belum Bayar / Bayar di Tempat / Lunas).
 */
export function PaymentMethodBadge({ method }: { method: string }) {
  const label = method === 'FULL_PAYMENT' ? 'Lunas' : 'Bayar di Tempat';
  const cls = method === 'FULL_PAYMENT' ? STYLES.green : STYLES.orange;
  return <Badge variant="outline" className={cn('font-medium whitespace-nowrap', cls)}>{label}</Badge>;
}

/**
 * Badge STATUS pembayaran (metode-aware, dua informasi terpisah):
 * - PAID -> "Lunas" (pembayaran penuh diterima, metode apa pun)
 * - ONSITE + belum dibayar -> "Bayar di Tempat" (akan dibayar di lokasi, BELUM dibayar)
 * - FULL_PAYMENT + belum dibayar -> "Belum Bayar"
 */
export function PaymentStatusBadge({
  status, method, className,
}: {
  status?: string | null;
  method?: string | null;
  className?: string;
}) {
  const key = paymentDisplayStatus(status, method);
  if (!key) {
    return <Badge variant="outline" className={cn('font-medium whitespace-nowrap', STYLES.slate, className)}>—</Badge>;
  }
  const color = STATUS_COLOR[key] || 'slate';
  const label = PAYMENT_DISPLAY_LABEL[key] ?? key;
  return <Badge variant="outline" className={cn('font-medium whitespace-nowrap', STYLES[color], className)}>{label}</Badge>;
}
