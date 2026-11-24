// ===== Client-side fetch helper =====

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error || 'Terjadi kesalahan pada server.', res.status, data);
  }
  return data as T;
}

/** simpan/ambil pasangan reservasi terverifikasi (kode + telp) */
export function setVerifiedReservation(code: string, phone: string) {
  try {
    const list = getVerifiedReservations();
    if (!list.some((v: any) => v.code === code)) {
      list.push({ code, phone });
      sessionStorage.setItem('srt_verified', JSON.stringify(list));
    }
  } catch { /* noop */ }
}

export function getVerifiedReservations(): { code: string; phone: string }[] {
  try {
    return JSON.parse(sessionStorage.getItem('srt_verified') || '[]');
  } catch {
    return [];
  }
}

export function isVerified(code: string): boolean {
  return getVerifiedReservations().some((v) => v.code === code);
}
