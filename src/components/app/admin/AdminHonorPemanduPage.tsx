'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Banknote, HandCoins, Loader2, RefreshCw, LifeBuoy, ListChecks, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { formatDateID, formatDateShort, formatRupiah } from '@/lib/format';

export function AdminHonorPemanduPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [filters, setFilters] = useState({ date: '', guideId: '', paymentStatus: '' });

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    api(`/api/admin/assignments?${qs}`)
      .then((d) => { setAssignments(d.assignments); setSummary(d.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
    api('/api/admin/guides').then((d) => setGuides(d.guides)).catch(() => {});
  }, [load]);

  const honorAction = async (a: any, paymentStatus: string) => {
    setBusyId(a.id + paymentStatus);
    try {
      const d = await api<{ message: string }>(`/api/admin/assignments/${a.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'honor', paymentStatus }),
      });
      toast({ title: 'Status honor diperbarui', description: d.message });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const markComplete = async (a: any) => {
    setBusyId(a.id + 'complete');
    try {
      const d = await api<{ message: string }>(`/api/admin/assignments/${a.id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'complete' }),
      });
      toast({ title: 'Kegiatan selesai', description: d.message });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const cards = summary ? [
    { label: 'Total Penugasan', value: String(summary.totalAssignments), icon: ListChecks, color: 'bg-primary/10 text-primary' },
    { label: 'Total Honor', value: formatRupiah(summary.totalHonor), icon: Wallet, color: 'bg-sky-100 text-sky-700' },
    { label: 'Honor Belum Dibayar', value: formatRupiah(summary.honorUnpaid), icon: HandCoins, color: 'bg-amber-100 text-amber-700' },
    { label: 'Honor Sudah Dibayar', value: formatRupiah(summary.honorPaid), icon: BadgeCheck, color: 'bg-emerald-100 text-emerald-700' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <HandCoins className="h-6 w-6 text-primary" /> Honor Guide
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pencatatan honor pemandu berdasarkan penugasan — dari belum diproses hingga sudah dibayar.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang</Button>
      </div>

      {/* ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : cards.map((c) => (
            <Card key={c.label} className="shadow-sm">
              <CardContent className="p-5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.color}`}>
                  <c.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-2xl font-extrabold leading-none tabular-nums">{c.value}</p>
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* filter */}
      <Card className="shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tanggal Penugasan</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Guide</Label>
            <Select value={filters.guideId || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, guideId: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Semua guide" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Guide</SelectItem>
                {guides.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status Honor</Label>
            <Select value={filters.paymentStatus || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="BELUM_DIPROSES">Belum Diproses</SelectItem>
                <SelectItem value="SIAP_DIBAYARKAN">Siap Dibayar</SelectItem>
                <SelectItem value="SUDAH_DIBAYARKAN">Sudah Dibayar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Terapkan</Button>
          </div>
        </CardContent>
      </Card>

      {/* tabel */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Belum ada data honor"
          description="Data honor muncul setelah guide ditugaskan ke kelompok. Tugaskan guide melalui halaman Pengelompokan."
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[960px] w-full">
                <TableHeader>
                  <TableRow className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <TableHead className="px-5 py-3 font-semibold">Guide</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Tanggal</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Jam</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Kelompok</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Peserta</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Honor</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Penugasan</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Status Honor</TableHead>
                    <TableHead className="whitespace-nowrap px-5 py-3 font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/40">
                      <TableCell className="px-5 py-3.5">
                        <p className="font-bold">{a.guideName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{a.guideCode}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-3.5 text-muted-foreground" title={formatDateID(a.assignmentDate)}>
                        {formatDateShort(a.assignmentDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{a.startTime}</TableCell>
                      <TableCell className="px-5 py-3.5"><span className="font-mono text-xs font-bold text-primary">{a.groupCode}</span></TableCell>
                      <TableCell className="px-5 py-3.5"><b>{a.participantCount}</b> org</TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-3.5 font-bold">{formatRupiah(a.rate)}</TableCell>
                      <TableCell className="px-5 py-3.5"><StatusBadge status={a.assignmentStatus} /></TableCell>
                      <TableCell className="px-5 py-3.5"><StatusBadge status={a.paymentStatus} /></TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {a.assignmentStatus === 'DITUGASKAN' && (
                            <Button
                              size="sm" variant="outline"
                              className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              disabled={busyId === a.id + 'complete'}
                              onClick={() => markComplete(a)}
                              title="Tandai kegiatan selesai — honor akan masuk daftar siap dibayar"
                            >
                              {busyId === a.id + 'complete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                              <span className="ml-1.5">Selesai</span>
                            </Button>
                          )}
                          {a.paymentStatus === 'BELUM_DIPROSES' && (
                            <Button
                              size="sm" variant="outline"
                              className="h-8 border-sky-200 text-sky-700 hover:bg-sky-50"
                              disabled={busyId === a.id + 'SIAP_DIBAYARKAN'}
                              onClick={() => honorAction(a, 'SIAP_DIBAYARKAN')}
                            >
                              {busyId === a.id + 'SIAP_DIBAYARKAN' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                              <span className="ml-1.5">Siap Bayar</span>
                            </Button>
                          )}
                          {a.paymentStatus === 'SIAP_DIBAYARKAN' && a.assignmentStatus === 'SELESAI' && (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 font-bold hover:bg-emerald-700"
                              disabled={busyId === a.id + 'SUDAH_DIBAYARKAN'}
                              onClick={() => honorAction(a, 'SUDAH_DIBAYARKAN')}
                            >
                              {busyId === a.id + 'SUDAH_DIBAYARKAN' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                              <span className="ml-1.5">Tandai Dibayar</span>
                            </Button>
                          )}
                          {a.paymentStatus === 'SUDAH_DIBAYARKAN' && (
                            <span className="flex h-8 items-center gap-1.5 text-xs font-semibold text-emerald-600">
                              <BadgeCheck className="h-4 w-4" /> Selesai
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
        Catatan: sistem hanya mencatat dan mengelola status honor (BELUM DIPROSES → SIAP DIBAYARKAN → SUDAH DIBAYARKAN).
        Pembayaran aktual tetap dilakukan oleh pihak pengelola di luar sistem. Honor mengikuti tarif yang tercatat saat penugasan.
      </p>
    </div>
  );
}
