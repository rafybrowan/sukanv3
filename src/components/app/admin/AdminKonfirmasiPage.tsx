'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, Check, Loader2, Save, UserCheck, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { formatDateID, todayJakarta } from '@/lib/format';
import type { ReservationDTO } from '@/lib/types';

export function AdminKonfirmasiPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayJakarta());
  const [rows, setRows] = useState<ReservationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api(`/api/admin/reservations?date=${date}`)
      .then((d) => {
        const list = (d.reservations as ReservationDTO[]).filter(
          (r) => r.reservationStatus === 'TERKONFIRMASI' || r.reservationStatus === 'SELESAI'
        );
        setRows(list);
        const map: Record<string, number> = {};
        for (const r of list) map[r.id] = r.actualParticipantCount ?? r.participantCount;
        setActuals(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const confirmed = rows.filter((r) => r.actualParticipantCount != null);
    const mismatch = confirmed.filter((r) => r.actualParticipantCount !== r.participantCount).length;
    const totalBooking = rows.reduce((s, r) => s + r.participantCount, 0);
    const totalActual = confirmed.reduce((s, r) => s + (r.actualParticipantCount || 0), 0);
    return { totalBooking, totalActual, mismatch, confirmed: confirmed.length };
  }, [rows]);

  const save = async (r: ReservationDTO) => {
    setSavingId(r.id);
    try {
      await api(`/api/admin/reservations/${r.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'actual', actualCount: actuals[r.id] }),
      });
      toast({ title: 'Konfirmasi peserta tersimpan', description: `${r.reservationCode} — aktual ${actuals[r.id]} orang.` });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Konfirmasi Peserta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catat jumlah peserta aktual saat hari H dan cocokkan dengan data reservasi.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tanggal Keberangkatan</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3 text-sm">
            <Badge variant="outline" className="border-border bg-muted/50">
              Booking: <b className="ml-1 text-foreground">{stats.totalBooking} org</b>
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Aktual: <b className="ml-1">{stats.totalActual} org</b>
            </Badge>
            {stats.mismatch > 0 && (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                <AlertTriangle className="mr-1 h-3 w-3" /> {stats.mismatch} selisih
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Tidak ada keberangkatan pada tanggal ini"
          description="Pilih tanggal lain atau cek jadwal yang tersedia."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const actual = actuals[r.id] ?? r.participantCount;
            const mismatch = actual !== r.participantCount;
            return (
              <Card key={r.id} className={`shadow-sm ${mismatch ? 'border-rose-300' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{r.reservationCode}</span>
                        <span className="font-bold">{r.name}</span>
                        <StatusBadge status={r.reservationStatus} />
                        {r.payment && <PaymentMethodBadge method={r.payment.paymentMethod} />}
                        {r.payment && <PaymentStatusBadge status={r.payment.paymentStatus} method={r.payment.paymentMethod} />}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatDateID(r.schedule.date)} · {r.schedule.time} · dibayar {r.payment ? `${r.payment.amountPaid.toLocaleString('id-ID')}` : '-'}
                      </p>
                      {mismatch && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Jumlah peserta aktual berbeda dengan data reservasi.
                        </p>
                      )}
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Booking</p>
                        <p className="text-2xl font-extrabold">{r.participantCount}</p>
                      </div>
                      <div className="text-center text-muted-foreground">→</div>
                      <div className="space-y-1">
                        <Label htmlFor={`actual-${r.id}`} className="text-[10px] font-bold uppercase text-muted-foreground">Aktual</Label>
                        <Input
                          id={`actual-${r.id}`}
                          type="number" min={0} max={200}
                          value={actual}
                          onChange={(e) => setActuals((a) => ({ ...a, [r.id]: Number(e.target.value) }))}
                          className={`w-20 text-center font-bold ${mismatch ? 'border-rose-300' : ''}`}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => save(r)}
                        disabled={savingId === r.id}
                        className={mismatch ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                      >
                        {savingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : actual === r.participantCount ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        <span className="ml-1.5">Simpan</span>
                      </Button>
                    </div>
                  </div>
                  {!mismatch && r.actualParticipantCount != null && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Sesuai — {r.actualParticipantCount} orang terkonfirmasi hadir.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <p className="text-sm leading-relaxed text-sky-800">
          <b>Cara kerja:</b> input jumlah peserta aktual yang datang, lalu tekan Simpan. Jika berbeda dengan
          data booking, sistem menampilkan peringatan selisih untuk ditindaklanjuti (penyesuaian pembayaran atau pelunasan di lokasi).
        </p>
      </div>
    </div>
  );
}
