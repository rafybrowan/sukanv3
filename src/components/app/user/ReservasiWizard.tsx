'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, CalendarDays, Check, CheckCircle2, Clock,
  Copy, CreditCard, Home, Info, Loader2, Minus, Printer, ShoppingBag, UserRound, Users, Wallet, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CapacityBar, GroupCapacityPill } from '@/components/app/shared/CapacityBar';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { PaymentGatewayModal } from '@/components/app/user/PaymentGatewayModal';
import { useSchedules } from '@/components/app/user/JadwalKapasitasPage';
import { navigate } from '@/components/app/router';
import { api, setVerifiedReservation } from '@/lib/api-client';
import { addDaysStr, dayShort, formatDateID, formatDateShort, formatRupiah } from '@/lib/format';
import type { AppSettings, ReservationDTO, ScheduleStats } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Tanggal', icon: CalendarDays },
  { id: 2, label: 'Jadwal', icon: Clock },
  { id: 3, label: 'Peserta', icon: Users },
  { id: 4, label: 'Data Pemesan', icon: UserRound },
  { id: 5, label: 'Pengelompokan', icon: Users },
  { id: 6, label: 'Pembayaran', icon: Wallet },
  { id: 7, label: 'Ringkasan', icon: ShoppingBag },
  { id: 8, label: 'Bayar', icon: CreditCard },
  { id: 9, label: 'Selesai', icon: CheckCircle2 },
];

type GroupingOption = 'WAIT_GROUP' | 'DEPART_NOW' | 'COMPLETE';
type PayMethod = 'FULL_PAYMENT' | 'ONSITE';

