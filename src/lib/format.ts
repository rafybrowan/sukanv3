// ===== Utilitas format (aman untuk client & server) =====

export function formatRupiah(n: number): string {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));
}

/** "2026-09-27" -> "Sabtu, 27 September 2026" */
export function formatDateID(dateStr: string, withDay = true): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const opts: Intl.DateTimeFormatOptions = withDay
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('id-ID', opts).format(d);
}

/** "2026-09-27" -> "27 Sep" */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

/** "2026-09-27" -> "Sab" | "Min" dst */
export function dayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(d);
}

export function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Normalisasi nomor HP: hanya digit, 62xxx -> 08xxx */
export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('62')) p = '0' + p.slice(2);
  return p;
}

export function formatPhone(phone: string): string {
  const p = phone || '';
  if (p.startsWith('08') && p.length >= 10) {
    return p.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  }
  return p;
}

export function formatDateTimeID(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(d) + ' WIB';
}

// ===== Label status =====
export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu Pembayaran',
  TERKONFIRMASI: 'Terkonfirmasi',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export const GROUPING_STATUS_LABEL: Record<string, string> = {
  MENUNGGU_PENGELOMPOKAN: 'Menunggu Pengelompokan',
  SIAP_BERANGKAT: 'Siap Berangkat',
  KELOMPOK_LENGKAP: 'Kelompok Lengkap',
  TERKELOMPOK: 'Terkelompok',
  // status internal Group
  MENUNGGU: 'Menunggu Peserta',
  LENGKAP: 'Terkonfirmasi',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  FULL_PAYMENT: 'Lunas',
  ONSITE: 'Bayar di Tempat',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Belum Bayar',
  PAID: 'Lunas',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
};

// ===== Status pembayaran tampilan (metode-aware) =====
// Metode pembayaran dan status pembayaran adalah dua informasi TERPISAH:
// - PAID (Lunas) berlaku untuk metode apa pun setelah pembayaran penuh diterima.
// - ONSITE + belum dibayar ditampilkan sebagai "Bayar di Tempat" (akan dibayar di lokasi).
// - FULL_PAYMENT + belum dibayar ditampilkan sebagai "Belum Bayar".
export const PAYMENT_DISPLAY_LABEL: Record<string, string> = {
  ...PAYMENT_STATUS_LABEL,
  BAYAR_DI_TEMPAT: 'Bayar di Tempat',
};

/** Kunci status tampilan dari kombinasi status + metode pembayaran. */
export function paymentDisplayStatus(
  paymentStatus?: string | null,
  paymentMethod?: string | null
): string {
  if (!paymentStatus) return '';
  if (paymentStatus === 'PAID') return 'PAID';
  if (paymentStatus === 'UNPAID' && paymentMethod === 'ONSITE') return 'BAYAR_DI_TEMPAT';
  return paymentStatus; // UNPAID | FAILED | CANCELLED | dst.
}

/** Label status pembayaran tampilan (metode-aware) — dipakai badge, kartu, dan laporan. */
export function paymentDisplayLabel(
  paymentStatus?: string | null,
  paymentMethod?: string | null
): string {
  const key = paymentDisplayStatus(paymentStatus, paymentMethod);
  if (!key) return '—';
  return PAYMENT_DISPLAY_LABEL[key] ?? key;
}

export const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  DITUTUP: 'Ditutup',
  DITUNDA: 'Ditunda',
};

export const AVAILABILITY_LABEL: Record<string, string> = {
  TERSEDIA: 'Tersedia',
  HAMPIR_PENUH: 'Hampir Penuh',
  PENUH: 'Penuh',
  DITUTUP: 'Ditutup',
  DITUNDA: 'Ditunda',
};

export const CHANGE_REQUEST_LABEL: Record<string, string> = {
  RESCHEDULE: 'Ubah Jadwal',
  PARTICIPANTS: 'Ubah Jumlah Peserta',
  CANCEL: 'Pembatalan',
  OTHER: 'Lainnya',
};

export const CHANGE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu Review',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

// ===== Modul Pemandu / Guide =====
export const GUIDE_STATUS_LABEL: Record<string, string> = {
  TERSEDIA: 'Tersedia',
  DITUGASKAN: 'Ditugaskan',
  TIDAK_AKTIF: 'Tidak Aktif',
};

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  BELUM_DITUGASKAN: 'Belum Ditugaskan',
  DITUGASKAN: 'Ditugaskan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export const HONOR_STATUS_LABEL: Record<string, string> = {
  BELUM_DIPROSES: 'Belum Diproses',
  SIAP_DIBAYARKAN: 'Siap Dibayar',
  SUDAH_DIBAYARKAN: 'Sudah Dibayar',
};

