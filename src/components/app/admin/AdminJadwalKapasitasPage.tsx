'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, CalendarDays, CalendarPlus, CheckCircle2, Clock, Gauge, Loader2,
  Pencil, Plus, RefreshCw, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CapacityBar } from '@/components/app/shared/CapacityBar';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { addDaysStr, formatDateID, formatDateShort, todayJakarta } from '@/lib/format';
import type { ScheduleStats } from '@/lib/types';

// ================= HALAMAN JADWAL (CRUD) =================
export function AdminJadwalPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleStats | null>(null);
  const [deleting, setDeleting] = useState<ScheduleStats | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = filterDate ? `?date=${filterDate}` : '';
    api(`/api/schedules${qs}`)
      .then((d) => setSchedules(d.schedules))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (s: ScheduleStats, status: string) => {
    try {
      await api(`/api/admin/schedules/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast({
        title: status === 'AKTIF' ? 'Jadwal diaktifkan' : status === 'DITUTUP' ? 'Jadwal ditutup' : 'Jadwal ditunda',
        description: `${formatDateShort(s.date)} · ${s.time}`,
      });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/schedules/${deleting.id}`, { method: 'DELETE' });
      toast({ title: 'Jadwal dihapus' });
      setDeleting(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // kelompokkan per tanggal
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleStats[]>();
    for (const s of schedules) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Jadwal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola jadwal keberangkatan dan status operasionalnya.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="font-bold">
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Jadwal
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Filter Tanggal</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          {filterDate && (
            <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Hapus filter</Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : byDate.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Tidak ada jadwal" description="Tambahkan jadwal baru atau ubah filter tanggal." action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><CalendarPlus className="mr-2 h-4 w-4" /> Tambah Jadwal</Button>} />
      ) : (
        <div className="space-y-5">
          {byDate.map(([date, list]) => (
            <div key={date}>
              <div className="mb-2.5 flex items-center gap-2">
                <h3 className="text-sm font-extrabold">{formatDateID(date)}</h3>
                {date === todayJakarta() && <Badge className="bg-emerald-600 text-white">Hari Ini</Badge>}
                <span className="text-xs text-muted-foreground">{list.length} jadwal</span>
              </div>
              <div className="space-y-2.5">
                {list.map((s) => (
                  <Card key={s.id} className="shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                      <div className="flex w-28 shrink-0 items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-lg font-extrabold">{s.time}</span>
                      </div>
                      <div className="min-w-0 flex-1 lg:max-w-md">
                        <CapacityBar filled={s.currentParticipants} capacity={s.capacity} showLabel />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Terisi {s.currentParticipants} · Sisa {s.remaining} · {s.reservationCount} reservasi
                        </p>
                      </div>
                      <StatusBadge status={s.status} className="shrink-0" />
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(s); setFormOpen(true); }} aria-label="Edit jadwal">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {s.status === 'AKTIF' ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setStatus(s, 'DITUTUP')} aria-label="Tutup jadwal" title="Nonaktifkan (DITUTUP)">
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => setStatus(s, 'AKTIF')} aria-label="Aktifkan jadwal" title="Aktifkan kembali">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setDeleting(s)} disabled={s.reservationCount > 0} aria-label="Hapus jadwal" title={s.reservationCount > 0 ? 'Tidak dapat dihapus (ada reservasi)' : 'Hapus'}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog tambah/edit jadwal */}
      <ScheduleFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus jadwal {deleting?.time}?</AlertDialogTitle>
            <AlertDialogDescription>
              Jadwal {deleting ? formatDateShort(deleting.date) : ''} pukul {deleting?.time} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ScheduleFormDialog({ open, editing, onClose, onSaved }: {
  open: boolean; editing: ScheduleStats | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [capacity, setCapacity] = useState(60);
  const [status, setStatus] = useState('AKTIF');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDate(editing?.date || addDaysStr(todayJakarta(), 1));
      setTime(editing?.time || '09:00');
      setCapacity(editing?.capacity ?? 60);
      setStatus(editing?.status ?? 'AKTIF');
      setError('');
    }
  }, [open, editing]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/api/admin/schedules/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ date, time, capacity: Number(capacity), status }) });
        toast({ title: 'Jadwal diperbarui' });
      } else {
        await api('/api/admin/schedules', { method: 'POST', body: JSON.stringify({ date, time, capacity: Number(capacity) }) });
        toast({ title: 'Jadwal ditambahkan', description: `${date} · ${time}` });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit Jadwal (${formatDateShort(editing.date)} ${editing.time})` : 'Tambah Jadwal Baru'}</DialogTitle>
          <DialogDescription>Atur tanggal, jam, kapasitas, dan status operasional jadwal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jam</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Kapasitas (maks. peserta)</Label>
            <Input type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIF">Aktif — menerima reservasi</SelectItem>
                  <SelectItem value="DITUTUP">Ditutup — tidak menerima reservasi</SelectItem>
                  <SelectItem value="DITUNDA">Ditunda — sementara tidak tersedia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
          <Button onClick={save} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {editing ? 'Simpan Perubahan' : 'Tambah Jadwal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= HALAMAN KAPASITAS (ADMIN) =================
export function AdminKapasitasPage() {
  const [schedules, setSchedules] = useState<ScheduleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayJakarta();

  useEffect(() => {
    let cancelled = false;
    api('/api/schedules')
      .then((d) => { if (!cancelled) setSchedules((d.schedules as ScheduleStats[]).filter((s) => s.date >= today)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(today, i)), [today]);
  const [selectedDay, setSelectedDay] = useState('');
  const selected = selectedDay || days[0] || '';

  const totalCap = schedules.reduce((s, x) => s + x.capacity, 0);
  const totalFilled = schedules.reduce((s, x) => s + x.currentParticipants, 0);
  const almostFull = schedules.filter((s) => s.utilization > 80 && s.utilization < 100).length;
  const full = schedules.filter((s) => s.utilization >= 100).length;
  const list = schedules.filter((s) => s.date === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Kapasitas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pantau tingkat keterisian setiap jadwal dan identifikasi jadwal yang hampir penuh.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Kapasitas (mendatang)', value: `${totalFilled} / ${totalCap}`, icon: Users, color: 'text-primary bg-primary/10' },
          { label: 'Rata-rata Okupansi', value: `${totalCap ? Math.round((totalFilled / totalCap) * 100) : 0}%`, icon: Gauge, color: 'text-sky-600 bg-sky-50' },
          { label: 'Jadwal Hampir Penuh', value: almostFull, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
          { label: 'Jadwal Penuh', value: full, icon: Ban, color: 'text-rose-600 bg-rose-50' },
        ].map((c) => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.color}`}><c.icon className="h-5 w-5" /></span>
              <div>
                <p className="text-2xl font-extrabold leading-none">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${selected === d ? 'border-primary bg-primary text-white' : 'border-border bg-white hover:bg-muted'}`}
          >
            {formatDateShort(d)} {d === today && '· Hari Ini'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Tidak ada jadwal pada tanggal ini" />
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <Card key={s.id} className="shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="w-24 shrink-0">
                  <p className="text-xl font-extrabold">{s.time}</p>
                  <p className="text-xs text-muted-foreground">{formatDateShort(s.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <CapacityBar filled={s.currentParticipants} capacity={s.capacity} showLabel />
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <StatusBadge status={s.availability} />
                  {s.utilization > 80 && s.utilization < 100 && <p className="text-xs font-bold text-orange-600">Jadwal hampir penuh</p>}
                  {s.utilization >= 100 && <p className="text-xs font-bold text-rose-600">Penuh</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