export function ReservasiWizard({ prefillScheduleId }: { prefillScheduleId?: string }) {
  const { toast } = useToast();
  const { schedules, loading, today } = useSchedules();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(false);

  // form state
  const [date, setDate] = useState('');
  const [schedule, setSchedule] = useState<ScheduleStats | null>(null);
  const [participants, setParticipants] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [groupingOption, setGroupingOption] = useState<GroupingOption | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod | ''>('');
  const [created, setCreated] = useState<ReservationDTO | null>(null);

  const price = settings?.pricePerPerson ?? 25000;
  const ideal = settings?.idealGroupSize ?? 7;
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysStr(today, i)), [today]);
  const initRef = useRef(false);

  useEffect(() => {
    api('/api/settings').then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  // prefill dari halaman jadwal
  useEffect(() => {
    if (prefillScheduleId && !initRef.current && schedules.length > 0) {
      const s = schedules.find((x) => x.id === prefillScheduleId);
      if (s) {
        setDate(s.date);
        setSchedule(s);
        setStep(3);
      }
      initRef.current = true;
    }
  }, [prefillScheduleId, schedules]);

  const isComplete = participants >= ideal;
  const payCount = isComplete ? participants : groupingOption === 'DEPART_NOW' ? ideal : participants;
  const total = payCount * price;

  // kapasitas
  const capacityExceeded = schedule ? schedule.currentParticipants + participants > schedule.capacity : false;
  const remainingSlots = schedule ? Math.max(0, schedule.capacity - schedule.currentParticipants) : 0;

  const listForDate = schedules.filter((s) => s.date === date && s.status === 'AKTIF');

  const canNext = (): boolean => {
    switch (step) {
      case 1: return !!date;
      case 2: return !!schedule;
      case 3: return participants >= 1 && !capacityExceeded;
      case 4: return name.trim().length >= 3 && phone.replace(/\D/g, '').length >= 10;
      case 5: return isComplete || groupingOption !== '';
      case 6: return paymentMethod !== '';
      default: return true;
    }
  };

  const doCreate = async () => {
    if (!schedule) return;
    setSubmitting(true);
    try {
      const d = await api<{ reservation: ReservationDTO }>('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: schedule.id,
          name: name.trim(),
          phone, email: email.trim() || undefined,
          participantCount: participants,
          groupingOption: isComplete ? 'COMPLETE' : groupingOption,
          paymentMethod,
        }),
      });
      setCreated(d.reservation);
      setVerifiedReservation(d.reservation.reservationCode, d.reservation.phone);
      if (paymentMethod === 'ONSITE') {
        setStep(9);
        toast({ title: 'Reservasi berhasil dibuat', description: `Kode reservasi Anda: ${d.reservation.reservationCode}` });
      } else {
        setGatewayOpen(true);
      }
    } catch (e: any) {
      toast({ title: 'Gagal membuat reservasi', description: e.message, variant: 'destructive' });
      if (e.data?.code === 'CAPACITY_EXCEEDED') navigate('/jadwal');
    } finally {
      setSubmitting(false);
    }
  };

  const onPaid = (res: ReservationDTO) => {
    setCreated(res);
    setGatewayOpen(false);
    setStep(9);
    toast({ title: 'Pembayaran berhasil', description: 'Reservasi Anda telah terkonfirmasi.' });
  };

  // ============ STEP 9: SUKSES ============
  if (step === 9 && created) {
    return <SuccessStep reservation={created} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary">Reservasi</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Buat Reservasi Anda</h1>
        <p className="mt-2 text-muted-foreground">Ikuti langkah berikut — tanpa perlu membuat akun.</p>
      </div>

      {/* ===== Stepper ===== */}
      <div className="mb-8 overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex min-w-max items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => s.id < step && setStep(s.id)}
                disabled={s.id > step}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all',
                  s.id === step ? 'border-primary bg-primary text-white shadow-sm'
                    : s.id < step ? 'border-primary/30 bg-primary/5 text-primary cursor-pointer hover:bg-primary/10'
                      : 'border-border bg-muted/40 text-muted-foreground'
                )}
              >
                {s.id < step ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
              {i < STEPS.length - 1 && <div className={cn('mx-1 h-px w-5', s.id < step ? 'bg-primary/40' : 'bg-border')} />}
            </div>
          ))}
        </div>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-6 sm:p-8">
          {/* ===== STEP 1: TANGGAL ===== */}
          {step === 1 && (
            <div>
              <StepTitle no="1" title="Pilih Tanggal Keberangkatan" desc="Pilih tanggal kunjungan Anda dalam 14 hari ke depan." />
              {loading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {days.map((d) => {
                    const hasSlot = schedules.some((s) => s.date === d && s.status === 'AKTIF');
                    const weekend = [0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay());
                    return (
                      <button
                        key={d}
                        disabled={!hasSlot}
                        onClick={() => { setDate(d); setSchedule(null); }}
                        className={cn(
                          'rounded-xl border p-3 text-center transition-all',
                          date === d ? 'border-primary bg-primary text-white shadow-md' : 'border-border bg-white hover:border-primary/40',
                          !hasSlot && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        <p className={cn('text-[10px] font-bold uppercase', date === d ? 'text-emerald-100' : 'text-muted-foreground')}>{dayShort(d)}</p>
                        <p className="text-xl font-extrabold">{d.slice(8, 10)}</p>
                        <p className={cn('text-[10px]', date === d ? 'text-emerald-100/80' : 'text-muted-foreground')}>{formatDateShort(d).split(' ')[1]}</p>
                        {weekend && <span className={cn('mt-1 block rounded-full px-1.5 text-[8px] font-bold', date === d ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')}>POPULER</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 2: JADWAL ===== */}
          {step === 2 && (
            <div>
              <StepTitle no="2" title="Pilih Jadwal & Jam" desc={`Jadwal tersedia pada ${formatDateID(date, false)}.`} />
              {listForDate.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Tidak ada jadwal aktif pada tanggal ini. Silakan pilih tanggal lain.
                </p>
              ) : (
                <div className="space-y-3">
                  {listForDate.map((s) => {
                    const bookable = s.availability === 'TERSEDIA' || s.availability === 'HAMPIR_PENUH';
                    return (
                      <button
                        key={s.id}
                        disabled={!bookable}
                        onClick={() => setSchedule(s)}
                        className={cn(
                          'w-full rounded-xl border p-4 text-left transition-all',
                          schedule?.id === s.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                          !bookable && 'cursor-not-allowed opacity-55'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={cn('flex h-11 w-14 items-center justify-center rounded-lg text-sm font-extrabold', schedule?.id === s.id ? 'bg-primary text-white' : 'bg-muted')}>
                              {s.time}
                            </span>
                            <div>
                              <p className="text-sm font-bold">{s.currentParticipants} / {s.capacity} peserta</p>
                              <p className="text-xs text-muted-foreground">{bookable ? `${s.remaining} slot tersisa` : 'Tidak dapat dipesan'}</p>
                            </div>
                          </div>
                          <StatusBadge status={s.availability} />
                        </div>
                        <div className="mt-3"><CapacityBar filled={s.currentParticipants} capacity={s.capacity} /></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 3: JUMLAH PESERTA ===== */}
          {step === 3 && schedule && (
            <div>
              <StepTitle no="3" title="Jumlah Peserta" desc="Berapa orang yang akan ikut berangkat?" />
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="flex items-center gap-5">
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setParticipants((p) => Math.max(1, p - 1))} aria-label="Kurangi peserta">
                    <Minus className="h-5 w-5" />
                  </Button>
                  <div className="text-center">
                    <p className="text-6xl font-extrabold tabular-nums text-primary">{participants}</p>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">orang</p>
                  </div>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setParticipants((p) => Math.min(schedule.capacity, p + 1))} aria-label="Tambah peserta">
                    <ArrowRight className="h-5 w-5 rotate-90" />
                  </Button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 10, 15].map((n) => (
                    <button
                      key={n}
                      onClick={() => setParticipants(n)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors',
                        participants === n ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="w-full max-w-md rounded-xl border bg-muted/40 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kapasitas jadwal {schedule.time}</span>
                    <span className="font-bold">{schedule.currentParticipants} / {schedule.capacity}</span>
                  </div>
                  <div className="mt-2"><CapacityBar filled={schedule.currentParticipants} capacity={schedule.capacity} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">Sisa slot saat ini: <b className="text-foreground">{remainingSlots} orang</b></p>
                </div>
                {capacityExceeded && (
                  <div className="w-full rounded-xl border-2 border-rose-200 bg-rose-50 p-5 text-center">
                    <p className="font-extrabold text-rose-700">Kapasitas Tidak Mencukupi</p>
                    <p className="mt-1 text-sm text-rose-600">
                      Jadwal pukul {schedule.time} hanya memiliki {remainingSlots} slot tersisa.
                    </p>
                    <Button variant="outline" className="mt-3 border-rose-300 text-rose-700 hover:bg-rose-100" onClick={() => navigate('/jadwal')}>
                      Lihat Jadwal Lain
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 4: DATA PEMESAN ===== */}
          {step === 4 && (
            <div>
              <StepTitle no="4" title="Data Pemesan" desc="Kode reservasi akan dikaitkan dengan nomor WhatsApp Anda." />
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input id="nama" placeholder="cth: Rafy Ramadhan" value={name} onChange={(e) => setName(e.target.value)} />
                  {name && name.trim().length < 3 && <p className="text-xs text-rose-500">Nama minimal 3 karakter.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa">Nomor WhatsApp *</Label>
                  <Input id="wa" inputMode="numeric" placeholder="cth: 081234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  {phone && phone.replace(/\D/g, '').length < 10 && <p className="text-xs text-rose-500">Nomor WhatsApp tidak valid.</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Email (opsional)</Label>
                  <Input id="email" type="email" placeholder="cth: nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-sky-50 p-4 text-sm text-sky-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p>Simpan nomor WhatsApp ini — bersama kode reservasi, Anda dapat mengecek status reservasi kapan saja tanpa perlu akun.</p>
              </div>
            </div>
          )}

          {/* ===== STEP 5: PENGELOMPOKAN ===== */}
          {step === 5 && schedule && (
            <div>
              <StepTitle no="5" title="Pilihan Pengelompokan" desc={`Kelompok ideal berjumlah ${ideal} orang per keberangkatan.`} />
              {isComplete ? (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
                  <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <BadgeCheck className="h-7 w-7 text-emerald-600" />
                  </span>
                  <p className="text-lg font-extrabold text-emerald-800">KELOMPOK LENGKAP</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-emerald-700">
                    Reservasi Anda berjumlah <b>{participants} orang</b> — sudah mencapai / melebihi kelompok ideal {ideal} orang.
                    Anda cukup membayar sesuai jumlah peserta.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-sm">
                    <span className="text-sm text-muted-foreground">Total {participants} × {formatRupiah(price)} =</span>
                    <span className="text-lg font-extrabold text-emerald-700">{formatRupiah(total)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-bold">Reservasi Anda berjumlah {participants} orang.</p>
                    <p className="mt-0.5">Kelompok ideal berjumlah {ideal} orang. Silakan pilih salah satu opsi berikut:</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      onClick={() => setGroupingOption('WAIT_GROUP')}
                      className={cn(
                        'rounded-2xl border-2 p-5 text-left transition-all',
                        groupingOption === 'WAIT_GROUP' ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-200' : 'border-border hover:border-amber-300'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><Clock className="h-5 w-5 text-amber-600" /></span>
                        {groupingOption === 'WAIT_GROUP' && <Check className="h-5 w-5 text-amber-600" />}
                      </div>
                      <p className="font-extrabold">Tunggu Kelompok</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        Peserta Anda akan menunggu dan dapat digabungkan dengan peserta lain pada jadwal
                        yang sama hingga mencapai {ideal} orang. Pembayaran penggabungan dikonfirmasi admin.
                      </p>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <p className="flex justify-between"><span className="text-muted-foreground">Dihitung</span> <b>{participants} orang</b></p>
                        <p className="flex justify-between"><span className="text-muted-foreground">Total</span> <b>{formatRupiah(participants * price)}</b></p>
                      </div>
                      <Badge className="mt-3 border-amber-200 bg-amber-50 text-amber-700">Status: Menunggu Pengelompokan</Badge>
                    </button>
                    <button
                      onClick={() => setGroupingOption('DEPART_NOW')}
                      className={cn(
                        'rounded-2xl border-2 p-5 text-left transition-all',
                        groupingOption === 'DEPART_NOW' ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200' : 'border-border hover:border-sky-300'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100"><Zap className="h-5 w-5 text-sky-600" /></span>
                        {groupingOption === 'DEPART_NOW' && <Check className="h-5 w-5 text-sky-600" />}
                      </div>
                      <p className="font-extrabold">Tetap Berangkat</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        Anda tetap dapat berangkat dengan jumlah peserta saat ini, namun pembayaran
                        dihitung berdasarkan {ideal} orang (kelompok ideal).
                      </p>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <p className="flex justify-between"><span className="text-muted-foreground">Peserta</span> <b>{participants} orang</b></p>
                        <p className="flex justify-between"><span className="text-muted-foreground">Dihitung untuk bayar</span> <b>{ideal} orang</b></p>
                        <p className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">Total</span> <b className="text-sky-700">{formatRupiah(ideal * price)}</b></p>
                      </div>
                      <Badge className="mt-3 border-sky-200 bg-sky-50 text-sky-700">Status: Siap Berangkat</Badge>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== STEP 6: PEMBAYARAN ===== */}
          {step === 6 && (
            <div>
              <StepTitle no="6" title="Pilihan Pembayaran" desc="Pilih salah satu dari dua metode pembayaran kami." />
              <div className="space-y-3.5">
                <PayMethodCard
                  active={paymentMethod === 'FULL_PAYMENT'} onClick={() => setPaymentMethod('FULL_PAYMENT')}
                  icon={<CreditCard className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-100"
                  title="Pembayaran Lunas" desc="Bayar seluruh total reservasi sekarang melalui payment gateway."
                  rows={[['Total dibayar', formatRupiah(total)]]}
                  badge="PALING PRAKTIS" badgeCls="bg-emerald-100 text-emerald-700"
                />
                <PayMethodCard
                  active={paymentMethod === 'ONSITE'} onClick={() => setPaymentMethod('ONSITE')}
                  icon={<Banknote className="h-5 w-5 text-orange-600" />} iconBg="bg-orange-100"
                  title="Bayar Langsung di Tempat" desc="Tidak melakukan pembayaran online. Pembayaran dilakukan langsung di lokasi saat hari H."
                  rows={[['Pembayaran online', formatRupiah(0)], ['Dibayar di lokasi (hari H)', formatRupiah(total)]]}
                  badge="TANPA ONLINE" badgeCls="bg-orange-100 text-orange-700"
                />
              </div>
            </div>
          )}

          {/* ===== STEP 7: RINGKASAN ===== */}
          {step === 7 && schedule && (
            <div>
              <StepTitle no="7" title="Ringkasan Reservasi" desc="Periksa kembali detail reservasi Anda sebelum melanjutkan." />
              <div className="space-y-5">
                <SummaryRow icon={CalendarDays} label="Jadwal" value={`${formatDateID(schedule.date)} · ${schedule.time}`} />
                <SummaryRow icon={Users} label="Jumlah peserta" value={`${participants} orang`} />
                <SummaryRow icon={UserRound} label="Pemesan" value={`${name} · ${phone}`} />
                <SummaryRow
                  icon={Users}
                  label="Pengelompokan"
                  value={
                    isComplete ? 'Kelompok lengkap (≥ 7 orang)'
                      : groupingOption === 'WAIT_GROUP' ? 'Tunggu kelompok — menunggu pengelompokan'
                        : `Tetap berangkat — dihitung ${ideal} orang untuk pembayaran`
                  }
                />
                <div className="rounded-xl border bg-muted/40 p-4">
                  <div className="space-y-1.5 text-sm">
                    <p className="flex justify-between"><span className="text-muted-foreground">Dihitung untuk pembayaran</span> <b>{payCount} orang</b></p>
                    <p className="flex justify-between"><span className="text-muted-foreground">Harga per orang</span> <b>{formatRupiah(price)}</b></p>
                    <p className="flex justify-between border-t pt-2 text-base"><span className="font-semibold">Total</span> <b className="text-lg text-primary">{formatRupiah(total)}</b></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP 8: PEMBAYARAN / KONFIRMASI ===== */}
          {step === 8 && schedule && (
            <div>
              <StepTitle
                no="8"
                title={paymentMethod === 'ONSITE' ? 'Konfirmasi Reservasi' : 'Pembayaran'}
                desc={paymentMethod === 'ONSITE' ? 'Reservasi Anda akan langsung dikonfirmasi tanpa pembayaran online.' : 'Reservasi akan dibuat, lalu Anda diarahkan ke halaman pembayaran aman.'}
              />
              <div className="rounded-2xl border p-5">
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total reservasi</p>
                    <p className="text-2xl font-extrabold text-primary">{formatRupiah(total)}</p>
                  </div>
                  {paymentMethod === 'FULL_PAYMENT' && <div className="text-right text-sm"><p className="text-muted-foreground">Dibayar sekarang</p><p className="font-bold">{formatRupiah(total)}</p></div>}
                  {paymentMethod === 'ONSITE' && <div className="text-right text-sm"><p className="text-muted-foreground">Online</p><p className="font-bold">{formatRupiah(0)}</p><p className="mt-1 text-muted-foreground">Di lokasi</p><p className="font-bold">{formatRupiah(total)}</p></div>}
                </div>
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>Ini adalah <b>prototipe</b> — pembayaran menggunakan <b>simulasi payment gateway</b>, tidak ada transaksi nyata yang diproses.</p>
                </div>
                <Button
                  size="lg" className="mt-5 w-full text-base font-bold" disabled={submitting}
                  onClick={doCreate}
                >
                  {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memproses…</>
                    : paymentMethod === 'ONSITE' ? <>Konfirmasi Reservasi <Check className="ml-2 h-5 w-5" /></>
                      : <>Bayar Sekarang <CreditCard className="ml-2 h-5 w-5" /></>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Navigasi ===== */}
      {step < 8 && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => (step === 1 ? navigate('/') : setStep(step - 1))} disabled={step === 1}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
          </Button>
          <Button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} className="px-8 font-bold">
            Lanjut <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 8 && (
        <div className="mt-6">
          <Button variant="ghost" onClick={() => setStep(7)}><ArrowLeft className="mr-1 h-4 w-4" /> Kembali</Button>
        </div>
      )}

      {/* ===== Modal Payment Gateway ===== */}
      {created && gatewayOpen && (
        <PaymentGatewayModal
          reservation={created}
          onPaid={onPaid}
          onCancel={() => {
            setGatewayOpen(false);
            setStep(9); // reservasi sudah dibuat, status menunggu pembayaran
            toast({ title: 'Pembayaran belum selesai', description: 'Anda dapat melanjutkan pembayaran dari halaman detail reservasi.', variant: 'default' });
          }}
        />
      )}
    </div>
  );
}

function StepTitle({ no, title, desc }: { no: string; title: string; desc: string }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Langkah {no} dari 9</p>
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function PayMethodCard({ active, onClick, icon, iconBg, title, desc, rows, badge, badgeCls }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border-2 p-5 text-left transition-all',
        active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconBg)}>{icon}</span>
          <div>
            <p className="font-extrabold">{title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide', badgeCls)}>{badge}</span>
          {active && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"><Check className="h-4 w-4 text-white" /></span>}
        </div>
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl bg-muted/50 p-3.5 text-sm">
        {rows.map(([k, v]: string[]) => (
          <p key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span> <b>{v}</b></p>
        ))}
      </div>
    </button>
  );
}

// ============ STEP 9: RESERVASI BERHASIL ============
function SuccessStep({ reservation }: { reservation: ReservationDTO }) {
  const { toast } = useToast();
  const p = reservation.payment;
  const copyCode = () => {
    navigator.clipboard.writeText(reservation.reservationCode).then(
      () => toast({ title: 'Kode disalin', description: reservation.reservationCode })
    );
  };
  const isOnsite = p?.paymentMethod === 'ONSITE';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="print-area">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-pulse-success-ring" />
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
              <svg viewBox="0 0 24 24" className="h-10 w-10 animate-draw-check" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Reservasi Berhasil!</h1>
          <p className="mt-2 text-muted-foreground">Reservasi Anda telah dibuat. Simpan kode reservasi berikut.</p>
          <button
            onClick={copyCode}
            className="mt-5 inline-flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-3 transition-colors hover:bg-primary/10"
          >
            <span className="text-2xl font-extrabold tracking-wider text-primary">{reservation.reservationCode}</span>
            <Copy className="h-4.5 w-4.5 text-primary" />
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Klik kode untuk menyalin</p>
        </div>

        <Card className="shadow-md">
          <CardContent className="p-6 sm:p-8">
            <h2 className="mb-5 text-lg font-extrabold">Detail Reservasi</h2>
            <dl className="space-y-3.5 text-sm">
              <Row label="Nama" value={reservation.name} />
              <Row label="Tanggal" value={formatDateID(reservation.schedule.date)} />
              <Row label="Jam" value={`${reservation.schedule.time} WIB`} />
              <Row label="Peserta" value={`${reservation.participantCount} orang`} />
              {isOnsite ? (
                <>
                  <Row label="Metode Pembayaran" value="Bayar di Tempat" />
                  <Row label="Status Pembayaran" value="Bayar di Tempat — dibayar saat hari H" strong />
                  <Row label="Total dibayar saat hari H" value={formatRupiah(p?.totalAmount ?? 0)} strong />
                </>
              ) : (
                <>
                  <Row label="Total Reservasi" value={formatRupiah(p?.totalAmount ?? 0)} />
                  <Row label="Metode Pembayaran" value="Lunas" />
                  <Row label="Status Pembayaran" value={p?.paymentStatus === 'PAID' ? 'Lunas' : 'Belum Bayar'} strong />
                  {p?.paymentStatus === 'PAID' && <Row label="Dibayar" value={formatRupiah(p.amountPaid)} strong />}
                  {p?.transactionCode && <Row label="Kode Transaksi" value={p.transactionCode} mono />}
                </>
              )}
              <Row
                label="Pengelompokan"
                value={
                  reservation.groupingStatus === 'MENUNGGU_PENGELOMPOKAN' ? 'Menunggu pengelompokan'
                    : reservation.groupingStatus === 'SIAP_BERANGKAT' ? 'Siap berangkat'
                      : 'Kelompok lengkap'
                }
              />
            </dl>
            <div className="mt-5 rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
              Catatan: penggabungan kelompok dikonfirmasi oleh admin. Pantau status Anda melalui halaman
              Cek Reservasi dengan kode reservasi + nomor WhatsApp.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="no-print mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" className="flex-1 font-bold" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Cetak / Download Bukti
        </Button>
        <Button className="flex-1 font-bold" onClick={() => navigate(`/reservasi/${reservation.reservationCode}`)}>
          Cek Status Reservasi <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
      <div className="no-print mt-4 text-center">
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary">
          <Home className="h-4 w-4" /> Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed pb-3 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right', mono && 'font-mono tracking-wide', strong ? 'font-extrabold text-primary' : 'font-bold')}>{value}</dd>
    </div>
  );
}
