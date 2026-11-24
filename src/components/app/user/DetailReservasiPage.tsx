'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, Clock, Copy, CreditCard, History,
  Loader2, PencilLine, Printer, RefreshCw, ShieldCheck, UserRound, Users, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { GroupCapacityPill } from '@/components/app/shared/CapacityBar';
import { PaymentGatewayModal } from '@/components/app/user/PaymentGatewayModal';
import { navigate } from '@/components/app/router';
import { api, getVerifiedReservations, setVerifiedReservation } from '@/lib/api-client';
import { formatDateTimeID, formatRupiah, formatDateID, PAYMENT_METHOD_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReservationDTO } from '@/lib/types';

function useVerifiedPhone(code: string) {
  const [phone, setPhone] = useState<string | null>(() =>
    getVerifiedReservations().find((v) => v.code === code)?.phone ?? null
  );
  return [phone, setPhone] as const;
}

function PhoneGate({ code, onVerified }: { code: string; onVerified: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const d = await api<{ reservation: ReservationDTO }>(`/api/reservations/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
      setVerifiedReservation(d.reservation.reservationCode, d.reservation.phone);
      onVerified(d.reservation.phone);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <Card className="shadow-md">
        <CardContent className="p-7">
          <h1 className="text-xl font-extrabold">Verifikasi Diperlukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukkan nomor WhatsApp yang digunakan saat reservasi <span className="font-mono font-bold">{code}</span> untuk melihat detail.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wa-verify">Nomor WhatsApp</Label>
              <Input id="wa-verify" inputMode="numeric" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>}
            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Verifikasi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function DetailReservasiPage({ code }: { code: string }) {
  const { toast } = useToast();
  const [verifiedPhone, setVerifiedPhone] = useVerifiedPhone(code);
  const [reservation, setReservation] = useState<ReservationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!verifiedPhone) return;
    let cancelled = false;
    api(`/api/reservations/${encodeURIComponent(code)}?phone=${encodeURIComponent(verifiedPhone)}`)
      .then((d) => { if (!cancelled) { setReservation(d.reservation); setError(''); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, verifiedPhone, refreshKey]);

  if (!verifiedPhone) return <PhoneGate code={code} onVerified={(p) => setVerifiedPhone(p)} />;
  if (loading && !reservation) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Memuat detail reservasi…</p>
      </div>
    );
  }
  if (error || !reservation) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-lg font-extrabold text-rose-600">Reservasi tidak ditemukan</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-5" onClick={() => navigate('/cek-reservasi')}>Kembali ke Cek Reservasi</Button>
      </div>
    );
  }

  const p = reservation.payment;
  const copyCode = () => {
    navigator.clipboard.writeText(reservation.reservationCode).then(() => toast({ title: 'Kode disalin' }));
  };
  // Tombol "Lanjutkan Pembayaran" hanya untuk metode LUNAS yang belum dibayar —
  // metode Bayar di Tempat dibayar di lokasi saat hari H (tidak ada pembayaran online).
  const isPending = p?.paymentStatus === 'UNPAID' && p.paymentMethod === 'FULL_PAYMENT' && reservation.reservationStatus === 'MENUNGGU_PEMBAYARAN';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/')} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-extrabold tracking-wider sm:text-3xl">{reservation.reservationCode}</h1>
            <button onClick={copyCode} className="rounded-lg border p-1.5 text-muted-foreground transition-colors hover:bg-muted" aria-label="Salin kode">
              <Copy className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={() => { setLoading(true); setRefreshKey((k) => k + 1); }} className="text-muted-foreground" aria-label="Muat ulang">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Dibuat {formatDateTimeID(reservation.createdAt)}</p>
        </div>
      </div>

      {/* Status badges — status reservasi, pengelompokan, metode & status pembayaran terpisah */}
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={reservation.reservationStatus} />
        <StatusBadge status={reservation.groupingStatus} />
        {p && <PaymentMethodBadge method={p.paymentMethod} />}
        {p && <PaymentStatusBadge status={p.paymentStatus} method={p.paymentMethod} />}
      </div>

      {/* Lanjutkan pembayaran */}
      {isPending && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-extrabold text-amber-800">Pembayaran belum selesai</p>
            <p className="mt-0.5 text-sm text-amber-700">
              Selesaikan pembayaran lunas untuk mengonfirmasi reservasi Anda.
            </p>
          </div>
          <Button onClick={() => setGatewayOpen(true)} className="bg-amber-600 font-bold hover:bg-amber-700">
            <CreditCard className="mr-2 h-4 w-4" /> Lanjutkan Pembayaran
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Detail jadwal & peserta */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-extrabold"><CalendarDays className="h-4.5 w-4.5 text-primary" /> Jadwal &amp; Peserta</h2>
            <DRow icon={CalendarDays} label="Tanggal" value={formatDateID(reservation.schedule.date)} />
            <DRow icon={Clock} label="Jam keberangkatan" value={`${reservation.schedule.time} WIB`} />
            <DRow icon={Users} label="Jumlah peserta" value={`${reservation.participantCount} orang`} />
            <DRow icon={UserRound} label="Pemesan" value={reservation.name} />
            {reservation.email && <DRow icon={UserRound} label="Email" value={reservation.email} />}
          </CardContent>
        </Card>

        {/* Pengelompokan */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-extrabold"><Users className="h-4.5 w-4.5 text-primary" /> Pengelompokan</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={reservation.groupingStatus} />
              </div>
              {reservation.groupingOption === 'WAIT_GROUP' && (
                <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  Anda memilih menunggu kelompok. Peserta Anda dapat digabungkan dengan peserta lain
                  pada jadwal yang sama hingga mencapai 7 orang. Penggabungan dikonfirmasi oleh admin.
                </p>
              )}
              {reservation.groupingOption === 'DEPART_NOW' && (
                <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  Anda memilih tetap berangkat dengan {reservation.participantCount} orang. Pembayaran
                  dihitung berdasarkan {reservation.paymentParticipantCount} orang (kelompok ideal).
                </p>
              )}
              {reservation.group && (
                <div className="rounded-xl border bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-emerald-800">{reservation.group.groupCode}</p>
                    <GroupCapacityPill current={reservation.groupMembers?.reduce((s, m) => s + m.participantCount, 0) ?? 0} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Status kelompok:{' '}
                    {reservation.group.status === 'SIAP_BERANGKAT'
                      ? 'Siap berangkat — didampingi pemandu'
                      : reservation.group.status === 'LENGKAP'
                        ? 'Lengkap (7 orang)'
                        : 'Menunggu peserta lain'}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {reservation.groupMembers?.map((m, i) => (
                      <p key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-muted-foreground">{m.participantCount} orang</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pembayaran */}
        {p && (
          <Card className="shadow-sm md:col-span-2">
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-extrabold"><Wallet className="h-4.5 w-4.5 text-primary" /> Detail Pembayaran</h2>
              <div className="grid gap-x-10 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Reservasi</span><b>{formatRupiah(p.totalAmount)}</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Metode Pembayaran</span><b>{PAYMENT_METHOD_LABEL[p.paymentMethod]}</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Jumlah Dibayar</span><b className="text-primary">{formatRupiah(p.amountPaid)}</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sisa Pembayaran</span><b>{formatRupiah(p.remainingAmount)}</b></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status Pembayaran</span><PaymentStatusBadge status={p.paymentStatus} method={p.paymentMethod} /></div>
                  {p.transactionCode && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Kode Transaksi</span><b className="font-mono">{p.transactionCode}</b></div>}
                </div>
                <div className="mt-5 sm:mt-0">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><History className="h-4 w-4 text-muted-foreground" /> Riwayat Transaksi</p>
                  {p.history && p.history.length > 0 ? (
                    <div className="space-y-2">
                      {p.history.map((h) => (
                        <div key={h.id} className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm">
                          <div>
                            <p className="font-semibold">{h.type === 'FULL' ? 'Pembayaran Lunas' : h.type === 'SETTLEMENT' ? 'Pelunasan' : 'Bayar di Tempat'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTimeID(h.createdAt)} · {h.transactionCode}</p>
                          </div>
                          <b className="text-emerald-600">+{formatRupiah(h.amount)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada transaksi tercatat.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pengajuan perubahan */}
        {reservation.changeRequests && reservation.changeRequests.length > 0 && (
          <Card className="shadow-sm md:col-span-2">
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-extrabold"><PencilLine className="h-4.5 w-4.5 text-primary" /> Pengajuan Perubahan</h2>
              <div className="space-y-2.5">
                {reservation.changeRequests.map((cr) => (
                  <div key={cr.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{cr.requestedChange}</p>
                      <StatusBadge status={cr.status} />
                    </div>
                    {cr.reason && <p className="mt-1 text-xs text-muted-foreground">Alasan: {cr.reason}</p>}
                    {cr.adminNote && <p className="mt-1 text-xs text-emerald-700">Catatan admin: {cr.adminNote}</p>}
                    <p className="mt-1.5 text-xs text-muted-foreground">{formatDateTimeID(cr.createdAt)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="no-print mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" className="flex-1 font-bold" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Cetak Detail
        </Button>
        <Button className="flex-1 font-bold" onClick={() => navigate(`/reservasi/${code}/perubahan`)}>
          <PencilLine className="mr-2 h-4 w-4" /> Ajukan Perubahan <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {gatewayOpen && reservation && p && p.paymentStatus === 'UNPAID' && p.paymentMethod === 'FULL_PAYMENT' && (
        <PaymentGatewayModal
          reservation={reservation}
          onPaid={(res) => {
            setReservation(res);
            setGatewayOpen(false);
            toast({ title: 'Pembayaran berhasil', description: 'Reservasi Anda telah terkonfirmasi.' });
          }}
          onCancel={() => setGatewayOpen(false)}
        />
      )}
    </div>
  );
}

function DRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed py-2.5 text-sm last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}

// ============ HALAMAN PENGAJUAN PERUBAHAN ============
export function PerubahanPage({ code }: { code: string }) {
  const { toast } = useToast();
  const [verifiedPhone] = useVerifiedPhone(code);
  const [reservation, setReservation] = useState<ReservationDTO | null>(null);
  const [type, setType] = useState('RESCHEDULE');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!verifiedPhone) return;
    api(`/api/reservations/${encodeURIComponent(code)}?phone=${encodeURIComponent(verifiedPhone)}`)
      .then((d) => setReservation(d.reservation))
      .catch(() => {});
  }, [code, verifiedPhone]);

  if (!verifiedPhone) return <PhoneGate code={code} onVerified={() => {}} />;
  if (!reservation) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (change.trim().length < 5) {
      toast({ title: 'Form belum lengkap', description: 'Jelaskan perubahan yang Anda ajukan (minimal 5 karakter).', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/change-requests', {
        method: 'POST',
        body: JSON.stringify({ code, phone: verifiedPhone, type, requestedChange: change.trim(), reason: reason.trim() || undefined }),
      });
      toast({ title: 'Pengajuan perubahan berhasil dikirim', description: 'Admin akan meninjau pengajuan Anda segera.' });
      navigate(`/reservasi/${code}`);
    } catch (e: any) {
      toast({ title: 'Gagal mengirim pengajuan', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <button onClick={() => navigate(`/reservasi/${code}`)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Detail Reservasi
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight">Ajukan Perubahan Reservasi</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reservasi <span className="font-mono font-bold">{code}</span> · {formatDateID(reservation.schedule.date)} · {reservation.schedule.time} · {reservation.participantCount} orang
      </p>

      <Card className="mt-6 shadow-md">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label>Jenis perubahan</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESCHEDULE">Ubah jadwal / tanggal</SelectItem>
                  <SelectItem value="PARTICIPANTS">Ubah jumlah peserta</SelectItem>
                  <SelectItem value="CANCEL">Pembatalan reservasi</SelectItem>
                  <SelectItem value="OTHER">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perubahan">Detail perubahan yang diajukan *</Label>
              <Textarea
                id="perubahan" rows={3}
                placeholder="cth: Mohon pindah ke jadwal Sabtu pukul 10:00"
                value={change} onChange={(e) => setChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alasan">Alasan (opsional)</Label>
              <Textarea
                id="alasan" rows={2}
                placeholder="cth: Ada perubahan rencana keluarga"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>Pengajuan akan ditinjau admin. Perubahan jadwal dapat diajukan maksimal H-2 sebelum keberangkatan.</p>
            </div>
            <Button type="submit" size="lg" className="w-full font-bold" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Kirim Pengajuan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
