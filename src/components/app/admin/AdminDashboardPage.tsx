'use client';

import { useEffect, useState } from 'react';
import {
  Activity, AlertCircle, ArrowRight, Banknote, CalendarDays, ClipboardList, Gauge,
  Loader2, TrendingUp, Users, Wallet, CheckCircle2, Clock, LifeBuoy, HandCoins, UserRound, UserRoundCheck, Footprints,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { StatusBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { navigate } from '@/components/app/router';
import { api } from '@/lib/api-client';
import { formatRupiah, formatDateShort } from '@/lib/format';

const GREENS = ['oklch(0.55 0.12 152)', 'oklch(0.62 0.095 205)', 'oklch(0.76 0.155 75)'];

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white px-3.5 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-bold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="text-xs" style={{ color: p.color ?? p.fill }}>
          {p.name}: <b>{formatter ? formatter(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

export function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/stats')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Gagal memuat data dashboard.</p>;

  const c = data.cards;
  const cards = [
    { label: 'Total Reservasi', value: c.totalReservations, icon: ClipboardList, color: 'bg-primary/10 text-primary' },
    { label: 'Reservasi Hari Ini', value: c.reservationsToday, icon: CalendarDays, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Total Peserta', value: c.totalParticipants, icon: Users, color: 'bg-sky-100 text-sky-700' },
    { label: 'Menunggu Pengelompokan', value: c.waitingGrouping, icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { label: 'Reservasi Belum Bayar', value: c.unpaidCount, icon: AlertCircle, color: 'bg-rose-100 text-rose-700' },
    { label: 'Reservasi Lunas', value: c.paidCount, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Reservasi Bayar di Tempat', value: c.onsitePendingCount, icon: Banknote, color: 'bg-orange-100 text-orange-700' },
    { label: 'Jadwal Aktif', value: c.activeSchedules, icon: Gauge, color: 'bg-violet-100 text-violet-700' },
  ];

  const perDay = data.charts.perDay.map((d: any) => ({ ...d, label: formatDateShort(d.date) }));
  const methodData = data.charts.methodCounts.filter((m: any) => m.value > 0);
  const capacity = data.charts.capacityPerDay.map((d: any) => ({ ...d, label: formatDateShort(d.date) }));

  const gs = data.guideStats;
  const guideCards = gs ? [
    { label: 'Guide Tersedia', value: String(gs.guideAvailable), icon: LifeBuoy, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Guide Sedang Bertugas', value: String(gs.guideOnDuty), icon: UserRoundCheck, color: 'bg-sky-100 text-sky-700' },
    { label: 'Kelompok Tanpa Guide', value: String(gs.groupsWithoutGuide), icon: UserRound, color: 'bg-amber-100 text-amber-700' },
    { label: 'Penugasan Hari Ini', value: String(gs.assignmentsToday), icon: Footprints, color: 'bg-violet-100 text-violet-700' },
    { label: 'Honor Belum Diproses', value: formatRupiah(gs.honorUnprocessed), icon: HandCoins, color: 'bg-orange-100 text-orange-700' },
    { label: 'Honor Siap Dibayar', value: formatRupiah(gs.honorReady), icon: Banknote, color: 'bg-sky-100 text-sky-700' },
    { label: 'Total Honor Bulan Ini', value: formatRupiah(gs.honorThisMonth), icon: Wallet, color: 'bg-emerald-100 text-emerald-700' },
  ] : [];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan operasional Sukan River Tubing hari ini.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/reservasi')}>
          Kelola Reservasi <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Kartu statistik */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold leading-none tabular-nums">{card.value}</p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== Operasional Pemandu ===== */}
      {gs && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <LifeBuoy className="h-4.5 w-4.5 text-primary" /> Operasional Pemandu
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/pemandu')}>
                Kelola Guide <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/honor-pemandu')}>
                Honor Guide <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
            {guideCards.map((card) => (
              <Card key={card.label} className="shadow-sm">
                <CardContent className="p-4">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
                    <card.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-2 text-lg font-extrabold leading-tight tabular-nums">{card.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium leading-tight text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Grafik */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4.5 w-4.5 text-primary" /> Reservasi &amp; Peserta (14 Hari)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={perDay} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.12 152)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.55 0.12 152)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gPar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.095 205)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.62 0.095 205)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.92 0.01 150)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="reservations" name="Reservasi" stroke="oklch(0.50 0.12 152)" strokeWidth={2.5} fill="url(#gRes)" />
                <Area type="monotone" dataKey="participants" name="Peserta" stroke="oklch(0.58 0.095 205)" strokeWidth={2.5} fill="url(#gPar)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4.5 w-4.5 text-primary" /> Metode Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            {methodData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={methodData} dataKey="value" nameKey="label"
                    cx="50%" cy="46%" innerRadius={52} outerRadius={82} paddingAngle={3}
                  >
                    {methodData.map((_: any, i: number) => <Cell key={i} fill={GREENS[i % GREENS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v: any) => `${v} reservasi`} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4.5 w-4.5 text-primary" /> Pendapatan per Hari</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={perDay} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.92 0.01 150)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<ChartTooltip formatter={(v: any) => formatRupiah(v)} />} />
                <Bar dataKey="revenue" name="Pendapatan" fill="oklch(0.55 0.12 152)" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4.5 w-4.5 text-primary" /> Tingkat Kapasitas (7 Hari)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={capacity} layout="vertical" margin={{ top: 5, right: 18, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.92 0.01 150)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
                <Tooltip content={<ChartTooltip formatter={(v: any) => `${v}% terpakai`} />} />
                <Bar dataKey="utilization" name="Okupansi" fill="oklch(0.62 0.095 205)" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Reservasi terbaru */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reservasi Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4 font-semibold">Kode</th>
                  <th className="pb-2.5 pr-4 font-semibold">Nama</th>
                  <th className="pb-2.5 pr-4 font-semibold">Jadwal</th>
                  <th className="pb-2.5 pr-4 font-semibold">Peserta</th>
                  <th className="pb-2.5 pr-4 font-semibold">Pembayaran</th>
                  <th className="pb-2.5 pr-4 font-semibold">Status</th>
                  <th className="pb-2.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.latest.map((r: any) => (
                  <tr key={r.id} className="border-b border-dashed last:border-0 hover:bg-muted/40">
                    <td className="py-3 pr-4"><span className="font-mono text-xs font-bold">{r.reservationCode}</span></td>
                    <td className="py-3 pr-4 font-semibold">{r.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateShort(r.date)} · {r.time}</td>
                    <td className="py-3 pr-4"><span className="font-bold">{r.participantCount}</span> org</td>
                    <td className="py-3 pr-4">{r.paymentStatus && <PaymentStatusBadge status={r.paymentStatus} method={r.paymentMethod} />}</td>
                    <td className="py-3 pr-4"><StatusBadge status={r.reservationStatus} /></td>
                    <td className="py-3 font-bold">{formatRupiah(r.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
