'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Banknote, CalendarDays, FileDown, FileSpreadsheet, FileText, Loader2, Printer,
  RefreshCw, Users, Wallet, AlertCircle, Layers, BadgeX, SearchX, FileCheck2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/app/shared/StatusBadge';
import { EmptyState } from '@/components/app/shared/EmptyState';
import { api } from '@/lib/api-client';
import { addDaysStr, formatDateShort, formatRupiah, todayJakarta, formatDateTimeID, PAYMENT_METHOD_LABEL, paymentDisplayLabel } from '@/lib/format';

export function AdminLaporanPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-extrabold tracking-tight">Laporan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rekap reservasi &amp; pendapatan, serta laporan PDF profesional siap cetak.
        </p>
      </div>

      <Tabs defaultValue="rekap" className="space-y-5">
        <TabsList className="print:hidden">
          <TabsTrigger value="rekap" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Rekap Reservasi</TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5"><FileText className="h-4 w-4" /> Laporan PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="rekap" className="space-y-5">
          <RekapReservasiSection />
        </TabsContent>
        <TabsContent value="pdf" className="space-y-5">
          <ReportPDFSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================= TAB 1: REKAP RESERVASI (fitur lama, tetap) =================
function RekapReservasiSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({
    from: addDaysStr(todayJakarta(), -7),
    to: addDaysStr(todayJakarta(), 7),
    status: '',
    method: '',
  });

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    api(`/api/admin/reports?${qs}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, refreshKey]);

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Tanggal', 'Jam', 'Kode Reservasi', 'Nama', 'Peserta', 'Metode', 'Status Bayar', 'Total', 'Dibayar', 'Sisa', 'Status'];
    const lines = data.table.map((r: any) => [
      r.date, r.time, r.reservationCode, `"${r.name}"`, r.participantCount,
      r.paymentMethod ? (PAYMENT_METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : '-',
      r.paymentStatus ? paymentDisplayLabel(r.paymentStatus, r.paymentMethod) : '-',
      r.totalPrice, r.amountPaid, r.remainingAmount, r.reservationStatus,
    ]);
    const csv = [headers, ...lines].map((l) => l.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-sukan-river-tubing_${filters.from}_sd_${filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary;

  return (
    <>
      {/* Filter */}
      <Card className="shadow-sm print:hidden">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Tanggal Mulai</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tanggal Akhir</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status Reservasi</Label>
            <Select value={filters.status || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label className="text-xs">Metode Pembayaran</Label>
            <Select value={filters.method || 'ALL'} onValueChange={(v) => setFilters((f) => ({ ...f, method: v === 'ALL' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="FULL_PAYMENT">Lunas</SelectItem>
                <SelectItem value="ONSITE">Bayar di Tempat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline" className="flex-1"
              onClick={() => { setLoading(true); setRefreshKey((k) => k + 1); }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : !data || data.table.length === 0 ? (
        <EmptyState icon={BarChart3} title="Tidak ada data pada rentang ini" description="Ubah filter tanggal atau status lalu terapkan." />
      ) : (
        <>
          {/* Ringkasan */}
          <div className="print-area space-y-4">
            <div className="hidden print:block">
              <h1 className="text-xl font-extrabold">Laporan Sukan River Tubing</h1>
              <p className="text-sm text-muted-foreground">Periode: {filters.from} s/d {filters.to}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <SumCard icon={CalendarDays} label="Total Reservasi" value={String(s.totalReservations)} />
              <SumCard icon={Users} label="Total Peserta" value={`${s.totalParticipants} org`} />
              <SumCard icon={Wallet} label="Total Pendapatan" value={formatRupiah(s.totalRevenue)} highlight />
              <SumCard icon={CheckCircle2} label="Reservasi Lunas" value={String(s.lunasCount)} />
              <SumCard icon={AlertCircle} label="Reservasi Belum Bayar" value={String(s.belumBayarCount)} orange />
              <SumCard icon={Banknote} label="Reservasi Bayar di Tempat" value={String(s.onsiteCount)} />
              <SumCard icon={AlertCircle} label="Sisa Pembayaran" value={formatRupiah(s.totalRemaining)} orange />
              <SumCard icon={Layers} label="Jumlah Kelompok" value={String(s.groupCount)} />
              <SumCard icon={BadgeX} label="Pembatalan" value={String(s.cancellationCount)} red />
            </div>

            {/* Tabel laporan */}
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Reservasi</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Peserta</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead>Status Bayar</TableHead>
                        <TableHead>Dibayar</TableHead>
                        <TableHead>Sisa</TableHead>
                        <TableHead>Pendapatan</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.table.map((r: any) => (
                        <TableRow key={r.id} className={r.reservationStatus === 'DIBATALKAN' ? 'opacity-55' : ''}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(r.date)} · {r.time}</TableCell>
                          <TableCell className="font-mono text-xs font-bold whitespace-nowrap">{r.reservationCode}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">{r.name}</TableCell>
                          <TableCell>{r.participantCount} org</TableCell>
                          <TableCell>{r.paymentMethod && <PaymentMethodBadge method={r.paymentMethod} />}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.paymentStatus ? <PaymentStatusBadge status={r.paymentStatus} method={r.paymentMethod} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap font-semibold text-emerald-700">{formatRupiah(r.amountPaid)}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.remainingAmount > 0 ? formatRupiah(r.remainingAmount) : '—'}</TableCell>
                          <TableCell className="whitespace-nowrap font-bold">{formatRupiah(r.totalPrice)}</TableCell>
                          <TableCell><StatusBadge status={r.reservationStatus} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export */}
          <div className="flex flex-col gap-3 sm:flex-row print:hidden">
            <Button variant="outline" className="flex-1 font-bold" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak Halaman
            </Button>
            <Button className="flex-1 bg-emerald-600 font-bold hover:bg-emerald-700" onClick={exportCSV}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel (CSV)
            </Button>
          </div>
        </>
      )}
    </>
  );
}

// ================= TAB 2: LAPORAN PDF (baru) =================
const REPORT_TYPES = [
  { value: 'reservations', label: 'Laporan Reservasi', desc: 'Daftar reservasi, customer, pembayaran' },
  { value: 'grouping', label: 'Laporan Pengelompokan', desc: 'Kelompok + status kanban + guide' },
  { value: 'participants', label: 'Laporan Peserta', desc: 'Daftar peserta per reservasi' },
  { value: 'payments', label: 'Laporan Pembayaran', desc: 'Transaksi lunas / pelunasan / di tempat' },
  { value: 'guides', label: 'Laporan Guide', desc: 'Penugasan pemandu per kelompok' },
  { value: 'honor', label: 'Laporan Honor Guide', desc: 'Honor pemandu + total' },
];

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  reservations: [
    { value: 'MENUNGGU_PEMBAYARAN', label: 'Menunggu Pembayaran' },
    { value: 'TERKONFIRMASI', label: 'Terkonfirmasi' },
    { value: 'SELESAI', label: 'Selesai' },
    { value: 'DIBATALKAN', label: 'Dibatalkan' },
  ],
  participants: [
    { value: 'MENUNGGU_PEMBAYARAN', label: 'Menunggu Pembayaran' },
    { value: 'TERKONFIRMASI', label: 'Terkonfirmasi' },
    { value: 'SELESAI', label: 'Selesai' },
    { value: 'DIBATALKAN', label: 'Dibatalkan' },
  ],
  grouping: [
    { value: 'NEW', label: 'Terbaru' },
    { value: 'IN_PROGRESS', label: 'Sedang Diproses' },
    { value: 'DONE', label: 'Selesai' },
  ],
  payments: [
    { value: 'PAID', label: 'Lunas' },
    { value: 'UNPAID', label: 'Belum Bayar' },
  ],
  guides: [
    { value: 'DITUGASKAN', label: 'Ditugaskan' },
    { value: 'SELESAI', label: 'Selesai' },
  ],
  honor: [
    { value: 'BELUM_DIPROSES', label: 'Belum Diproses' },
    { value: 'SIAP_DIBAYARKAN', label: 'Siap Dibayar' },
    { value: 'SUDAH_DIBAYARKAN', label: 'Sudah Dibayar' },
  ],
};

function ReportPDFSection() {
  const { toast } = useToast();
  const [guides, setGuides] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [noData, setNoData] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    type: 'reservations',
    from: addDaysStr(todayJakarta(), -30),
    to: addDaysStr(todayJakarta(), 7),
    status: '',
    guideId: '',
    scheduleDate: '',
  });

  useEffect(() => {
    api('/api/admin/guides').then((d) => setGuides(d.guides)).catch(() => {});
  }, []);

  const generate = async () => {
    setFormError('');
    if (form.from && form.to && form.from > form.to) {
      setFormError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      return;
    }
    setGenerating(true);
    setReport(null);
    setNoData(false);
    try {
      const qs = new URLSearchParams();
      if (form.type) qs.set('type', form.type);
      if (form.from) qs.set('from', form.from);
      if (form.to) qs.set('to', form.to);
      if (form.status) qs.set('status', form.status);
      if (form.guideId) qs.set('guideId', form.guideId);
      if (form.scheduleDate) qs.set('scheduleDate', form.scheduleDate);
      const d = await api(`/api/admin/reports/data?${qs.toString()}`);
      if (!d.rows || d.rows.length === 0) {
        setNoData(true);
        setReport(d);
      } else {
        setReport(d);
      }
    } catch (e: any) {
      setFormError(e.message || 'Gagal membuat laporan.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!report || report.rows?.length === 0) return;
    setDownloading(true);
    try {
      const { downloadReportPDF } = await import('@/lib/pdf');
      downloadReportPDF(report);
    } catch (e: any) {
      toast({ title: 'Gagal membuat PDF', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const printPDF = async () => {
    if (!report || report.rows?.length === 0) return;
    setDownloading(true);
    try {
      const { printReportPDF } = await import('@/lib/pdf');
      printReportPDF(report);
    } catch (e: any) {
      toast({ title: 'Gagal mencetak PDF', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const statusOptions = STATUS_OPTIONS[form.type] ?? [];
  const showGuideFilter = form.type === 'guides' || form.type === 'honor';

  return (
    <>
      {/* ===== Form jenis laporan + filter ===== */}
      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setForm((f) => ({ ...f, type: t.value, status: '' }))}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  form.type === t.value
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className={`text-sm font-extrabold ${form.type === t.value ? 'text-primary' : ''}`}>{t.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal Mulai</Label>
              <Input type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal Akhir</Label>
              <Input type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status || 'ALL'} onValueChange={(v) => setForm((f) => ({ ...f, status: v === 'ALL' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Guide {showGuideFilter ? '' : '(khusus Guide/Honor)'}</Label>
              <Select
                value={form.guideId || 'ALL'}
                onValueChange={(v) => setForm((f) => ({ ...f, guideId: v === 'ALL' ? '' : v }))}
                disabled={!showGuideFilter}
              >
                <SelectTrigger className={!showGuideFilter ? 'opacity-50' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Guide</SelectItem>
                  {guides.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal Jadwal (opsional)</Label>
              <Input type="date" value={form.scheduleDate} onChange={(e) => setForm((f) => ({ ...f, scheduleDate: e.target.value }))} />
            </div>
          </div>

          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              <AlertCircle className="mr-1.5 inline h-4 w-4" /> {formError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={generate} disabled={generating} className="flex-1 font-bold sm:flex-none sm:px-8">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
              Generate Report
            </Button>
            {report && (
              <p className="self-center text-xs text-muted-foreground">
                Pratinjau: <b>{report.title}</b> · {report.rows?.length ?? 0} baris data
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Hasil ===== */}
      {generating ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : noData ? (
        <EmptyState
          icon={SearchX}
          title="Tidak ada data untuk periode yang dipilih"
          description="Ubah jenis laporan, rentang tanggal, atau filter status lalu klik Generate Report lagi."
        />
      ) : report ? (
        <>
          {/* Preview */}
          <Card className="shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-3.5">
                <div>
                  <p className="text-lg font-extrabold">{report.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Periode: {report.periodeLabel} · Dicetak: {formatDateTimeID(report.generatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="font-bold" onClick={printPDF} disabled={downloading}>
                    {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Cetak PDF
                  </Button>
                  <Button className="bg-emerald-600 font-bold hover:bg-emerald-700" onClick={downloadPDF} disabled={downloading}>
                    {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    Download PDF
                  </Button>
                </div>
              </div>

              {/* Ringkasan */}
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {report.summary?.map((s: any) => (
                  <div key={s.label} className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className="mt-1.5 text-base font-extrabold">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Tabel */}
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {report.columns?.map((c: any) => (
                        <TableHead
                          key={c.key}
                          className={`whitespace-nowrap text-[11px] uppercase tracking-wide ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                        >
                          {c.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows?.slice(0, 200).map((row: string[], i: number) => (
                      <TableRow key={i} className={i % 2 === 1 ? 'bg-emerald-50/40' : ''}>
                        {row.map((cell, j) => (
                          <TableCell
                            key={j}
                            className={`whitespace-nowrap text-xs ${report.columns[j]?.align === 'right' ? 'text-right font-semibold' : report.columns[j]?.align === 'center' ? 'text-center' : ''} ${j === 0 ? 'text-muted-foreground' : ''}`}
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(report.rows?.length ?? 0) > 200 && (
                <p className="text-xs text-muted-foreground">
                  * Pratinjau menampilkan 200 baris pertama — PDF berisi seluruh {report.rows.length} baris.
                </p>
              )}

              {report.totals?.length > 0 && (
                <div className="flex justify-end">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3">
                    {report.totals.map((t: any) => (
                      <p key={t.label} className="text-sm font-extrabold text-emerald-800">
                        {t.label}: <span className="text-base">{t.value}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {report.notes?.length > 0 && (
                <div className="rounded-xl bg-muted/40 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Keterangan</p>
                  <ul className="mt-1.5 space-y-1">
                    {report.notes.map((n: string, i: number) => (
                      <li key={i} className="text-xs leading-relaxed text-muted-foreground">• {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="Pilih jenis laporan lalu Generate"
          description="Atur jenis laporan, periode, dan filter — pratinjau data akan tampil di sini sebelum diunduh sebagai PDF."
        />
      )}
    </>
  );
}

function SumCard({ icon: Icon, label, value, highlight, orange, red }: any) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
        </div>
        <p className={`mt-2 text-xl font-extrabold ${highlight ? 'text-emerald-600' : orange ? 'text-orange-600' : red ? 'text-rose-600' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ================= HALAMAN PENGATURAN =================
export function AdminPengaturanPage() {
  const [settings, setSettings] = useState<any>(null);
  const [price, setPrice] = useState(25000);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api('/api/settings').then((d) => {
      setSettings(d.settings);
      setPrice(d.settings.pricePerPerson);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ pricePerPerson: price }),
      });
      toast({ title: 'Pengaturan disimpan', description: `Harga ${formatRupiah(price)}/orang` });
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <Loader2 className="mx-auto mt-16 h-8 w-8 animate-spin text-primary" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur harga tiket dan lihat metode pembayaran yang berlaku.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-7 p-6 sm:p-8">
          <div className="space-y-3">
            <Label className="font-bold" htmlFor="harga">Harga per Orang (Rp)</Label>
            <Input
              id="harga" type="number" min={1000} max={1000000} step={500}
              value={price} onChange={(e) => setPrice(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Harga saat ini: <b>{formatRupiah(settings.pricePerPerson)}</b> /orang · Kelompok ideal 7 orang.</p>
          </div>

          <div className="space-y-3">
            <Label className="font-bold">Metode Pembayaran yang Berlaku</Label>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
                <Badge className="mt-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Lunas</Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Pelanggan membayar penuh secara online saat reservasi melalui payment gateway.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
                <Badge className="mt-0.5 bg-orange-100 text-orange-700 hover:bg-orange-100">Bayar di Tempat</Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Pelanggan tidak membayar online — pembayaran dilakukan langsung di lokasi Sukan River Tubing saat hari H, lalu dikonfirmasi admin.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={busy} className="w-full font-bold" size="lg">
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null} Simpan Pengaturan
          </Button>
          <p className="flex items-start gap-2 rounded-xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
            <FileDown className="mt-0.5 h-4 w-4 shrink-0" />
            Perubahan harga hanya berlaku untuk reservasi baru. Reservasi lama tetap menggunakan harga saat reservasi dibuat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