// ===== Status progress & kondisi pengelompokan =====
export const PROGRESS_STATUS_LABEL: Record<string, string> = {
  NEW: 'Terbaru',
  IN_PROGRESS: 'Sedang Diproses',
  DONE: 'Selesai',
};
export const PROGRESS_STATUS_DESC: Record<string, string> = {
  NEW: 'Reservasi/pengelompokan baru yang belum diproses.',
  IN_PROGRESS: 'Pengelompokan yang sedang ditangani oleh admin.',
  DONE: 'Pengelompokan yang telah selesai dan dikonfirmasi.',
};

export const PROGRESS_STATUSES: string[] = ['NEW', 'IN_PROGRESS', 'DONE'];

export const CONDITION_STATUS_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
};

export const CONDITION_STATUS_DESC: Record<string, string> = {
  NORMAL: 'Proses berjalan normal, tidak ada hal yang ditunggu.',
  PENDING: 'Menunggu peserta, pembayaran, konfirmasi admin, atau keputusan pengelompokan.',
  OVERDUE: 'Waktu keberangkatan mendekati/melewati batas — perlu perhatian admin segera.',
};

export const CONDITION_STATUSES: string[] = ['NORMAL', 'PENDING', 'OVERDUE'];

// ===== Kategori tab Pengelompokan — dua dimensi informasi yang BERBEDA =====
// Status reservasi (dimensi proses) dan status pembayaran (dimensi pembayaran)
// tidak saling menggantikan; satu reservasi memiliki keduanya sekaligus.

/** Kategori status reservasi: TERBARU | MENUNGGU | LENGKAP | SELESAI | BATAL */
export type ResvCategory = 'TERBARU' | 'MENUNGGU' | 'LENGKAP' | 'SELESAI' | 'BATAL';

/** Kategori status pembayaran: LUNAS | BELUM BAYAR | BAYAR DI TEMPAT */
export type PayCategory = 'LUNAS' | 'BELUM_BAYAR' | 'BAYAR_DI_TEMPAT';

export const RESV_CATEGORY_LABEL: Record<ResvCategory, string> = {
  TERBARU: 'Terbaru',
  MENUNGGU: 'Menunggu',
  LENGKAP: 'Lengkap',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

export const RESV_CATEGORY_DESC: Record<ResvCategory, string> = {
  TERBARU: 'Reservasi baru buatan user yang belum diproses admin.',
  MENUNGGU: 'Jumlah peserta kurang dari 7 orang — butuh peserta tambahan/pengelompokan.',
  LENGKAP: 'Jumlah peserta sudah mencapai minimal 7 orang.',
  SELESAI: 'Aktivitas reservasi sudah selesai (ditandai admin).',
  BATAL: 'Reservasi dibatalkan (dibatalkan admin).',
};

export const PAY_CATEGORY_LABEL: Record<PayCategory, string> = {
  LUNAS: 'Lunas',
  BELUM_BAYAR: 'Belum Bayar',
  BAYAR_DI_TEMPAT: 'Bayar di Tempat',
};

/**
 * Kategori status reservasi (dimensi status, bukan pembayaran):
 * - DIBATALKAN -> BATAL dan SELESAI -> SELESAI (status final oleh admin)
 * - MENUNGGU_PEMBAYARAN -> TERBARU (baru dibuat user, belum diproses admin;
 *   otomatis masuk kategori Terbaru saat reservasi berhasil dibuat)
 * - TERKONFIRMASI -> MENUNGGU bila peserta < minimal kelompok (7),
 *   LENGKAP bila peserta >= 7 (perubahan jumlah peserta otomatis memengaruhi kategori)
 */
export function resvCategory(reservationStatus: string, participantCount: number, idealGroupSize = 7): ResvCategory {
  if (reservationStatus === 'DIBATALKAN') return 'BATAL';
  if (reservationStatus === 'SELESAI') return 'SELESAI';
  if (reservationStatus === 'MENUNGGU_PEMBAYARAN') return 'TERBARU';
  return participantCount >= idealGroupSize ? 'LENGKAP' : 'MENUNGGU';
}

/**
 * Kategori status pembayaran (dimensi pembayaran, metode-aware):
 * - PAID -> LUNAS (pembayaran penuh diterima, metode apa pun)
 * - UNPAID + ONSITE -> BAYAR_DI_TEMPAT (akan dibayar di lokasi, belum dibayar)
 * - selainnya (UNPAID + FULL_PAYMENT, FAILED, CANCELLED) -> BELUM_BAYAR
 */
export function payCategory(
  paymentStatus?: string | null,
  paymentMethod?: string | null
): PayCategory {
  if (paymentStatus === 'PAID') return 'LUNAS';
  if (paymentStatus === 'UNPAID' && paymentMethod === 'ONSITE') return 'BAYAR_DI_TEMPAT';
  return 'BELUM_BAYAR';
}

/** Waktu relatif bahasa Indonesia: "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu". */
export function formatRelative(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 60 * 1000) return 'baru saja';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return formatDateShort(new Date(t).toISOString().slice(0, 10));
}
