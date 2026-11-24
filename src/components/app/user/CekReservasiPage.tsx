'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, LockKeyhole, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { navigate } from '@/components/app/router';
import { api, setVerifiedReservation } from '@/lib/api-client';
import type { ReservationDTO } from '@/lib/types';

export function CekReservasiPage() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState<{ code: string; phone: string; name: string } | null>(null);

  useEffect(() => {
    api('/api/demo-hint').then((d) => setHint(d.hint)).catch(() => {});
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!code.trim() || !phone.trim()) {
      setError('Kode reservasi dan nomor WhatsApp wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const d = await api<{ reservation: ReservationDTO }>('/api/reservations/check', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), phone: phone.trim() }),
      });
      setVerifiedReservation(d.reservation.reservationCode, d.reservation.phone);
      navigate(`/reservasi/${d.reservation.reservationCode}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-14 sm:px-6">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <LockKeyhole className="h-7 w-7 text-primary" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Cek Reservasi</h1>
        <p className="mt-2 text-muted-foreground">
          Masukkan kode reservasi dan nomor WhatsApp Anda untuk melihat status reservasi.
        </p>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode Reservasi</Label>
              <Input
                id="kode" placeholder="cth: SRT-260927-001" value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-base font-bold tracking-wider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa">Nomor WhatsApp</Label>
              <Input
                id="wa" inputMode="numeric" placeholder="cth: 081234567890" value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full text-base font-bold" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
              Cek Reservasi
            </Button>
          </form>
        </CardContent>
      </Card>

      {hint && (
        <div className="mt-6 rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-sky-800">
            <Sparkles className="h-4 w-4" /> Contoh data demo
          </p>
          <p className="mt-1.5 text-sm text-sky-700">
            Kode: <b className="font-mono">{hint.code}</b> · WA: <b>{hint.phone}</b> ({hint.name})
          </p>
          <Button
            variant="outline" size="sm"
            className="mt-3 border-sky-300 bg-white text-sky-700 hover:bg-sky-100"
            onClick={() => { setCode(hint.code); setPhone(hint.phone); }}
          >
            Isi otomatis <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
