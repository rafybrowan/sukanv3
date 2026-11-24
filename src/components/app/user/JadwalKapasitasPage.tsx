'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Info, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CapacityBar } from '@/components/app/shared/CapacityBar';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { navigate } from '@/components/app/router';
import { api } from '@/lib/api-client';
import { addDaysStr, dayShort, formatDateID, formatDateShort, todayJakarta } from '@/lib/format';
import type { ScheduleStats } from '@/lib/types';
import { cn } from '@/lib/utils';

export function useSchedules() {
  const [schedules, setSchedules] = useState<ScheduleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayJakarta();

  const refresh = useCallback(() => {
    setLoading(true);
    api('/api/schedules')
      .then((d) => setSchedules(d.schedules))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api('/api/schedules')
      .then((d) => { if (!cancelled) setSchedules(d.schedules); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { schedules, loading, today, refresh };
}

export function JadwalPage() {
  const { schedules, loading, today } = useSchedules();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysStr(today, i)), [today]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const selected = selectedDay || days[0] || '';

  const list = schedules.filter((s) => s.date === selected);
  const dateInfo = (d: string) => {
    const items = schedules.filter((s) => s.date === d);
    const available = items.filter((s) => s.availability === 'TERSEDIA' || s.availability === 'HAMPIR_PENUH').length;
    return { count: items.length, available };
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary">Jadwal Keberangkatan</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Pilih Jadwal Terbaik Anda</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Lihat ketersediaan jadwal beserta kapasitasnya. Setiap jadwal memiliki batas peserta agar
          pengalaman Anda tetap aman dan nyaman.
        </p>
      </div>

      {/* Pemilih tanggal */}
      <div className="mb-8">
        <div className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {days.map((d) => {
            const info = dateInfo(d);
            const active = selected === d;
            const weekend = [0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay());
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                disabled={info.count === 0}
                className={cn(
                  'flex w-[86px] flex-col items-center rounded-xl border px-3 py-3 transition-all',
                  active ? 'border-primary bg-primary text-white shadow-md' : 'border-border bg-white hover:border-primary/40 hover:bg-muted/50',
                  info.count === 0 && 'cursor-not-allowed opacity-40'
                )}
              >
                <span className={cn('text-[11px] font-bold uppercase', active ? 'text-emerald-100' : 'text-muted-foreground')}>
                  {dayShort(d)}
                </span>
                <span className="mt-0.5 text-xl font-extrabold">{d.slice(8, 10)}</span>
                <span className={cn('text-[10px]', active ? 'text-emerald-100/80' : 'text-muted-foreground')}>
                  {formatDateShort(d).split(' ')[1]}
                </span>
                {weekend && !active && <span className="mt-1 rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">POPULER</span>}
                {weekend && active && <span className="mt-1 rounded-full bg-white/20 px-1.5 text-[9px] font-bold text-white">POPULER</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daftar jadwal */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Belum ada jadwal pada tanggal ini"
          description="Silakan pilih tanggal lain. Jadwal baru ditambahkan secara berkala oleh admin."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((s) => {
            const bookable = s.availability === 'TERSEDIA' || s.availability === 'HAMPIR_PENUH';
            return (
              <Card key={s.id} className={cn('transition-shadow', bookable ? 'hover:shadow-md' : 'opacity-90')}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <span className="flex h-13 w-13 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 py-1">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-extrabold text-primary">{s.time}</span>
                      </span>
                      <div>
                        <p className="font-bold">{formatDateID(s.date, false)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.currentParticipants} dari {s.capacity} peserta terisi</p>
                      </div>
                    </div>
                    <StatusBadge status={s.availability} />
                  </div>
                  <div className="mt-5">
                    <CapacityBar filled={s.currentParticipants} capacity={s.capacity} showLabel />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className={cn('text-sm font-semibold', s.remaining <= 5 && bookable ? 'text-orange-600' : 'text-muted-foreground')}>
                      {s.availability === 'PENUH' ? 'Slot sudah habis' : `${s.remaining} slot tersisa`}
                    </p>
                    {bookable ? (
                      <Button onClick={() => navigate(`/reservasi?scheduleId=${s.id}`)} className="font-bold">
                        <Zap className="mr-1 h-4 w-4" /> Pesan Jadwal Ini
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>
                        Tidak Tersedia
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div className="text-sm text-sky-900">
          <p className="font-bold">Informasi Kapasitas &amp; Pengelompokan</p>
          <p className="mt-1 leading-relaxed text-sky-800/90">
            Setiap jadwal melayani maksimal <b>{list[0]?.capacity ?? 60} peserta</b>. Keberangkatan dikelompokkan ideal
            7 orang — jika pesanan Anda kurang dari 7 orang, Anda dapat memilih opsi <b>Tunggu Kelompok</b> atau{' '}
            <b>Tetap Berangkat</b> saat reservasi.
          </p>
        </div>
      </div>
    </div>
  );
}

export function KapasitasPage() {
  const { schedules, loading, today } = useSchedules();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(today, i)), [today]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const selected = selectedDay || days[0] || '';

  const upcoming = schedules.filter((s) => s.date >= today);
  const totalCap = upcoming.reduce((s, x) => s + x.capacity, 0);
  const totalFilled = upcoming.reduce((s, x) => s + x.currentParticipants, 0);
  const avgUtil = totalCap > 0 ? Math.round((totalFilled / totalCap) * 100) : 0;
  const list = schedules.filter((s) => s.date === selected);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary">Kapasitas Keberangkatan</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Pantau Ketersediaan Slot</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Informasi kapasitas real-time seluruh jadwal mendatang. Pastikan slot masih tersedia sebelum reservasi.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Jadwal Mendatang', value: upcoming.length, suffix: 'jadwal', icon: CalendarDays, color: 'text-primary bg-primary/10' },
          { label: 'Total Kapasitas', value: totalCap, suffix: 'orang', icon: Users, color: 'text-sky-600 bg-sky-50' },
          { label: 'Sudah Terisi', value: totalFilled, suffix: 'orang', icon: ChevronRight, color: 'text-amber-600 bg-amber-50' },
          { label: 'Rata-rata Okupansi', value: avgUtil, suffix: '%', icon: Zap, color: 'text-emerald-600 bg-emerald-50' },
        ].map((c) => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', c.color)}>
                <c.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold leading-none">{c.value}<span className="ml-1 text-sm font-semibold text-muted-foreground">{c.suffix}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pilih hari */}
      <div className="mb-6 flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              selected === d ? 'border-primary bg-primary text-white' : 'border-border bg-white hover:bg-muted'
            )}
          >
            {formatDateShort(d)} {d === today && '· Hari Ini'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Tidak ada jadwal pada tanggal ini" />
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex w-32 shrink-0 items-center gap-2.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-extrabold">{s.time}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateShort(s.date)}</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <CapacityBar filled={s.currentParticipants} capacity={s.capacity} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {s.currentParticipants} terisi · {s.remaining} sisa · {s.utilization}% terpakai
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {s.utilization >= 100 ? (
                    <span className="text-xs font-bold text-rose-600">Penuh</span>
                  ) : s.utilization > 80 ? (
                    <span className="text-xs font-bold text-orange-600">Jadwal hampir penuh</span>
                  ) : null}
                  <StatusBadge status={s.availability} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Button size="lg" onClick={() => navigate('/reservasi')} className="font-bold">
          Reservasi Sekarang <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
