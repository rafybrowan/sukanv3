'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Banknote, Eye, History, Loader2, RefreshCw, Search, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { formatDateShort, formatRupiah, formatDateTimeID } from '@/lib/format';

export function AdminPembayaranPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ method: '', status: '', date: '', q: '' });
  const [detail, setDetail] = useState<any>(null);
  const [settling, setSettling] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    api(`/api/admin/payments?${qs}`)
      .then((d) => setPayments(d.payments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const doSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      await api(`/api/admin/payments/${settling.id}/settle`, { method: 'POST', body: JSON.stringify({}) });
      toast({
        title: 'Pembayaran dikonfirmasi',
        description: `${settling.reservation.reservationCode} — pembayaran kini LUNAS.`,
      });
      setSettling(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Dapat dikonfirmasi bila pembayaran belum diterima penuh (Belum Bayar) —
  // mencakup Bayar di Tempat (dibayar di lokasi) maupun Lunas yang belum dibayar
  // (admin memverifikasi bukti pembayaran yang diterima).
  const canSettle = (p: any) => p.paymentStatus === 'UNPAID' && p.remainingAmount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Manajemen Pembayaran</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfirmasi pembayaran yang telah diterima, termasuk pembayaran langsung di lokasi saat hari H.
        </p>
      </div>

      {/* Filter */}
      <Card className="shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Kode / nama…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tanggal Jadwal</Label>
            <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Metode</Label>
            <Select value={filters.method || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, method: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="FULL_PAYMENT">Lunas</SelectItem>
                <SelectItem value="ONSITE">Bayar di Tempat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filters.status || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="PAID">Lunas</SelectItem>
                <SelectItem value="UNPAID">Belum Bayar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title="Tidak ada data pembayaran" description="Coba ubah filter." />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jadwal</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Dibayar</TableHead>
                    <TableHead>Sisa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-bold whitespace-nowrap">{p.reservation.reservationCode}</TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{p.reservation.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(p.reservation.schedule.date)} · {p.reservation.schedule.time}</TableCell>
                      <TableCell className="whitespace-nowrap font-bold">{formatRupiah(p.totalAmount)}</TableCell>
                      <TableCell><PaymentMethodBadge method={p.paymentMethod} /></TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-emerald-700">{formatRupiah(p.amountPaid)}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.remainingAmount > 0 ? <span className="font-semibold text-orange-600">{formatRupiah(p.remainingAmount)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><PaymentStatusBadge status={p.paymentStatus} method={p.paymentMethod} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(p)} aria-label="Riwayat">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canSettle(p) && (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 font-bold hover:bg-emerald-700"
                              onClick={() => setSettling(p)}
                            >
                              <BadgeCheck className="mr-1 h-4 w-4" />
                              Konfirmasi Pembayaran
                            </Button>
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

      {/* Detail riwayat */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{detail.reservation.reservationCode}</span>
                  <PaymentMethodBadge method={detail.paymentMethod} />
                  <PaymentStatusBadge status={detail.paymentStatus} method={detail.paymentMethod} />
                </DialogTitle>
                <DialogDescription>{detail.reservation.name} · {formatDateShort(detail.reservation.schedule.date)} {detail.reservation.schedule.time}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-2.5">
                  <AmountBox label="Total" value={formatRupiah(detail.totalAmount)} />
                  <AmountBox label="Dibayar" value={formatRupiah(detail.amountPaid)} green />
                  <AmountBox label="Sisa" value={formatRupiah(detail.remainingAmount)} orange={detail.remainingAmount > 0} />
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 font-bold"><History className="h-4 w-4 text-muted-foreground" /> Riwayat Pembayaran</p>
                  {detail.history.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground">Belum ada transaksi.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.history.map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                          <div>
                            <p className="font-bold">
                              {h.type === 'FULL' ? 'Pembayaran Lunas' : h.type === 'SETTLEMENT' ? 'Pelunasan' : 'Bayar di Tempat'}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDateTimeID(h.createdAt)} · {h.transactionCode}</p>
                            {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                          </div>
                          <b className="text-emerald-600">+{formatRupiah(h.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi pembayaran */}
      <AlertDialog open={!!settling} onOpenChange={(o) => !o && setSettling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {settling?.paymentMethod === 'ONSITE'
                ? 'Konfirmasi pembayaran di tempat?'
                : 'Konfirmasi pembayaran diterima?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {settling?.reservation?.reservationCode} — {settling?.reservation?.name}
                </p>
                <div className="space-y-1 rounded-xl bg-muted p-3.5 text-sm">
                  <p className="flex justify-between"><span className="text-muted-foreground">Total</span><b>{formatRupiah(settling?.totalAmount ?? 0)}</b></p>
                  <p className="flex justify-between"><span className="text-muted-foreground">Sudah dibayar</span><b>{formatRupiah(settling?.amountPaid ?? 0)}</b></p>
                  <p className="flex justify-between"><span className="text-muted-foreground">Diterima sekarang</span><b className="text-emerald-600">{formatRupiah(settling?.remainingAmount ?? 0)}</b></p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doSettle} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Ya, Catat Pembayaran
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AmountBox({ label, value, green, orange }: { label: string; value: string; green?: boolean; orange?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-center">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-extrabold ${green ? 'text-emerald-600' : orange ? 'text-orange-600' : ''}`}>{value}</p>
    </div>
  );
}
