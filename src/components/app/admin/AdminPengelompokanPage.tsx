'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, Ban, CalendarDays, CheckCircle2, ClipboardList, Clock, Filter, Inbox, Layers, LifeBuoy,
  Loader2, Merge, Play, Plus, RefreshCw, Repeat, Search, SearchX, Sparkles,
  TriangleAlert, UserRound, UserPlus, Users, UsersRound, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { AssignGuideDialog } from '@/components/app/shared/AssignGuideDialog';
import { GroupDetailDialog } from '@/components/app/shared/GroupDetailDialog';
import { api } from '@/lib/api-client';
import {
  PROGRESS_STATUS_LABEL,
  CONDITION_STATUS_LABEL, CONDITION_STATUS_DESC,
  RESV_CATEGORY_DESC, resvCategory, payCategory, paymentDisplayLabel,
  formatDateShort, formatDateTimeID, formatPhone, formatRupiah, formatRelative,
} from '@/lib/format';
import type {
  GroupDTO, GroupProgressStatus, GroupConditionStatus, GuideDTO, RecommendationDTO,
  UngroupedReservationDTO, ReservationDTO,
} from '@/lib/types';

const IDEAL = 7; // ukuran kelompok ideal (untuk indikator cepat di kartu)

const COLUMNS: { key: GroupProgressStatus; dot: string; header: string; desc: string; empty: string; emptyDesc: string }[] = [
  {
    key: 'NEW', dot: 'bg-sky-500',
    header: 'TERBARU',
    desc: 'Reservasi/pengelompokan baru yang belum diproses.',
    empty: 'Belum ada pengelompokan baru.',
    emptyDesc: 'Reservasi baru yang membutuhkan pengelompokan akan otomatis muncul di sini.',
  },
  {
    key: 'IN_PROGRESS', dot: 'bg-amber-500',
    header: 'SEDANG DIPROSES',
    desc: 'Pengelompokan yang sedang ditangani oleh admin.',
    empty: 'Belum ada pengelompokan yang sedang diproses.',
    emptyDesc: 'Tekan "Proses" pada pengelompokan terbaru untuk mulai mengerjakan.',
  },
  {
    key: 'DONE', dot: 'bg-emerald-500',
    header: 'SELESAI',
    desc: 'Pengelompokan yang telah selesai dan dikonfirmasi.',
    empty: 'Belum ada pengelompokan yang selesai.',
    emptyDesc: 'Pengelompokan yang dikonfirmasi selesai akan tercatat di sini.',
  },
];

/** Tab kategori reservasi — urutan TEPAT sesuai ketentuan:
 *  All → Terbaru → Menunggu → Lengkap → Lunas → Belum Bayar → Bayar di Tempat → Selesai → Batal.
 *  Status reservasi (Terbaru/Menunggu/Lengkap/Selesai/Batal) dan status pembayaran
 *  (Lunas/Belum Bayar/Bayar di Tempat) adalah dua dimensi informasi berbeda yang
 *  tidak saling menggantikan — sedangkan All hanyalah filter, bukan status database. */
type ResvTab = 'ALL' | 'TERBARU' | 'MENUNGGU' | 'LENGKAP' | 'LUNAS' | 'BELUM_BAYAR' | 'BAYAR_DI_TEMPAT' | 'SELESAI' | 'BATAL';

const RESV_TABS: { key: ResvTab; label: string; desc: string; activeCls: string }[] = [
  { key: 'ALL', label: 'All', desc: 'Seluruh reservasi yang masuk ke sistem — tanpa filter status maupun pembayaran.', activeCls: 'border-foreground bg-foreground text-background' },
  { key: 'TERBARU', label: 'Terbaru', desc: RESV_CATEGORY_DESC.TERBARU, activeCls: 'border-sky-600 bg-sky-600 text-white' },
  { key: 'MENUNGGU', label: 'Menunggu', desc: RESV_CATEGORY_DESC.MENUNGGU, activeCls: 'border-amber-500 bg-amber-500 text-white' },
  { key: 'LENGKAP', label: 'Lengkap', desc: RESV_CATEGORY_DESC.LENGKAP, activeCls: 'border-violet-600 bg-violet-600 text-white' },
  { key: 'LUNAS', label: 'Lunas', desc: 'Pembayaran reservasi sudah dibayar penuh.', activeCls: 'border-emerald-600 bg-emerald-600 text-white' },
  { key: 'BELUM_BAYAR', label: 'Belum Bayar', desc: 'Metode Lunas (online) yang belum melakukan pembayaran.', activeCls: 'border-orange-500 bg-orange-500 text-white' },
  { key: 'BAYAR_DI_TEMPAT', label: 'Bayar di Tempat', desc: 'Memilih metode pembayaran di lokasi dan belum menyelesaikan pembayaran.', activeCls: 'border-sky-500 bg-sky-500 text-white' },
  { key: 'SELESAI', label: 'Selesai', desc: RESV_CATEGORY_DESC.SELESAI, activeCls: 'border-slate-600 bg-slate-600 text-white' },
  { key: 'BATAL', label: 'Batal', desc: RESV_CATEGORY_DESC.BATAL, activeCls: 'border-rose-600 bg-rose-600 text-white' },
];

interface Filters {
  q: string; date: string; time: string; pax: string;
  progress: string; condition: string; guideId: string; payment: string;
}
const EMPTY_FILTERS: Filters = {
  q: '', date: '', time: '', pax: '', progress: '', condition: '', guideId: '', payment: '',
};

function paxMatch(count: number, bucket: string): boolean {
  if (!bucket) return true;
  if (bucket === '1-3') return count >= 1 && count <= 3;
  if (bucket === '4-6') return count >= 4 && count <= 6;
  return count >= 7; // 7+
}

/** Waktu keberangkatan (WIB) sebagai timestamp untuk sorting. */
function departureTs(date: string, time: string): number {
  const dt = new Date(`${date}T${(time || '00:00').padStart(5, '0')}:00+07:00`);
  return Number.isNaN(dt.getTime()) ? Number.MAX_SAFE_INTEGER : dt.getTime();
}

