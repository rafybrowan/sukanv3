'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Ban, CheckCircle2, Eye, Loader2, Pencil, RefreshCw, Search, ClipboardList, FileEdit, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { formatDateID, formatDateShort, formatRupiah, CHANGE_REQUEST_LABEL, formatDateTimeID } from '@/lib/format';
import type { ChangeRequestDTO, ReservationDTO } from '@/lib/types';

export function AdminReservasiPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReservationDTO[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date: '', status: '', time: '', method: '', paymentStatus: '', q: '' });

  // dialog state
  const [detail, setDetail] = useState<ReservationDTO | null>(null);
  const [editing, setEditing] = useState<ReservationDTO | null>(null);
  const [cancelling, setCancelling] = useState<ReservationDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    api(`/api/admin/reservations?${qs}`)
      .then((d) => setRows(d.reservations))
      .catch(() => {})
      .finally(() => setLoading(false));
    api('/api/admin/change-requests').then((d) => setChangeRequests(d.changeRequests)).catch(() => {});
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api(`/api/admin/reservations/${cancelling.id}`, { method: 'POST', body: JSON.stringify({ action: 'cancel' }) });
      toast({ title: 'Reservasi dibatalkan', description: `${cancelling.reservationCode} telah dibatalkan.` });
      setCancelling(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async (r: ReservationDTO) => {
    try {
      await api(`/api/admin/reservations/${r.id}`, { method: 'POST', body: JSON.stringify({ action: 'confirm' }) });
      toast({ title: 'Reservasi dikonfirmasi', description: `${r.reservationCode} kini berstatus Terkonfirmasi.` });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const processChangeRequest = async (cr: ChangeRequestDTO, status: 'APPROVED' | 'REJECTED', adminNote?: string) => {
    try {
      await api('/api/admin/change-requests', { method: 'PATCH', body: JSON.stringify({ id: cr.id, status, adminNote }) });
      toast({ title: status === 'APPROVED' ? 'Pengajuan disetujui' : 'Pengajuan ditolak', description: `${cr.reservation.reservationCode} — ${cr.requestedChange}` });
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    }
  };

  const pendingCR = changeRequests.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Reservasi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola seluruh reservasi dan pengajuan perubahan dari pelanggan.</p>
      </div>

      <Tabs defaultValue="reservasi">
        <TabsList>
          <TabsTrigger value="reservasi" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Semua Reservasi
          </TabsTrigger>
          <TabsTrigger value="perubahan" className="gap-1.5">
            <FileEdit className="h-4 w-4" /> Pengajuan Perubahan
            {pendingCR > 0 && <Badge className="ml-1 bg-amber-500 text-white">{pendingCR}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB RESERVASI ================= */}
        <TabsContent value="reservasi" className="mt-4 space-y-4">
          {/* Filter */}
          <Card className="shadow-sm">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5">
                <Label className="text-xs">Cari</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Kode / nama / WA…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status Reservasi</Label>
                <Select value={filters.status || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'ALL' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    <SelectItem value="MENUNGGU_PEMBAYARAN">Menunggu Pembayaran</SelectItem>
                    <SelectItem value="TERKONFIRMASI">Terkonfirmasi</SelectItem>
                    <SelectItem value="SELESAI">Selesai</SelectItem>
                    <SelectItem value="DIBATALKAN">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Metode Bayar</Label>
                <Select value={filters.method || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, method: v === 'ALL' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    <SelectItem value="FULL_PAYMENT">Lunas</SelectItem>
                    <SelectItem value="ONSITE">Bayar di Tempat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status Bayar</Label>
                <Select value={filters.paymentStatus || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v === 'ALL' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    <SelectItem value="PAID">Lunas</SelectItem>
                    <SelectItem value="UNPAID">Belum Bayar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={load} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabel */}
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Tidak ada reservasi" description="Coba ubah filter atau muat ulang data." />
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Jadwal</TableHead>
                        <TableHead>Peserta</TableHead>
                        <TableHead>Pengelompokan</TableHead>
                        <TableHead>Pembayaran</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id} className={r.reservationStatus === 'DIBATALKAN' ? 'opacity-55' : ''}>
                          <TableCell className="font-mono text-xs font-bold whitespace-nowrap">{r.reservationCode}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">{r.name}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(r.schedule.date)}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.schedule.time}</TableCell>
                          <TableCell><span className="font-bold">{r.participantCount}</span> org</TableCell>
                          <TableCell><StatusBadge status={r.groupingStatus} /></TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {r.payment && <PaymentMethodBadge method={r.payment.paymentMethod} />}
                              <span className="text-xs font-bold">{formatRupiah(r.payment?.amountPaid ?? 0)}</span>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={r.reservationStatus} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(r)} aria-label="Detail">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r)} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {r.reservationStatus === 'MENUNGGU_PEMBAYARAN' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => doConfirm(r)} aria-label="Konfirmasi" title="Konfirmasi manual">
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              {r.reservationStatus !== 'DIBATALKAN' && r.reservationStatus !== 'SELESAI' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setCancelling(r)} aria-label="Batalkan">
                                  <Ban className="h-4 w-4" />
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
        </TabsContent>

        {/* ================= TAB PENGAJUAN PERUBAHAN ================= */}
        <TabsContent value="perubahan" className="mt-4">
          {changeRequests.length === 0 ? (
            <EmptyState icon={FileEdit} title="Belum ada pengajuan perubahan" description="Pengajuan perubahan dari pelanggan akan muncul di sini." />
          ) : (
            <div className="space-y-3">
              {changeRequests.map((cr) => (
                <Card key={cr.id} className="shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{cr.reservation.reservationCode}</span>
                        <span className="text-sm font-bold">{cr.reservation.name}</span>
                        <Badge variant="outline" className="text-[10px]">{CHANGE_REQUEST_LABEL[cr.type] ?? cr.type}</Badge>
                        <StatusBadge status={cr.status} />
                      </div>
                      <p className="mt-1.5 text-sm">{cr.requestedChange}</p>
                      {cr.reason && <p className="mt-0.5 text-xs text-muted-foreground">Alasan: {cr.reason}</p>}
                      {cr.adminNote && <p className="mt-0.5 text-xs text-emerald-700">Catatan admin: {cr.adminNote}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeID(cr.createdAt)}</p>
                    </div>
                    {cr.status === 'PENDING' ? (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => processChangeRequest(cr, 'REJECTED')}>
                          <X className="mr-1 h-4 w-4" /> Tolak
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => processChangeRequest(cr, 'APPROVED')}>
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Setujui
                        </Button>
                      </div>
                    ) : (
                      <StatusBadge status={cr.status} className="shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Dialog Detail ===== */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl scrollbar-thin">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono">{detail.reservationCode}</span>
                  <StatusBadge status={detail.reservationStatus} />
                  <StatusBadge status={detail.groupingStatus} />
                </DialogTitle>
                <DialogDescription>Dibuat {formatDateTimeID(detail.createdAt)}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Nama" value={detail.name} />
                <Info label="WhatsApp" value={detail.phone} />
                <Info label="Email" value={detail.email || '—'} />
                <Info label="Jadwal" value={`${formatDateID(detail.schedule.date)} · ${detail.schedule.time}`} />
                <Info label="Jumlah peserta" value={`${detail.participantCount} orang`} />
                <Info label="Dihitung pembayaran" value={`${detail.paymentParticipantCount} orang`} />
                <Info label="Pengelompokan" value={detail.groupingOption === 'WAIT_GROUP' ? 'Tunggu kelompok' : detail.groupingOption === 'DEPART_NOW' ? 'Tetap berangkat' : 'Kelompok lengkap'} />
                <Info label="Kelompok" value={detail.group ? detail.group.groupCode : 'Belum tergabung'} />
                <Info label="Total" value={formatRupiah(detail.totalPrice)} />
                {detail.payment && (
                  <>
                    <Info label="Metode" value={detail.payment.paymentMethod === 'FULL_PAYMENT' ? 'Lunas' : 'Bayar di Tempat'} />
                    <Info label="Dibayar" value={formatRupiah(detail.payment.amountPaid)} />
                    <Info label="Sisa" value={formatRupiah(detail.payment.remainingAmount)} />
                    <Info label="Status bayar" value="" node={<PaymentStatusBadge status={detail.payment.paymentStatus} method={detail.payment.paymentMethod} />} />
                  </>
                )}
                <Info label="Peserta aktual" value={detail.actualParticipantCount != null ? `${detail.actualParticipantCount} orang` : 'Belum dikonfirmasi'} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog Edit ===== */}
      <EditDialog editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />

      {/* ===== Konfirmasi pembatalan ===== */}
      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan reservasi {cancelling?.reservationCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              Reservasi atas nama <b>{cancelling?.name}</b> akan dibatalkan dan slot kapasitasnya dilepas.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value, node }: { label: string; value: string; node?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3.5 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {node ?? <span className="text-right text-sm font-bold">{value}</span>}
    </div>
  );
}

function EditDialog({ editing, onClose, onSaved }: { editing: ReservationDTO | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '', participantCount: 1 });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, phone: editing.phone, email: editing.email || '', participantCount: editing.participantCount });
      setReason('');
      setError('');
    }
  }, [editing]);

  const canEditParticipants = editing?.payment?.paymentStatus === 'UNPAID' && (editing.payment.amountPaid ?? 0) === 0;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/reservations/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name, phone: form.phone, email: form.email || null,
          ...(canEditParticipants ? { participantCount: Number(form.participantCount) } : {}),
        }),
      });
      toast({ title: 'Reservasi diperbarui', description: `${editing.reservationCode} berhasil disimpan.` });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Reservasi {editing?.reservationCode}</DialogTitle>
          <DialogDescription>Perubahan jumlah peserta hanya dapat dilakukan jika pembayaran belum diproses.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Nomor WhatsApp</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Jumlah peserta {canEditParticipants ? '' : '(terkunci — pembayaran sudah diproses)'}</Label>
            <Input
              type="number" min={1} max={100} disabled={!canEditParticipants}
              value={form.participantCount}
              onChange={(e) => setForm((f) => ({ ...f, participantCount: Number(e.target.value) }))}
            />
          </div>
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
          <Button onClick={save} disabled={busy} className="w-full font-bold">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan Perubahan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
