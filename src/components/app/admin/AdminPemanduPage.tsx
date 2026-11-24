'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye, Loader2, LifeBuoy, Pencil, Plus, Power, RefreshCw, History, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { formatDateShort, formatPhone, formatRupiah, formatDateTimeID } from '@/lib/format';
import type { GuideDTO } from '@/lib/types';

const emptyForm = { name: '', phone: '', rate: '100000', status: 'TERSEDIA', notes: '' };

export function AdminPemanduPage() {
  const { toast } = useToast();
  const [guides, setGuides] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // form tambah / edit
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GuideDTO | null>(null);
  const [form, setForm] = useState(emptyForm);

  // dialog toggle aktif
  const [toggling, setToggling] = useState<GuideDTO | null>(null);

  // dialog riwayat / detail
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api('/api/admin/guides')
      .then((d) => setGuides(d.guides))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (g: GuideDTO) => {
    setEditing(g);
    setForm({ name: g.name, phone: g.phone, rate: String(g.rate), status: g.status === 'DITUGASKAN' ? 'DITUGASKAN' : g.status, notes: g.notes || '' });
    setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        rate: Number(form.rate),
        status: form.status,
        notes: form.notes,
      };
      if (editing) {
        await api(`/api/admin/guides/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast({ title: 'Data guide diperbarui', description: `${form.name} berhasil disimpan.` });
      } else {
        const d = await api<{ guide: any }>('/api/admin/guides', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: 'Guide ditambahkan', description: `${d.guide.guideCode} — ${d.guide.name} berhasil dibuat.` });
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const doToggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      const d = await api<{ status: string }>(`/api/admin/guides/${toggling.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ toggleActive: true }),
      });
      toast({
        title: d.status === 'TIDAK_AKTIF' ? 'Guide dinonaktifkan' : 'Guide diaktifkan kembali',
        description: `${toggling.name} kini berstatus ${d.status === 'TIDAK_AKTIF' ? 'TIDAK AKTIF' : d.status}.`,
      });
      setToggling(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (g: GuideDTO) => {
    setDetailId(g.id);
    setDetail(null);
    setDetailLoading(true);
    api(`/api/admin/guides/${g.id}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const activeCount = guides.filter((g) => g.status !== 'TIDAK_AKTIF').length;
  const onDutyCount = guides.filter((g) => g.status === 'DITUGASKAN').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <LifeBuoy className="h-6 w-6 text-primary" /> Pemandu / Guide
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola data pemandu, penugasan aktif, dan riwayat kegiatan — {activeCount} guide aktif ({onDutyCount} sedang bertugas).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang</Button>
          <Button className="font-bold" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Tambah Guide</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : guides.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Belum ada pemandu"
          description="Tambahkan data guide untuk mulai menugaskan pemandu pada kelompok peserta."
          action={<Button className="mt-2 font-bold" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Tambah Guide</Button>}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[860px] w-full">
                <TableHeader>
                  <TableRow className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <TableHead className="px-5 py-3 font-semibold">Kode</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Nama Guide</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Telepon</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Tarif/Honor</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Status</TableHead>
                    <TableHead className="px-5 py-3 font-semibold">Penugasan Saat Ini</TableHead>
                    <TableHead className="px-5 py-3 text-center font-semibold">Total</TableHead>
                    <TableHead className="whitespace-nowrap px-5 py-3 font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guides.map((g) => (
                    <TableRow key={g.id} className="hover:bg-muted/40">
                      <TableCell className="px-5 py-3.5 font-mono text-xs font-bold">{g.guideCode}</TableCell>
                      <TableCell className="px-5 py-3.5">
                        <p className="font-bold">{g.name}</p>
                        {g.notes && (
                          <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={g.notes}>
                            {g.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{formatPhone(g.phone)}</TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-3.5 font-semibold">{formatRupiah(g.rate)}</TableCell>
                      <TableCell className="px-5 py-3.5"><StatusBadge status={g.status} /></TableCell>
                      <TableCell className="px-5 py-3.5">
                        {g.currentAssignment ? (
                          <div className="text-sm">
                            <span className="font-mono text-xs font-bold text-primary">{g.currentAssignment.groupCode}</span>
                            <p className="text-xs text-muted-foreground">
                              {formatDateShort(g.currentAssignment.date)} · {g.currentAssignment.time} · {g.currentAssignment.participantCount} peserta
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-center">
                        <span className="font-bold">{g.totalAssignments}</span>
                        <span className="block text-[11px] text-muted-foreground">{g.completedAssignments} selesai</span>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={() => openDetail(g)} title="Detail & Riwayat">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => openEdit(g)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className={`h-8 gap-1.5 px-2.5 ${g.status === 'TIDAK_AKTIF' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-rose-200 text-rose-600 hover:bg-rose-50'}`}
                            onClick={() => setToggling(g)}
                            title={g.status === 'TIDAK_AKTIF' ? 'Aktifkan' : 'Nonaktifkan'}
                          >
                            <Power className="h-4 w-4" />
                            <span className="hidden xl:inline">{g.status === 'TIDAK_AKTIF' ? 'Aktifkan' : 'Nonaktifkan'}</span>
                          </Button>
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

      {/* ===== Dialog tambah / edit ===== */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open && !busy) setFormOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              {editing ? `Edit Guide — ${editing.guideCode}` : 'Tambah Guide Baru'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui data pemandu.' : 'Isi data pemandu baru; kode guide dibuat otomatis (G-XXX).'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="guide-name">Nama Guide</Label>
              <Input id="guide-name" required placeholder="cth. Andi Saputra" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guide-phone">Nomor Telepon</Label>
              <Input id="guide-phone" required placeholder="08xxxxxxxxxx" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guide-rate">Tarif / Honor (Rp)</Label>
                <Input id="guide-rate" type="number" required min={1000} step={1000} value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  disabled={editing?.status === 'DITUGASKAN'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TERSEDIA">Tersedia</SelectItem>
                    <SelectItem value="TIDAK_AKTIF">Tidak Aktif</SelectItem>
                    {editing?.status === 'DITUGASKAN' && <SelectItem value="DITUGASKAN" disabled>Ditugaskan (otomatis)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing?.status === 'DITUGASKAN' && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs text-sky-700">
                Guide sedang memiliki penugasan aktif — status otomatis <b>DITUGASKAN</b> hingga penugasan selesai.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="guide-notes">Keterangan</Label>
              <Textarea id="guide-notes" rows={2} placeholder="cth. Guide senior, bersertifikat life guard" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>Batal</Button>
              <Button type="submit" className="font-bold" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Simpan Perubahan' : 'Tambah Guide'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Konfirmasi toggle ===== */}
      <AlertDialog open={!!toggling} onOpenChange={(open) => { if (!open && !busy) setToggling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.status === 'TIDAK_AKTIF' ? 'Aktifkan kembali guide ini?' : 'Nonaktifkan guide ini?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.status === 'TIDAK_AKTIF' ? (
                <>{toggling?.name} ({toggling?.guideCode}) akan kembali dapat ditugaskan ke kelompok peserta.</>
              ) : (
                <>Guide <b>{toggling?.name}</b> ({toggling?.guideCode}) tidak akan dapat ditugaskan ke kelompok baru hingga diaktifkan kembali.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doToggle(); }}
              disabled={busy}
              className={toggling?.status === 'TIDAK_AKTIF' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {toggling?.status === 'TIDAK_AKTIF' ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Dialog detail & riwayat ===== */}
      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Detail & Riwayat Penugasan
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">Data tidak ditemukan.</p>
          ) : (
            <div className="space-y-5">
              {/* identitas */}
              <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-lg font-extrabold">{detail.guide.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono text-xs font-bold">{detail.guide.guideCode}</span> · {formatPhone(detail.guide.phone)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={detail.guide.status} />
                    <span className="text-xs font-semibold">Honor {formatRupiah(detail.guide.rate)}/penugasan</span>
                  </div>
                  {detail.guide.notes && <p className="mt-2 text-xs text-muted-foreground">{detail.guide.notes}</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border bg-white p-2.5">
                    <p className="text-xl font-extrabold tabular-nums">{detail.guide.totalAssignments}</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Penugasan</p>
                  </div>
                  <div className="rounded-xl border bg-white p-2.5">
                    <p className="text-xl font-extrabold tabular-nums">{detail.guide.completedAssignments}</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Selesai</p>
                  </div>
                  <div className="rounded-xl border bg-white p-2.5">
                    <p className="text-sm font-extrabold leading-6 tabular-nums">{formatRupiah(detail.guide.honorUnpaid)}</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Honor belum dibayar</p>
                  </div>
                </div>
              </div>

              {/* penugasan aktif */}
              {detail.guide.currentAssignment && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm">
                  <p className="font-bold text-sky-800">Sedang bertugas</p>
                  <p className="mt-0.5 text-sky-700">
                    {detail.guide.currentAssignment.groupCode} · {formatDateShort(detail.guide.currentAssignment.assignmentDate)} ·{' '}
                    {detail.guide.currentAssignment.startTime} · {detail.guide.currentAssignment.participantCount} peserta
                  </p>
                </div>
              )}

              {/* riwayat */}
              <div>
                <p className="mb-2 text-sm font-extrabold">Riwayat Penugasan ({detail.assignments.length})</p>
                {detail.assignments.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada penugasan.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                    {detail.assignments.map((a: any) => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-sm">
                        <div>
                          <p className="font-bold">
                            <span className="font-mono text-xs text-primary">{a.groupCode}</span>
                            {' · '}{formatDateShort(a.assignmentDate)} · {a.startTime}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.participantCount} peserta · Honor {formatRupiah(a.rate)}
                            {a.completedAt ? ` · Selesai ${formatDateTimeID(a.completedAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <StatusBadge status={a.assignmentStatus} />
                          <StatusBadge status={a.paymentStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
