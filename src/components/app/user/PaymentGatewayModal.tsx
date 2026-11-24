'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, CreditCard, Landmark, Lock, Loader2, QrCode, ShieldCheck, Timer, X, Info, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api-client';
import { formatRupiah, formatDateID } from '@/lib/format';
import type { ReservationDTO } from '@/lib/types';
import { cn } from '@/lib/utils';

const CHANNELS = [
  { id: 'VA', label: 'Virtual Account', desc: 'Transfer otomatis via ATM/mBanking', icon: Landmark },
  { id: 'QRIS', label: 'QRIS', desc: 'Scan dari semua e-wallet Indonesia', icon: QrCode },
  { id: 'CARD', label: 'Kartu Kredit/Debit', desc: 'Visa, Mastercard, JCB', icon: CreditCard },
];

const PROCESS_STEPS = ['Menghubungi payment gateway…', 'Memverifikasi pembayaran…', 'Menyelesaikan transaksi…'];

export function PaymentGatewayModal({
  reservation, onPaid, onCancel,
}: {
  reservation: ReservationDTO;
  onPaid: (res: ReservationDTO) => void;
  onCancel: () => void;
}) {
  const [channel, setChannel] = useState('VA');
  const [phase, setPhase] = useState<'select' | 'processing' | 'success' | 'error'>('select');
  const [progress, setProgress] = useState(0);
  const [processStep, setProcessStep] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reservation: ReservationDTO; transaction: { transactionCode: string; amount: number; status: string } } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);

  const p = reservation.payment!;
  // Modal ini hanya untuk metode LUNAS (pembayaran penuh online).
  const amount = p.totalAmount;

  // countdown 10 menit
  useEffect(() => {
    if (phase !== 'select') return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const mmss = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [secondsLeft]);

  const vaNumber = useMemo(() => {
    // nomor VA simulasi dari kode reservasi
    const digits = reservation.reservationCode.replace(/\D/g, '');
    return `8808 ${digits.slice(-4)} ${digits.slice(-4, -1)} ${String(1000 + (digits.length * 7) % 9000)}`;
  }, [reservation.reservationCode]);

  const startPay = async () => {
    setPhase('processing');
    setProgress(0);
    setProcessStep(0);
    // animasi proses bertahap (simulasi)
    const timers: any[] = [];
    timers.push(setTimeout(() => { setProgress(35); setProcessStep(1); }, 900));
    timers.push(setTimeout(() => { setProgress(70); setProcessStep(2); }, 1800));
    timers.push(setTimeout(() => setProgress(90), 2600));
    try {
      const payPromise = api<any>(`/api/payments/${reservation.id}/pay`, { method: 'POST' });
      const [data] = await Promise.all([
        payPromise,
        new Promise((r) => timers.push(setTimeout(r, 3000))),
      ]);
      setProgress(100);
      setResult(data);
      setTimeout(() => setPhase('success'), 400);
    } catch (e: any) {
      timers.forEach(clearTimeout);
      setError(e.message || 'Pembayaran gagal diproses.');
      setPhase('error');
    }
  };

  const statusLabel = 'LUNAS';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Pembayaran">
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl scrollbar-thin">
        {/* ===== Header ===== */}
        <div className="sticky top-0 z-10 border-b bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Lock className="h-4.5 w-4.5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-extrabold leading-tight">Pembayaran Aman</p>
                <p className="text-[11px] text-muted-foreground">Secure Payment · Sukan River Tubing</p>
              </div>
            </div>
            {phase === 'select' && (
              <button onClick={onCancel} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted" aria-label="Tutup">
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-700">
              <Info className="mr-1 h-3 w-3" /> SIMULASI PAYMENT GATEWAY
            </Badge>
            {phase === 'select' && (
              <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> {mmss}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {/* ===== PILIH CHANNEL & BAYAR ===== */}
          {phase === 'select' && (
            <>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kode Reservasi</span>
                  <span className="font-mono font-extrabold tracking-wider">{reservation.reservationCode}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Jadwal</span>
                  <span className="font-semibold">{formatDateID(reservation.schedule.date, false)} · {reservation.schedule.time}</span>
                </div>
                <div className="my-3 border-t border-dashed" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Reservasi</span><b>{formatRupiah(p.totalAmount)}</b></div>
                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-bold">Total Dibayar</span>
                    <span className="font-extrabold text-primary">{formatRupiah(amount)}</span>
                  </div>
                </div>
              </div>

              <p className="mb-2.5 mt-5 text-sm font-bold">Pilih Metode Pembayaran</p>
              <div className="space-y-2.5">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all',
                      channel === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    )}
                  >
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', channel === c.id ? 'bg-primary text-white' : 'bg-muted')}>
                      <c.icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.desc}</span>
                    </span>
                    {channel === c.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>

              {channel === 'VA' && (
                <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                  <p className="text-xs font-semibold text-muted-foreground">Nomor Virtual Account (simulasi)</p>
                  <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-primary">{vaNumber}</p>
                </div>
              )}

              <Button size="lg" className="mt-5 w-full text-base font-bold" onClick={startPay}>
                <ShieldCheck className="mr-2 h-5 w-5" /> Bayar Sekarang · {formatRupiah(amount)}
              </Button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Dengan menekan Bayar Sekarang, Anda dianggap menyetujui ketentuan layanan.
                Prototipe ini tidak memproses transaksi nyata.
              </p>
            </>
          )}

          {/* ===== PROCESSING ===== */}
          {phase === 'processing' && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="relative mb-6">
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-success-ring" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-9 w-9 animate-spin text-primary" />
                </span>
              </div>
              <p className="text-lg font-extrabold">Memproses Pembayaran…</p>
              <p className="mt-1 text-sm text-muted-foreground">Mohon jangan tutup halaman ini</p>
              <div className="mt-6 w-full max-w-xs space-y-3">
                <Progress value={progress} className="h-2" />
                <div className="space-y-1.5 text-left">
                  {PROCESS_STEPS.map((s, i) => (
                    <p key={s} className={cn('flex items-center gap-2 text-xs font-medium transition-colors', i <= processStep ? 'text-foreground' : 'text-muted-foreground/50')}>
                      {i < processStep ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : i === processStep ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-muted" />
                      )}
                      {s}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== SUCCESS ===== */}
          {phase === 'success' && result && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="relative mb-6">
                <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-pulse-success-ring" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                  <svg viewBox="0 0 24 24" className="h-10 w-10 animate-draw-check" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <p className="text-xl font-extrabold text-emerald-700">Pembayaran Berhasil</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pembayaran lunas telah diterima
              </p>
              <div className="mt-6 w-full rounded-2xl border bg-muted/40 p-5 text-left text-sm">
                <SummaryRow label="Kode Transaksi" value={result.transaction.transactionCode} mono />
                <SummaryRow label="Jumlah" value={formatRupiah(result.transaction.amount)} />
                <SummaryRow label="Status" value={statusLabel} highlight />
                <SummaryRow label="Kode Reservasi" value={reservation.reservationCode} mono />
              </div>
              <Button size="lg" className="mt-6 w-full font-bold" onClick={() => onPaid(result.reservation)}>
                Selesai
              </Button>
            </div>
          )}

          {/* ===== ERROR ===== */}
          {phase === 'error' && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                <X className="h-8 w-8 text-rose-600" />
              </span>
              <p className="text-lg font-extrabold text-rose-700">Pembayaran Gagal</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{error}</p>
              <div className="mt-6 flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={onCancel}>Nanti Saja</Button>
                <Button className="flex-1" onClick={() => { setPhase('select'); setError(''); }}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Coba Lagi
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed py-2.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold', mono && 'font-mono tracking-wide', highlight && 'text-emerald-600')}>{value}</span>
    </div>
  );
}