export function AdminPengelompokanPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationDTO[]>([]);
  const [ungrouped, setUngrouped] = useState<UngroupedReservationDTO[]>([]);
  const [guides, setGuides] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // tab Data Reservasi (9 kategori) + aksi status reservasi
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [activeTab, setActiveTab] = useState<ResvTab>('ALL');
  const [resCompleting, setResCompleting] = useState<ReservationDTO | null>(null);
  const [resCancelling, setResCancelling] = useState<ReservationDTO | null>(null);
  const [resBusy, setResBusy] = useState('');

  // modal
  const [assignTarget, setAssignTarget] = useState<GroupDTO | null>(null);
  const [assignMode, setAssignMode] = useState<'assign' | 'change'>('assign');
  const [detailTarget, setDetailTarget] = useState<GroupDTO | null>(null);
  const [resDetailTarget, setResDetailTarget] = useState<UngroupedReservationDTO | null>(null);
  const [processTarget, setProcessTarget] = useState<UngroupedReservationDTO | null>(null);
  const [completeTarget, setCompleteTarget] = useState<GroupDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/api/admin/groups')
        .then((d) => {
          setGroups(d.groups);
          setRecommendations(d.recommendations);
          setUngrouped(d.ungrouped);
          // refresh target modal bila sedang terbuka (data berubah)
          setAssignTarget((prev) => (prev ? d.groups.find((g: GroupDTO) => g.id === prev.id) ?? prev : prev));
          setDetailTarget((prev) => (prev ? d.groups.find((g: GroupDTO) => g.id === prev.id) ?? prev : prev));
          setCompleteTarget((prev) => (prev ? d.groups.find((g: GroupDTO) => g.id === prev.id) ?? prev : prev));
          setProcessTarget((prev) => (prev ? d.ungrouped.find((r: UngroupedReservationDTO) => r.id === prev.id) ?? null : prev));
          setResDetailTarget((prev) => (prev ? d.ungrouped.find((r: UngroupedReservationDTO) => r.id === prev.id) ?? null : prev));
        })
        .catch(() => {}),
      // seluruh reservasi untuk tab 9 kategori (All/Terbaru/.../Batal)
      api('/api/admin/reservations')
        .then((d) => setReservations(d.reservations))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api('/api/admin/guides').then((d) => setGuides(d.guides)).catch(() => {});
  }, []);

  // ===== filter & pencarian =====
  const times = useMemo(
    () => [...new Set([
      ...groups.map((g) => g.schedule.time),
      ...ungrouped.map((r) => r.time),
      ...reservations.map((r) => r.schedule.time),
    ])].sort(),
    [groups, ungrouped, reservations]
  );

  const matchGroup = useCallback((g: GroupDTO): boolean => {
    const q = filters.q.trim().toLowerCase();
    if (filters.date && g.schedule.date !== filters.date) return false;
    if (filters.time && g.schedule.time !== filters.time) return false;
    if (filters.progress && g.progressStatus !== filters.progress) return false;
    if (filters.condition && g.conditionStatus !== filters.condition) return false;
    if (!paxMatch(g.totalParticipants, filters.pax)) return false;
    if (filters.guideId) {
      const hasGuide = g.guideAssignment?.guideId === filters.guideId;
      if (filters.guideId === 'NONE' ? g.guideAssignment != null : !hasGuide) return false;
    }
    if (filters.payment) {
      const allPaid = g.paymentSummary?.allPaid ?? false;
      if (filters.payment === 'LUNAS' && !allPaid) return false;
      if (filters.payment === 'BELUM' && allPaid) return false;
    }
    if (q) {
      const hay = [
        g.groupCode,
        g.mainCustomer ?? '',
        g.mainReservationCode ?? '',
        ...g.members.map((m) => `${m.reservation.name} ${m.reservation.reservationCode}`),
        g.guideAssignment?.guideName ?? '',
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [filters]);

  const matchReservation = useCallback((r: UngroupedReservationDTO): boolean => {
    const q = filters.q.trim().toLowerCase();
    if (filters.date && r.date !== filters.date) return false;
    if (filters.time && r.time !== filters.time) return false;
    if (filters.progress && filters.progress !== 'NEW') return false; // reservasi menunggu selalu TERBARU
    if (filters.condition && r.condition !== filters.condition) return false;
    if (!paxMatch(r.participantCount, filters.pax)) return false;
    if (filters.guideId && filters.guideId !== 'NONE') return false; // reservasi belum dikelompokkan tidak punya guide
    if (filters.payment) {
      const paid = r.payment?.paymentStatus === 'PAID';
      if (filters.payment === 'LUNAS' && !paid) return false;
      if (filters.payment === 'BELUM' && paid) return false;
    }
    if (q) {
      const hay = `${r.reservationCode} ${r.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [filters]);

  const filteredGroups = useMemo(() => groups.filter(matchGroup), [groups, matchGroup]);
  const filteredUngrouped = useMemo(() => ungrouped.filter(matchReservation), [ungrouped, matchReservation]);

  // ===== ringkasan & notifikasi (dari data, bukan angka statis) =====
  const summary = useMemo(() => ({
    NEW: ungrouped.length + groups.filter((g) => g.progressStatus === 'NEW').length,
    IN_PROGRESS: groups.filter((g) => g.progressStatus === 'IN_PROGRESS').length,
    DONE: groups.filter((g) => g.progressStatus === 'DONE').length,
  }), [groups, ungrouped]);

  const notif = useMemo(() => ({
    baru: summary.NEW,
    pending: groups.filter((g) => g.conditionStatus === 'PENDING').length
      + ungrouped.filter((r) => r.condition === 'PENDING').length,
    overdue: groups.filter((g) => g.conditionStatus === 'OVERDUE').length
      + ungrouped.filter((r) => r.condition === 'OVERDUE').length,
  }), [groups, ungrouped, summary.NEW]);

  // ===== tab 9 kategori: hitungan per kategori =====
  // Status reservasi dan status pembayaran dihitung terpisah — satu reservasi
  // selalu terhitung di tepat SATU kategori status dan SATU kategori pembayaran.
  const tabCounts = useMemo(() => {
    const c: Record<ResvTab, number> = {
      ALL: reservations.length, TERBARU: 0, MENUNGGU: 0, LENGKAP: 0,
      LUNAS: 0, BELUM_BAYAR: 0, BAYAR_DI_TEMPAT: 0, SELESAI: 0, BATAL: 0,
    };
    for (const r of reservations) {
      c[resvCategory(r.reservationStatus, r.participantCount, IDEAL)] += 1;
      c[payCategory(r.payment?.paymentStatus, r.payment?.paymentMethod)] += 1;
    }
    return c;
  }, [reservations]);

  // ===== daftar reservasi sesuai tab aktif (+ pencarian & filter jadwal) =====
  const filteredBrowser = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let list = reservations;
    if (activeTab !== 'ALL') {
      const isPayTab = activeTab === 'LUNAS' || activeTab === 'BELUM_BAYAR' || activeTab === 'BAYAR_DI_TEMPAT';
      list = list.filter((r) =>
        isPayTab
          ? payCategory(r.payment?.paymentStatus, r.payment?.paymentMethod) === activeTab
          : resvCategory(r.reservationStatus, r.participantCount, IDEAL) === activeTab
      );
    }
    if (q) {
      list = list.filter((r) =>
        `${r.reservationCode} ${r.name} ${r.phone} ${r.group?.groupCode ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (filters.date) list = list.filter((r) => r.schedule.date === filters.date);
    if (filters.time) list = list.filter((r) => r.schedule.time === filters.time);
    // tab aktif: keberangkatan terdekat dulu; tab arsip (Terbaru/Selesai/Batal): terbaru dibuat dulu
    const bySchedule = activeTab !== 'TERBARU' && activeTab !== 'SELESAI' && activeTab !== 'BATAL';
    return [...list].sort((a, b) => {
      if (bySchedule) {
        const da = departureTs(a.schedule.date, a.schedule.time);
        const db = departureTs(b.schedule.date, b.schedule.time);
        if (da !== db) return da - db;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reservations, activeTab, filters]);

  // ===== pengurutan per kolom =====
  type BoardCard =
    | { type: 'res'; item: UngroupedReservationDTO; ts: number }
    | { type: 'group'; item: GroupDTO; ts: number };

  const columnCards = useMemo<Record<GroupProgressStatus, BoardCard[]>>(() => {
    const terbaru: BoardCard[] = [
      ...filteredUngrouped.map((r) => ({ type: 'res' as const, item: r, ts: new Date(r.createdAt).getTime() })),
      ...filteredGroups.filter((g) => g.progressStatus === 'NEW')
        .map((g) => ({ type: 'group' as const, item: g, ts: new Date(g.createdAt).getTime() })),
    ].sort((a, b) => b.ts - a.ts); // terbaru dibuat dulu

    const diproses: BoardCard[] = filteredGroups
      .filter((g) => g.progressStatus === 'IN_PROGRESS')
      .sort((a, b) => {
        // 1) keberangkatan paling dekat, 2) PENDING lebih dulu, 3) terakhir diperbarui
        const da = departureTs(a.schedule.date, a.schedule.time);
        const db = departureTs(b.schedule.date, b.schedule.time);
        if (da !== db) return da - db;
        const pa = a.conditionStatus === 'PENDING' ? 0 : 1;
        const pb = b.conditionStatus === 'PENDING' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.lastActivity ?? b.createdAt).getTime() - new Date(a.lastActivity ?? a.createdAt).getTime();
      })
      .map((g) => ({ type: 'group' as const, item: g, ts: 0 }));

    const selesai: BoardCard[] = filteredGroups
      .filter((g) => g.progressStatus === 'DONE')
      .sort((a, b) => {
        // yang baru selesai pertama
        const ta = new Date(a.doneAt ?? a.lastActivity ?? a.createdAt).getTime();
        const tb = new Date(b.doneAt ?? b.lastActivity ?? b.createdAt).getTime();
        return tb - ta;
      })
      .map((g) => ({ type: 'group' as const, item: g, ts: 0 }));

    return { NEW: terbaru, IN_PROGRESS: diproses, DONE: selesai };
  }, [filteredGroups, filteredUngrouped]);

  const hasActiveFilter = !!(filters.q || filters.date || filters.time || filters.progress || filters.condition || filters.guideId);

  // ===== aksi =====
  const confirmRecommendation = async (rec: RecommendationDTO) => {
    setBusyId(rec.id);
    try {
      if (rec.type === 'ADD_TO_GROUP') {
        const group = groups.find((g) => g.groupCode === rec.targetGroupCode);
        const resId = rec.reservations[0]?.id;
        if (!group || !resId) throw new Error('Data tidak ditemukan.');
        await api(`/api/admin/groups/${group.id}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'add', reservationId: resId }),
        });
        toast({ title: 'Peserta digabungkan', description: `${rec.reservations[0].reservationCode} bergabung ke ${rec.targetGroupCode}.` });
      } else {
        const ids = rec.reservations.map((r) => r.id);
        const d = await api<{ group: any }>('/api/admin/groups', {
          method: 'POST',
          body: JSON.stringify({ reservationIds: ids }),
        });
        toast({
          title: rec.type === 'IDEAL' ? 'Kelompok ideal terbentuk!' : 'Kelompok parsial terbentuk',
          description: `${d.group.groupCode} · ${rec.totalParticipants} peserta — masuk ke SEDANG DIPROSES.`,
        });
      }
      load();
    } catch (e: any) {
      toast({ title: 'Gagal memproses', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const groupAction = async (g: GroupDTO, action: 'finalize' | 'disband') => {
    setBusyId(g.id + action);
    try {
      await api(`/api/admin/groups/${g.id}`, { method: 'POST', body: JSON.stringify({ action }) });
      if (action === 'finalize') {
        toast({
          title: 'Kelompok dikonfirmasi',
          description: `${g.groupCode} dikonfirmasi — silakan tugaskan guide bila diperlukan, lalu selesaikan pengelompokan.`,
        });
        await new Promise((r) => setTimeout(r, 400));
        const fresh = await api<{ groups: GroupDTO[] }>('/api/admin/groups');
        const updated = fresh.groups.find((x) => x.id === g.id);
        if (updated) {
          setGroups(fresh.groups);
          setDetailTarget(null);
          setAssignMode('assign');
          setAssignTarget(updated);
        }
      } else {
        toast({
          title: 'Kelompok dibubarkan',
          description: `${g.groupCode} dibubarkan, peserta kembali menunggu pengelompokan.`,
        });
        setDetailTarget(null);
        load();
      }
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const assignmentAction = async (g: GroupDTO, act: 'complete' | 'cancel') => {
    const a = g.guideAssignment;
    if (!a) return;
    setBusyId(g.id + act);
    try {
      const d = await api<{ message: string }>(`/api/admin/assignments/${a.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: act }),
      });
      toast({
        title: act === 'complete' ? 'Kegiatan selesai' : 'Penugasan dibatalkan',
        description: d.message,
      });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  /** Ubah status utama (progress) kelompok: NEW -> IN_PROGRESS -> DONE. */
  const changeProgress = async (g: GroupDTO, target: GroupProgressStatus, note?: string): Promise<boolean> => {
    if (g.progressStatus === target) return false;
    setBusyId(g.id + 'status');
    try {
      const d = await api<{ message: string }>(`/api/admin/groups/${g.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'status', progressStatus: target, note: note || undefined }),
      });
      toast({ title: 'Status diperbarui', description: d.message || `${g.groupCode} → ${PROGRESS_STATUS_LABEL[target]}` });
      load();
      return true;
    } catch (e: any) {
      toast({ title: 'Perubahan status ditolak', description: e.message, variant: 'destructive' });
      load();
      return false;
    } finally {
      setBusyId('');
    }
  };

  /** Ubah status kondisi (NORMAL <-> PENDING; OVERDUE otomatis). */
  const changeCondition = async (g: GroupDTO, target: GroupConditionStatus, note?: string): Promise<boolean> => {
    if (g.conditionStatus === target) return false;
    setBusyId(g.id + 'condition');
    try {
      const d = await api<{ message: string }>(`/api/admin/groups/${g.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'condition', conditionStatus: target, note: note || undefined }),
      });
      toast({ title: 'Kondisi diperbarui', description: d.message || `${g.groupCode} → ${CONDITION_STATUS_LABEL[target]}` });
      load();
      return true;
    } catch (e: any) {
      toast({ title: 'Perubahan kondisi ditolak', description: e.message, variant: 'destructive' });
      load();
      return false;
    } finally {
      setBusyId('');
    }
  };

  /** Buat kelompok baru dari daftar reservasi terpilih (dipakai dialog proses & buat manual). */
  const createGroup = async (reservationIds: string[], label: string): Promise<boolean> => {
    setBusyId('create-group');
    try {
      const d = await api<{ group: any }>('/api/admin/groups', {
        method: 'POST',
        body: JSON.stringify({ reservationIds }),
      });
      toast({
        title: 'Pengelompokan dibuat',
        description: `${d.group.groupCode} · ${label} — status SEDANG DIPROSES.`,
      });
      setProcessTarget(null);
      setCreateOpen(false);
      load();
      return true;
    } catch (e: any) {
      toast({ title: 'Gagal membuat kelompok', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setBusyId('');
    }
  };

  /** Gabungkan reservasi ke kelompok yang sudah ada. */
  const addToGroup = async (group: GroupDTO, reservationId: string, resCode: string): Promise<boolean> => {
    setBusyId('add-to-group');
    try {
      await api(`/api/admin/groups/${group.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'add', reservationId }),
      });
      toast({ title: 'Peserta digabungkan', description: `${resCode} bergabung ke ${group.groupCode}.` });
      setProcessTarget(null);
      load();
      return true;
    } catch (e: any) {
      toast({ title: 'Gagal menggabungkan', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setBusyId('');
    }
  };

  /** Aksi status reservasi dari tab Data Reservasi: konfirmasi | selesai | batal.
   *  Perubahan status otomatis memindahkan reservasi ke kategori tab yang sesuai. */
  const resAction = async (r: ReservationDTO, action: 'confirm' | 'complete' | 'cancel') => {
    setResBusy(r.id + action);
    try {
      await api(`/api/admin/reservations/${r.id}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast({
        title: action === 'confirm' ? 'Reservasi dikonfirmasi'
          : action === 'complete' ? 'Reservasi ditandai selesai'
            : 'Reservasi dibatalkan',
        description: action === 'confirm'
          ? `${r.reservationCode} kini diproses — masuk kategori Menunggu/Lengkap sesuai jumlah pesertanya.`
          : action === 'complete'
            ? `${r.reservationCode} otomatis tampil pada kategori Selesai.`
            : `${r.reservationCode} otomatis tampil pada kategori Batal.`,
      });
      setResCompleting(null);
      setResCancelling(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setResBusy('');
    }
  };

  const openAssign = (g: GroupDTO, mode: 'assign' | 'change') => {
    setAssignMode(mode);
    setAssignTarget(g);
  };

  const recIcon = (t: string) =>
    t === 'IDEAL' ? <Merge className="h-5 w-5 text-emerald-600" />
      : t === 'ADD_TO_GROUP' ? <UserPlus className="h-5 w-5 text-sky-600" />
        : <Users className="h-5 w-5 text-amber-600" />;

  return (
    <div className="space-y-6">
      {/* ===== A. Header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pengelompokan Peserta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola dan pantau proses pengelompokan peserta berdasarkan jadwal keberangkatan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang
          </Button>
          <Button className="font-bold" onClick={() => setCreateOpen(true)} disabled={ungrouped.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Buat Pengelompokan
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Cari kode reservasi, nama pemesan, atau kode grup..."
          className="h-11 pl-9 text-sm"
        />
        {filters.q && (
          <button
            onClick={() => setFilters((f) => ({ ...f, q: '' }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Bersihkan pencarian"
          >
            <SearchX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ===== B. Filter Jadwal & Pemandu ===== */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-2.5 p-4">
          <div className="min-w-[150px] flex-1 sm:max-w-[210px]">
            <Label className="sr-only">Tanggal</Label>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="min-w-[150px] flex-1 sm:max-w-[210px]">
            <Label className="sr-only">Jam</Label>
            <Select value={filters.time || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, time: v === 'ALL' ? '' : v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Jam" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Jam</SelectItem>
                {times.map((t) => <SelectItem key={t} value={t}>{t} WIB</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px] flex-1 sm:max-w-[210px]">
            <Label className="sr-only">Pemandu</Label>
            <Select value={filters.guideId || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, guideId: v === 'ALL' ? '' : v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Pemandu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Pemandu</SelectItem>
                <SelectItem value="NONE">Tanpa Pemandu</SelectItem>
                {guides.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <p className="hidden text-[11px] leading-snug text-muted-foreground lg:block">
              Tanggal &amp; jam berlaku pada <b>Data Reservasi</b> dan <b>Papan Progress</b>; pemandu pada Papan Progress.
            </p>
            <Button
              variant="outline" className="shrink-0"
              disabled={!hasActiveFilter}
              onClick={() => setFilters(EMPTY_FILTERS)}
              title="Reset semua filter"
            >
              <Filter className="mr-1.5 h-4 w-4" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== C. Data Reservasi — Tab 9 Kategori ===== */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
            Data Reservasi
            <Badge variant="secondary" className="font-bold">
              {activeTab === 'ALL' ? filteredBrowser.length : `${filteredBrowser.length} dari ${tabCounts[activeTab]}`}
            </Badge>
          </h2>
          <p className="max-w-md text-[11px] leading-snug text-muted-foreground">
            Status reservasi (Terbaru·Menunggu·Lengkap·Selesai·Batal) dan status pembayaran (Lunas·Belum Bayar·Bayar di Tempat)
            adalah informasi terpisah — reservasi tampil di kategori status <b>dan</b> kategori pembayarannya.
          </p>
        </div>

        {/* Tab kategori — dapat digeser ke samping pada layar kecil */}
        <div
          className="overflow-x-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:transparent"
          role="tablist"
          aria-label="Filter kategori reservasi"
        >
          <div className="flex min-w-max items-center gap-1.5">
            {RESV_TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  title={t.desc}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                    active
                      ? `${t.activeCls} shadow-sm`
                      : 'bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-px text-[10px] font-extrabold ${active ? 'bg-white/25' : 'bg-muted'}`}>
                    {tabCounts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daftar kartu reservasi sesuai tab aktif */}
        {loading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : filteredBrowser.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={SearchX}
              title={activeTab === 'ALL'
                ? 'Belum ada reservasi'
                : `Tidak ada reservasi pada kategori ${RESV_TABS.find((t) => t.key === activeTab)?.label ?? ''}`}
              description={hasActiveFilter
                ? 'Tidak ada hasil untuk pencarian/filter tanggal/jam saat ini. Coba ubah kata kunci atau tekan Reset.'
                : (RESV_TABS.find((t) => t.key === activeTab)?.desc ?? 'Semua data reservasi akan tampil di sini.')}
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBrowser.map((r) => (
              <ReservationBrowserCard
                key={r.id}
                r={r}
                ungroupedEntry={ungrouped.find((u) => u.id === r.id)}
                groupEntry={r.group ? groups.find((g) => g.groupCode === r.group?.groupCode) ?? null : null}
                busy={resBusy}
                onProses={(u) => setProcessTarget(u)}
                onDetail={(u) => setResDetailTarget(u)}
                onGroupDetail={(g) => setDetailTarget(g)}
                onConfirm={(x) => resAction(x, 'confirm')}
                onComplete={(x) => setResCompleting(x)}
                onCancel={(x) => setResCancelling(x)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== Notifikasi ===== */}
      {!loading && (notif.baru > 0 || notif.pending > 0 || notif.overdue > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {notif.baru > 0 && (
            <button
              onClick={() => setFilters((f) => ({ ...f, progress: f.progress === 'NEW' ? '' : 'NEW' }))}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100"
            >
              <Inbox className="h-3.5 w-3.5" />
              {notif.baru} pengelompokan baru perlu diproses
              <Badge className="bg-sky-600 px-1.5 text-[10px] text-white">{notif.baru} Baru</Badge>
            </button>
          )}
          {notif.pending > 0 && (
            <button
              onClick={() => setFilters((f) => ({ ...f, condition: f.condition === 'PENDING' ? '' : 'PENDING' }))}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Clock className="h-3.5 w-3.5" />
              {notif.pending} pengelompokan sedang menunggu
              <Badge className="bg-violet-600 px-1.5 text-[10px] text-white">{notif.pending} Pending</Badge>
            </button>
          )}
          {notif.overdue > 0 && (
            <button
              onClick={() => setFilters((f) => ({ ...f, condition: f.condition === 'OVERDUE' ? '' : 'OVERDUE' }))}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              {notif.overdue} pengelompokan melewati waktu yang ditentukan
              <Badge className="bg-rose-600 px-1.5 text-[10px] text-white">{notif.overdue} Overdue</Badge>
            </button>
          )}
        </div>
      )}

      {/* ===== D. Papan Progress (3 Kolom) ===== */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <UsersRound className="h-4.5 w-4.5 text-primary" />
          Papan Progress Pengelompokan
          <Badge variant="secondary" className="font-bold">
            {filteredGroups.length + filteredUngrouped.length}
          </Badge>
        </h2>
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 w-full min-w-[280px] max-w-[420px] shrink-0 rounded-2xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto pb-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:transparent">
            <div className="flex min-w-max gap-3 lg:min-w-0">
              {COLUMNS.filter((c) => !filters.progress || c.key === filters.progress).map((col) => {
                const cards = columnCards[col.key];
                return (
                  <div key={col.key} className="flex w-[320px] shrink-0 flex-col rounded-2xl border bg-muted/30 lg:w-auto lg:min-w-[280px] lg:flex-1">
                    <div className="rounded-t-2xl border-b bg-muted/50 px-3.5 py-2.5" title={col.desc}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-extrabold">
                          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                          {col.header}
                        </p>
                        <Badge variant="secondary" className="font-bold">{cards.length}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{col.desc}</p>
                    </div>
                    <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5 max-h-[68vh] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
                      {cards.length === 0 ? (
                        <div className="flex h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center">
                          <p className="text-xs font-semibold">{col.empty}</p>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{col.emptyDesc}</p>
                        </div>
                      ) : (
                        cards.map((card) => card.type === 'res' ? (
                          <ReservationCard
                            key={`res-${card.item.id}`}
                            r={card.item}
                            onDetail={() => setResDetailTarget(card.item)}
                            onProses={() => setProcessTarget(card.item)}
                          />
                        ) : (
                          <GroupCard
                            key={card.item.id}
                            group={card.item}
                            busy={busyId}
                            onDetail={() => setDetailTarget(card.item)}
                            onProses={() => changeProgress(card.item, 'IN_PROGRESS', 'Admin mulai memproses pengelompokan.')}
                            onLanjutkan={() => setDetailTarget(card.item)}
                            onComplete={() => setCompleteTarget(card.item)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {hasActiveFilter && filteredGroups.length + filteredUngrouped.length === 0 && !loading && (
          <EmptyState
            icon={SearchX}
            title="Tidak ada pengelompokan yang cocok"
            description="Tidak ada hasil untuk pencarian/filter saat ini. Coba ubah kata kunci atau reset filter."
          />
        )}
      </section>

      {/* ===== Rekomendasi Sistem ===== */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Sparkles className="h-4.5 w-4.5 text-amber-500" /> Rekomendasi Sistem
          {recommendations.length > 0 && <Badge className="bg-amber-500 text-white">{recommendations.length}</Badge>}
        </h2>
        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
        ) : recommendations.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Belum ada rekomendasi"
            description="Rekomendasi penggabungan muncul otomatis ketika ada peserta menunggu kelompok pada jadwal yang sama."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {recommendations.map((rec) => (
              <Card key={rec.id} className={`shadow-sm ${rec.type === 'IDEAL' ? 'border-emerald-200' : rec.type === 'ADD_TO_GROUP' ? 'border-sky-200' : 'border-amber-200'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${rec.type === 'IDEAL' ? 'bg-emerald-100' : rec.type === 'ADD_TO_GROUP' ? 'bg-sky-100' : 'bg-amber-100'}`}>
                        {recIcon(rec.type)}
                      </span>
                      <div>
                        <p className="text-sm font-extrabold">
                          {rec.type === 'IDEAL' ? 'Kelompok Ideal (7/7)' : rec.type === 'ADD_TO_GROUP' ? `Gabung ke ${rec.targetGroupCode}` : 'Kelompok Parsial'}
                        </p>
                        <p className="text-xs text-muted-foreground">{rec.scheduleLabel}</p>
                      </div>
                    </div>
                    {rec.type === 'IDEAL' && <Badge className="bg-emerald-600 text-white">LENGKAP</Badge>}
                  </div>
                  <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">{rec.message}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rec.reservations.map((r) => (
                      <span key={r.reservationCode} className="rounded-lg border bg-muted/50 px-2.5 py-1 text-xs font-semibold">
                        {r.name} <span className="text-muted-foreground">({r.participantCount})</span>
                      </span>
                    ))}
                  </div>
                  <Button
                    onClick={() => confirmRecommendation(rec)}
                    disabled={busyId === rec.id}
                    className={`mt-4 w-full font-bold ${rec.type === 'IDEAL' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  >
                    {busyId === rec.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : rec.type === 'ADD_TO_GROUP' ? <><Plus className="mr-1.5 h-4 w-4" /> Gabungkan</>
                        : <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Konfirmasi Pengelompokan</>}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Modal penugasan guide ===== */}
      <AssignGuideDialog
        group={assignTarget}
        mode={assignMode}
        currentGuideId={assignMode === 'change' ? assignTarget?.guideAssignment?.guideId : undefined}
        onClose={() => setAssignTarget(null)}
        onDone={(message) => {
          setAssignTarget(null);
          toast({ title: assignMode === 'assign' ? 'Guide ditugaskan' : 'Guide diganti', description: `${message} Riwayat pengelompokan diperbarui.` });
          load();
        }}
      />

      {/* ===== Modal detail kelompok ===== */}
      <GroupDetailDialog
        group={detailTarget}
        busy={busyId}
        onClose={() => setDetailTarget(null)}
        onSetProgress={changeProgress}
        onSetCondition={changeCondition}
        onFinalize={(g) => groupAction(g, 'finalize')}
        onAssign={(g, mode) => { setDetailTarget(null); openAssign(g, mode); }}
        onComplete={(g) => assignmentAction(g, 'complete')}
        onDisband={(g) => groupAction(g, 'disband')}
      />

      {/* ===== Modal detail reservasi belum terkelompokkan ===== */}
      <ReservationDetailDialog
        r={resDetailTarget}
        onClose={() => setResDetailTarget(null)}
        onProses={(r) => { setResDetailTarget(null); setProcessTarget(r); }}
      />

      {/* ===== Modal proses pengelompokan (kartu TERBARU) ===== */}
      <ProcessReservationDialog
        r={processTarget}
        groups={groups}
        recommendations={recommendations}
        busy={busyId}
        onClose={() => setProcessTarget(null)}
        onCreateGroup={createGroup}
        onAddToGroup={addToGroup}
      />

      {/* ===== Modal buat pengelompokan manual ===== */}
      <CreateGroupDialog
        open={createOpen}
        ungrouped={ungrouped}
        recommendations={recommendations}
        busy={busyId}
        onClose={() => setCreateOpen(false)}
        onCreateGroup={createGroup}
      />

      {/* ===== Modal konfirmasi selesaikan ===== */}
      <ConfirmCompleteDialog
        group={completeTarget}
        busy={busyId}
        onClose={() => setCompleteTarget(null)}
        onConfirm={async (g) => {
          const ok = await changeProgress(g, 'DONE', 'Pengelompokan selesai dan dikonfirmasi.');
          if (ok) setCompleteTarget(null);
        }}
      />

      {/* ===== Konfirmasi tandai selesai reservasi (tab Data Reservasi) ===== */}
      <AlertDialog open={!!resCompleting} onOpenChange={(o) => { if (!o && !resBusy) setResCompleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai {resCompleting?.reservationCode} sebagai Selesai?</AlertDialogTitle>
            <AlertDialogDescription>
              Reservasi atas nama <b>{resCompleting?.name}</b> ({resCompleting?.participantCount} peserta) akan
              ditandai selesai dan otomatis tampil pada kategori <b>Selesai</b>. Pastikan kegiatan reservasi
              benar-benar telah selesai.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!resBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!resBusy}
              className="bg-emerald-600 font-bold hover:bg-emerald-700"
              onClick={(e) => { e.preventDefault(); if (resCompleting) resAction(resCompleting, 'complete'); }}
            >
              {!!resBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Ya, Tandai Selesai
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Konfirmasi pembatalan reservasi (tab Data Reservasi) ===== */}
      <AlertDialog open={!!resCancelling} onOpenChange={(o) => { if (!o && !resBusy) setResCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan reservasi {resCancelling?.reservationCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              Reservasi atas nama <b>{resCancelling?.name}</b> akan dibatalkan, dikeluarkan dari kelompoknya
              (bila tergabung), dan slot kapasitasnya dilepas. Reservasi lalu tampil pada kategori <b>Batal</b>.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!resBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!resBusy}
              className="bg-rose-600 font-bold hover:bg-rose-700"
              onClick={(e) => { e.preventDefault(); if (resCancelling) resAction(resCancelling, 'cancel'); }}
            >
              {!!resBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ================= Kartu Reservasi (tab Data Reservasi — 9 kategori) =================
function ReservationBrowserCard({
  r, ungroupedEntry, groupEntry, busy, onProses, onDetail, onGroupDetail, onConfirm, onComplete, onCancel,
}: {
  r: ReservationDTO;
  ungroupedEntry: UngroupedReservationDTO | undefined;
  groupEntry: GroupDTO | null;
  busy: string;
  onProses: (r: UngroupedReservationDTO) => void;
  onDetail: (r: UngroupedReservationDTO) => void;
  onGroupDetail: (g: GroupDTO) => void;
  onConfirm: (r: ReservationDTO) => void;
  onComplete: (r: ReservationDTO) => void;
  onCancel: (r: ReservationDTO) => void;
}) {
  const resvCat = resvCategory(r.reservationStatus, r.participantCount, IDEAL);
  const payCat = payCategory(r.payment?.paymentStatus, r.payment?.paymentMethod);
  const isCancelled = r.reservationStatus === 'DIBATALKAN';
  const isDone = r.reservationStatus === 'SELESAI';
  const working = busy === r.id + 'confirm' || busy === r.id + 'complete' || busy === r.id + 'cancel';

  return (
    <Card className={`flex flex-col shadow-sm ${isCancelled ? 'opacity-60' : ''}`}>
      <CardContent className="flex flex-1 flex-col space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-extrabold">{r.reservationCode}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{r.name}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge kind="resv" status={resvCat} className="text-[10px]" />
            <StatusBadge kind="payCat" status={payCat} className="text-[10px]" />
          </div>
        </div>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" /> {formatDateShort(r.schedule.date)}
          <Clock className="ml-1.5 h-3 w-3" /> {r.schedule.time} WIB
        </p>

        <p className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="font-bold">{r.participantCount} Peserta</span>
          {resvCat === 'MENUNGGU' ? (
            <span className="font-semibold text-amber-700">kurang {IDEAL - r.participantCount} dari {IDEAL}</span>
          ) : resvCat === 'LENGKAP' ? (
            <span className="font-semibold text-emerald-700">minimal {IDEAL} terpenuhi</span>
          ) : (
            <span className="text-muted-foreground">{r.participantCount >= IDEAL ? `${IDEAL}+` : `< ${IDEAL}`} orang</span>
          )}
        </p>

        <div className="space-y-1.5 text-xs">
          {r.payment ? (
            <>
              <p className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Bayar</span>
                <span className="text-right font-semibold">
                  {formatRupiah(r.payment.amountPaid)}
                  <span className="font-normal text-muted-foreground"> / {formatRupiah(r.payment.totalAmount)}</span>
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Metode</span>
                <PaymentMethodBadge method={r.payment.paymentMethod} />
              </p>
            </>
          ) : (
            <p className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Bayar</span>
              <span className="font-medium text-muted-foreground">Belum ada pembayaran</span>
            </p>
          )}
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Kelompok</span>
            {groupEntry ? (
              <button
                onClick={() => onGroupDetail(groupEntry)}
                title={`Lihat detail kelompok ${groupEntry.groupCode}`}
                className="font-mono font-bold text-primary underline-offset-2 hover:underline"
              >
                {groupEntry.groupCode}
              </button>
            ) : (
              <span className="font-medium text-muted-foreground">Belum tergabung</span>
            )}
          </p>
        </div>

        <p className="border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
          Dibuat {formatRelative(r.createdAt)}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5">
          {ungroupedEntry && (
            <>
              <Button size="sm" className="flex-1 bg-sky-600 text-xs font-bold hover:bg-sky-700" onClick={() => onProses(ungroupedEntry)} disabled={working}>
                <Play className="mr-1 h-3.5 w-3.5" /> Proses
              </Button>
              <Button size="sm" variant="outline" className="text-xs font-bold" onClick={() => onDetail(ungroupedEntry)}>
                <UserRound className="mr-1 h-3.5 w-3.5" /> Detail
              </Button>
            </>
          )}
          {r.reservationStatus === 'MENUNGGU_PEMBAYARAN' && (
            <Button
              size="sm" variant="outline"
              className="flex-1 border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
              onClick={() => onConfirm(r)} disabled={working}
            >
              {busy === r.id + 'confirm' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />} Konfirmasi
            </Button>
          )}
          {r.reservationStatus === 'TERKONFIRMASI' && (
            <Button
              size="sm" variant="outline"
              className="flex-1 border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
              onClick={() => onComplete(r)} disabled={working}
            >
              {busy === r.id + 'complete' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1 h-3.5 w-3.5" />} Selesaikan
            </Button>
          )}
          {(r.reservationStatus === 'MENUNGGU_PEMBAYARAN' || r.reservationStatus === 'TERKONFIRMASI') && (
            <Button
              size="sm" variant="outline"
              className="border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
              onClick={() => onCancel(r)} disabled={working}
            >
              {busy === r.id + 'cancel' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Ban className="mr-1 h-3.5 w-3.5" />} Batalkan
            </Button>
          )}
          {isDone && !groupEntry && (
            <p className="w-full text-center text-[11px] font-medium text-muted-foreground">Aktivitas reservasi telah selesai.</p>
          )}
          {isCancelled && (
            <p className="w-full text-center text-[11px] font-medium text-muted-foreground">Reservasi telah dibatalkan.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ================= Kartu Kelompok =================
function GroupCard({
  group: g, busy, onDetail, onProses, onLanjutkan, onComplete,
}: {
  group: GroupDTO;
  busy: string;
  onDetail: () => void;
  onProses: () => void;
  onLanjutkan: () => void;
  onComplete: () => void;
}) {
  const a = g.guideAssignment ?? null;
  const isNew = g.progressStatus === 'NEW';
  const isOverdue = g.conditionStatus === 'OVERDUE';
  const isPending = g.conditionStatus === 'PENDING';

  return (
    <Card className={`shadow-sm transition-colors ${isOverdue ? 'border-rose-300' : isPending ? 'border-violet-200' : ''}`}>
      <CardContent className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-extrabold">{g.groupCode}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {g.mainReservationCode ?? '—'} · {g.mainCustomer ?? '—'}
            </p>
          </div>
          {isOverdue && <StatusBadge kind="condition" status="OVERDUE" className="shrink-0 text-[10px]" />}
          {isPending && <StatusBadge kind="condition" status="PENDING" className="shrink-0 text-[10px]" />}
        </div>

        <p className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="font-bold">{g.totalParticipants} Peserta</span>
          <span className="text-muted-foreground">{g.members.length} reservasi</span>
        </p>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" /> {formatDateShort(g.schedule.date)}
          <Clock className="ml-1.5 h-3 w-3" /> {g.schedule.time} WIB
        </p>

        <div className="space-y-1.5 text-xs">
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Pembayaran</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${g.paymentSummary?.allPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
              <Wallet className="h-3 w-3" /> {g.paymentSummary?.label ?? '—'}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Status</span>
            <StatusBadge status={g.status} className="text-[9px]" />
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Pemandu</span>
            {a ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <LifeBuoy className="h-3 w-3 shrink-0 text-sky-600" />
                <span className="truncate font-semibold text-sky-700">{a.guideName}</span>
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Belum ditentukan</span>
            )}
          </p>
        </div>

        <p className="border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
          Dibuat {formatRelative(g.createdAt)} · Terakhir diperbarui {formatRelative(g.lastActivity ?? g.createdAt)}
        </p>

        {isNew ? (
          <div className="space-y-2">
            <Button size="sm" className="w-full bg-sky-600 font-bold hover:bg-sky-700" onClick={onProses} disabled={busy === g.id + 'status'}>
              {busy === g.id + 'status' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />} Proses
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs font-bold" onClick={onDetail}>
              <UserRound className="mr-1.5 h-3.5 w-3.5" /> Lihat Detail
            </Button>
          </div>
        ) : g.progressStatus === 'IN_PROGRESS' ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs font-bold" onClick={onLanjutkan}>
                <Repeat className="mr-1.5 h-3.5 w-3.5" /> Lanjutkan
              </Button>
              <Button size="sm" className="flex-1 bg-emerald-600 font-bold hover:bg-emerald-700" onClick={onComplete}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Selesaikan
              </Button>
            </div>
            <Button size="sm" variant="outline" className="w-full text-xs font-bold" onClick={onDetail}>
              <UserRound className="mr-1.5 h-3.5 w-3.5" /> Lihat Detail
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full text-xs font-bold" onClick={onDetail}>
            <UserRound className="mr-1.5 h-3.5 w-3.5" /> Lihat Detail
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ================= Kartu Reservasi (belum terkelompokkan) =================
function ReservationCard({
  r, onDetail, onProses,
}: {
  r: UngroupedReservationDTO;
  onDetail: () => void;
  onProses: () => void;
}) {
  const isOverdue = r.condition === 'OVERDUE';
  const isPending = r.condition === 'PENDING';
  return (
    <Card className={`shadow-sm transition-colors ${isOverdue ? 'border-rose-300' : isPending ? 'border-violet-200' : 'border-dashed'}`}>
      <CardContent className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-extrabold">{r.reservationCode}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.name}</p>
          </div>
          {isOverdue && <StatusBadge kind="condition" status="OVERDUE" className="shrink-0 text-[10px]" />}
          {isPending && <StatusBadge kind="condition" status="PENDING" className="shrink-0 text-[10px]" />}
        </div>

        <p className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
          <span className="font-bold">{r.participantCount} Peserta</span>
          <span className="text-muted-foreground">belum bergrup</span>
        </p>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" /> {formatDateShort(r.date)}
          <Clock className="ml-1.5 h-3 w-3" /> {r.time} WIB
        </p>

        <div className="space-y-1.5 text-xs">
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Pembayaran</span>
            {r.payment ? (
              <span className={`inline-flex items-center gap-1 font-semibold ${r.payment.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                <Wallet className="h-3 w-3" /> {paymentDisplayLabel(r.payment.paymentStatus, r.payment.paymentMethod)}
              </span>
            ) : <span className="font-medium text-muted-foreground">—</span>}
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Status</span>
            <StatusBadge status={r.groupingStatus} className="text-[9px]" />
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Pemandu</span>
            <span className="font-medium text-muted-foreground">Belum ditentukan</span>
          </p>
        </div>

        <p className="border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
          Dibuat {formatRelative(r.createdAt)} · Terakhir diperbarui {formatRelative(r.updatedAt)}
        </p>

        <div className="space-y-2">
          <Button size="sm" className="w-full bg-sky-600 font-bold hover:bg-sky-700" onClick={onProses}>
            <Play className="mr-1.5 h-4 w-4" /> Proses
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs font-bold" onClick={onDetail}>
            <UserRound className="mr-1.5 h-3.5 w-3.5" /> Lihat Detail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ================= Dialog Konfirmasi Selesaikan =================
function ConfirmCompleteDialog({
  group, busy, onClose, onConfirm,
}: {
  group: GroupDTO | null;
  busy: string;
  onClose: () => void;
  onConfirm: (g: GroupDTO) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  if (!group) return null;
  const confirmed = group.status === 'LENGKAP' || group.status === 'SIAP_BERANGKAT';
  const hasGuide = !!group.guideAssignment;
  const allPaid = group.paymentSummary?.allPaid ?? false;
  const working = saving || busy === group.id + 'status';

  return (
    <Dialog open={!!group} onOpenChange={(open) => { if (!open && !working) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Selesaikan Pengelompokan
          </DialogTitle>
          <DialogDescription>
            {group.groupCode} · {group.totalParticipants} peserta · {formatDateShort(group.schedule.date)} {group.schedule.time} WIB
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-semibold leading-relaxed">
            Apakah pengelompokan ini sudah selesai dan siap dikonfirmasi?
          </p>
          <div className="space-y-1.5 rounded-xl border p-3 text-xs">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Konfirmasi kelompok</span>
              {confirmed
                ? <span className="font-bold text-emerald-700">✓ Terkonfirmasi</span>
                : <span className="font-semibold text-amber-700">⚠ Belum dikonfirmasi</span>}
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Pemandu</span>
              {hasGuide
                ? <span className="font-bold text-emerald-700">✓ {group.guideAssignment?.guideName}</span>
                : <span className="font-semibold text-amber-700">⚠ Belum ditentukan</span>}
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Pembayaran</span>
              <span className={`font-bold ${allPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                {allPaid ? '✓' : '⚠'} {group.paymentSummary?.label ?? '—'}
              </span>
            </p>
          </div>
          {(!confirmed || !hasGuide || !allPaid) && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Ada item yang belum lengkap. Anda tetap dapat menyelesaikan pengelompokan — gunakan
              "Lanjutkan" bila ingin melengkapi terlebih dahulu.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={working}>Batal</Button>
          <Button
            className="bg-emerald-600 font-bold hover:bg-emerald-700"
            disabled={working}
            onClick={async () => {
              setSaving(true);
              try { await onConfirm(group); } finally { setSaving(false); }
            }}
          >
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Ya, Selesaikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= Dialog Proses Pengelompokan (kartu TERBARU) =================
function ProcessReservationDialog({
  r, groups, recommendations, busy, onClose, onCreateGroup, onAddToGroup,
}: {
  r: UngroupedReservationDTO | null;
  groups: GroupDTO[];
  recommendations: RecommendationDTO[];
  busy: string;
  onClose: () => void;
  onCreateGroup: (reservationIds: string[], label: string) => Promise<boolean>;
  onAddToGroup: (group: GroupDTO, reservationId: string, resCode: string) => Promise<boolean>;
}) {
  const [working, setWorking] = useState(false);
  if (!r) return null;

  const recs = recommendations.filter((rec) => rec.reservations.some((x) => x.id === r.id));
  const joinable = groups.filter(
    (g) => g.scheduleId === r.scheduleId
      && g.status === 'MENUNGGU'
      && g.progressStatus !== 'DONE'
      && g.totalParticipants + r.participantCount <= IDEAL
  );
  const busyAny = working || busy === 'create-group' || busy === 'add-to-group';

  const run = async (fn: () => Promise<boolean>) => {
    setWorking(true);
    try { await fn(); } finally { setWorking(false); }
  };

  return (
    <Dialog open={!!r} onOpenChange={(open) => { if (!open && !busyAny) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2.5rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-sky-600" /> Proses Pengelompokan
          </DialogTitle>
          <DialogDescription>
            {r.reservationCode} · {r.name} · {r.participantCount} peserta · {formatDateShort(r.date)} {r.time} WIB
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
          {recs.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Rekomendasi Sistem
              </h4>
              <div className="space-y-2">
                {recs.map((rec) => (
                  <div key={rec.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs leading-relaxed">{rec.message}</p>
                    <Button
                      size="sm"
                      className={`mt-2 w-full text-xs font-bold ${rec.type === 'IDEAL' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'}`}
                      disabled={busyAny}
                      onClick={() =>
                        rec.type === 'ADD_TO_GROUP'
                          ? run(() => onAddToGroup(groups.find((g) => g.groupCode === rec.targetGroupCode)!, r.id, r.reservationCode))
                          : run(() => onCreateGroup(rec.reservations.map((x) => x.id), `${rec.totalParticipants} peserta`))
                      }
                    >
                      {rec.type === 'ADD_TO_GROUP'
                        ? <><UserPlus className="mr-1.5 h-3.5 w-3.5" /> Gabungkan ke {rec.targetGroupCode}</>
                        : <><Merge className="mr-1.5 h-3.5 w-3.5" /> Bentuk Kelompok ({rec.totalParticipants} peserta)</>}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {joinable.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" /> Gabung ke Kelompok Tersedia
              </h4>
              <div className="space-y-2">
                {joinable.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                    <div className="min-w-0 text-xs">
                      <p className="font-mono font-extrabold">{g.groupCode}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {g.totalParticipants}/{IDEAL} peserta · sisa {IDEAL - g.totalParticipants} slot · {g.members.length} reservasi
                      </p>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      className="shrink-0 border-sky-200 text-xs font-bold text-sky-700 hover:bg-sky-50"
                      disabled={busyAny}
                      onClick={() => run(() => onAddToGroup(g, r.id, r.reservationCode))}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Gabung
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" /> Buat Kelompok Baru
            </h4>
            <div className="rounded-xl border p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Bentuk kelompok baru dari reservasi {r.reservationCode} ({r.participantCount} peserta).
                Peserta lain dapat ditambahkan kemudian melalui rekomendasi sistem.
              </p>
              <Button
                size="sm"
                className="mt-2 w-full text-xs font-bold"
                disabled={busyAny}
                onClick={() => run(() => onCreateGroup([r.id], `${r.participantCount} peserta`))}
              >
                {busyAny ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Buat Kelompok Baru ({r.participantCount} peserta)
              </Button>
            </div>
          </section>

          {recs.length === 0 && joinable.length === 0 && (
            <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Belum ada rekomendasi penggabungan untuk reservasi ini. Anda dapat membuat kelompok baru
              atau menunggu peserta lain pada jadwal yang sama.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= Dialog Buat Pengelompokan Manual =================
function CreateGroupDialog({
  open, ungrouped, recommendations, busy, onClose, onCreateGroup,
}: {
  open: boolean;
  ungrouped: UngroupedReservationDTO[];
  recommendations: RecommendationDTO[];
  busy: string;
  onClose: () => void;
  onCreateGroup: (reservationIds: string[], label: string) => Promise<boolean>;
}) {
  const [scheduleId, setScheduleId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) {
      const first = ungrouped[0]?.scheduleId ?? '';
      setScheduleId(first);
      setSelected([]);
    }
  }, [open, ungrouped]);

  if (!open) return null;

  const schedules = [...new Map(ungrouped.map((r) => [r.scheduleId, r])).entries()];
  const list = ungrouped.filter((r) => r.scheduleId === scheduleId);
  const recsForSchedule = recommendations.filter((rec) => rec.scheduleId === scheduleId && rec.type !== 'ADD_TO_GROUP');
  const selectedTotal = list
    .filter((r) => selected.includes(r.id))
    .reduce((s, r) => s + r.participantCount, 0);
  const busyAny = working || busy === 'create-group';

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busyAny) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2.5rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Buat Pengelompokan
          </DialogTitle>
          <DialogDescription>
            Pilih jadwal keberangkatan, lalu pilih reservasi yang akan dikelompokkan.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-3.5 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
          <div>
            <Label className="mb-1.5 text-xs font-bold">Jadwal Keberangkatan</Label>
            <Select value={scheduleId} onValueChange={(v) => { setScheduleId(v); setSelected([]); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jadwal…" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map(([id, r]) => {
                  const n = ungrouped.filter((x) => x.scheduleId === id).length;
                  return (
                    <SelectItem key={id} value={id}>
                      {formatDateShort(r.date)} · {r.time} WIB ({n} menunggu)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {recsForSchedule.length > 0 && (
            <div>
              <Label className="mb-1.5 text-xs font-bold">Pilihan Cepat (Rekomendasi)</Label>
              <div className="flex flex-wrap gap-1.5">
                {recsForSchedule.map((rec) => (
                  <button
                    key={rec.id}
                    disabled={busyAny}
                    onClick={() => setSelected(rec.reservations.map((x) => x.id))}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    {rec.type === 'IDEAL' ? 'Ideal' : 'Parsial'} · {rec.totalParticipants} org ({rec.reservations.length} resv)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-1.5 text-xs font-bold">Reservasi Menunggu ({list.length})</Label>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Tidak ada reservasi menunggu pada jadwal ini.
              </p>
            ) : (
              <div className="space-y-2">
                {list.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      selected.includes(r.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <Checkbox
                      checked={selected.includes(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      disabled={busyAny}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">{r.name}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">{r.reservationCode}</span>
                    </span>
                    <span className="shrink-0 text-xs font-extrabold">{r.participantCount} org</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <div className={`rounded-xl border p-3 text-xs ${selectedTotal > IDEAL ? 'border-rose-200 bg-rose-50' : selectedTotal === IDEAL ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className="font-bold">
                {selected.length} reservasi terpilih · {selectedTotal}/{IDEAL} peserta
                {selectedTotal > IDEAL && <span className="ml-1 font-semibold text-rose-700">— melebihi kapasitas ideal</span>}
                {selectedTotal < IDEAL && <span className="ml-1 font-semibold text-amber-700">— menunggu {IDEAL - selectedTotal} peserta lagi</span>}
                {selectedTotal === IDEAL && <span className="ml-1 font-semibold text-emerald-700">— kelompok ideal</span>}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t pt-3.5">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busyAny}>Batal</Button>
            <Button
              className="flex-1 font-bold"
              disabled={selected.length === 0 || busyAny}
              onClick={async () => {
                setWorking(true);
                try {
                  const ok = await onCreateGroup(selected, `${selectedTotal} peserta`);
                  if (ok) setSelected([]);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {busyAny ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Buat Kelompok{selected.length > 0 ? ` (${selectedTotal} peserta)` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= Dialog Detail Reservasi (belum terkelompokkan) =================
function ReservationDetailDialog({
  r, onClose, onProses,
}: {
  r: UngroupedReservationDTO | null;
  onClose: () => void;
  onProses: (r: UngroupedReservationDTO) => void;
}) {
  if (!r) return null;
  return (
    <Dialog open={!!r} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2.5rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-mono">{r.reservationCode}</span>
            <StatusBadge kind="progress" status="NEW" />
            {r.condition !== 'NORMAL' && <StatusBadge kind="condition" status={r.condition} />}
          </DialogTitle>
          <DialogDescription>
            {formatDateShort(r.date)} · {r.time} WIB · {r.participantCount} peserta · {r.name}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">A. Informasi Reservasi</h3>
            <div className="grid grid-cols-2 gap-2">
              <MiniTile label="Kode Reservasi" value={r.reservationCode} mono />
              <MiniTile label="Nama Pemesan" value={r.name} />
              <MiniTile label="WhatsApp" value={formatPhone(r.phone)} />
              <MiniTile label="Tanggal Reservasi" value={formatDateTimeID(r.createdAt)} />
              <MiniTile label="Jumlah Peserta" value={`${r.participantCount} orang`} />
              <MiniTile label="Opsi" value={r.groupingOption === 'WAIT_GROUP' ? 'Menunggu Kelompok' : r.groupingOption === 'DEPART_NOW' ? 'Tetap Berangkat' : 'Lengkap'} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">B. Informasi Keberangkatan</h3>
            <div className="grid grid-cols-2 gap-2">
              <MiniTile label="Tanggal" value={formatDateShort(r.date)} />
              <MiniTile label="Jam" value={`${r.time} WIB`} />
              <MiniTile label="Kapasitas Jadwal" value={`${r.scheduleCapacity.capacity} orang`} />
              <MiniTile label="Terisi" value={`${r.scheduleCapacity.used} orang`} />
              <MiniTile label="Sisa Kapasitas" value={`${r.scheduleCapacity.remaining} orang`} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">C. Informasi Pengelompokan</h3>
            <div className="grid grid-cols-2 gap-2">
              <MiniTile label="Kode Grup" value="— belum tersedia" />
              <MiniTile label="Jumlah Anggota" value="—" />
              <MiniTile label="Status Progress" value={PROGRESS_STATUS_LABEL.NEW} />
              <MiniTile label="Status Kondisi" value={CONDITION_STATUS_LABEL[r.condition]} />
            </div>
            <p className="mt-2 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              Reservasi ini belum dikelompokkan. Tekan "Proses Pengelompokan" untuk membentuk atau
              mencari kelompok yang sesuai. {CONDITION_STATUS_DESC[r.condition]}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">D. Informasi Pemandu</h3>
            <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              Belum ada pemandu — pemandu ditugaskan setelah kelompok terbentuk dan dikonfirmasi.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">E. Pembayaran</h3>
            {r.payment ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <MiniTile label="Total Tagihan" value={formatRupiah(r.payment.totalAmount)} />
                  <MiniTile label="Dibayar" value={formatRupiah(r.payment.amountPaid)} />
                  <MiniTile label="Sisa" value={formatRupiah(r.payment.remainingAmount)} />
                  <MiniTile label="Status" value={paymentDisplayLabel(r.payment.paymentStatus, r.payment.paymentMethod)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Jenis:</span>
                  <PaymentMethodBadge method={r.payment.paymentMethod} />
                  <PaymentStatusBadge status={r.payment.paymentStatus} method={r.payment.paymentMethod} />
                </div>
              </>
            ) : (
              <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">Belum ada data pembayaran.</p>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t pt-3.5">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Tutup</Button>
            <Button className="flex-1 bg-sky-600 font-bold hover:bg-sky-700" onClick={() => onProses(r)}>
              <Play className="mr-2 h-4 w-4" /> Proses Pengelompokan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MiniTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xs font-extrabold leading-snug ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
