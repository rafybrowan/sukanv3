import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAdminId, unauthorized } from '@/lib/auth';
import {
  RESERVATION_STATUS_LABEL, paymentDisplayLabel,
  ASSIGNMENT_STATUS_LABEL, HONOR_STATUS_LABEL, PROGRESS_STATUS_LABEL, CONDITION_STATUS_LABEL,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

/** "2026-09-27" -> "27 Sep 2026" */
function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(dateStr + 'T00:00:00Z'));
}

function fmtDateIDLong(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(dateStr + 'T00:00:00Z'));
}

function fmtRupiah(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
}

function fmtPhone(phone: string): string {
  const p = phone || '';
  if (p.startsWith('08') && p.length >= 10) return p.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  return p;
}

function jakartaDateISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

type ReportColumn = { key: string; label: string; align?: 'left' | 'center' | 'right' };

/**
 * GET /api/admin/reports/data — data laporan siap-cetak (PDF).
 * Query: type=reservations|grouping|participants|payments|guides|honor
 *        &from=&to= (YYYY-MM-DD) &status= &guideId= &scheduleDate=
 * Semua nilai dikembalikan siap tampil (string) agar preview & PDF konsisten.
 */
export async function GET(req: NextRequest) {
  if (!getAdminId(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') || '';
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  const status = sp.get('status') || '';
  const guideId = sp.get('guideId') || '';
  const scheduleDate = sp.get('scheduleDate') || '';

  if (!['reservations', 'grouping', 'participants', 'payments', 'guides', 'honor'].includes(type)) {
    return Response.json({ error: 'Jenis laporan tidak dikenal.' }, { status: 400 });
  }
  if (from && to && from > to) {
    return Response.json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.' }, { status: 400 });
  }

  const periodeLabel = from && to ? `${fmtDateIDLong(from)} — ${fmtDateIDLong(to)}` : 'Semua Periode';
  const generatedAt = new Date().toISOString();
  const filterBits: string[] = [];
  if (from && to) filterBits.push(`Periode ${fmtDate(from)} s/d ${fmtDate(to)}`);
  if (scheduleDate) filterBits.push(`Jadwal ${fmtDate(scheduleDate)}`);
  if (status) filterBits.push(`Status: ${status}`);
  if (guideId) filterBits.push('Guide tertentu');

  const base = {
    type, periodeLabel, generatedAt, from, to,
    notes: [
      'Laporan dihasilkan otomatis oleh Sistem Informasi Reservasi Sukan River Tubing.',
      ...(filterBits.length > 0 ? [`Filter: ${filterBits.join(' · ')}.`] : []),
    ],
  };

  // ================= LAPORAN RESERVASI & PESERTA =================
  if (type === 'reservations' || type === 'participants') {
    const where: any = { schedule: {} };
    if (from) where.schedule.date = { ...(where.schedule.date || {}), gte: from };
    if (to) where.schedule.date = { ...(where.schedule.date || {}), lte: to };
    if (scheduleDate) where.schedule.date = scheduleDate;
    if (status) where.reservationStatus = status;

    const rows = await db.reservation.findMany({
      where,
      include: { schedule: true, payment: true, groupMembers: true },
      orderBy: [{ schedule: { date: 'asc' } }, { schedule: { time: 'asc' } }],
      take: 1000,
    });

    const active = rows.filter((r) => r.reservationStatus !== 'DIBATALKAN');
    const totalPaid = active.reduce((s, r) => s + (r.payment?.amountPaid || 0), 0);
    const groupIds = new Set<string>();
    for (const r of active) for (const gm of r.groupMembers) groupIds.add(gm.groupId);
    const groupsInPeriode = await db.group.findMany({
      where: { id: { in: [...groupIds] } },
      select: { progressStatus: true },
    });

    if (type === 'reservations') {
      const columns: ReportColumn[] = [
        { key: 'no', label: 'No', align: 'center' },
        { key: 'code', label: 'Kode Reservasi' },
        { key: 'date', label: 'Tanggal', align: 'center' },
        { key: 'time', label: 'Jam', align: 'center' },
        { key: 'name', label: 'Nama Customer' },
        { key: 'phone', label: 'No. WhatsApp' },
        { key: 'pax', label: 'Jml Peserta', align: 'center' },
        { key: 'resStatus', label: 'Status Reservasi' },
        { key: 'payStatus', label: 'Status Pembayaran' },
        { key: 'paid', label: 'Total Pembayaran', align: 'right' },
      ];
      return Response.json({
        ...base,
        title: 'Laporan Reservasi',
        orientation: 'landscape',
        fileName: `laporan-reservasi${from && to ? `_${from}_sd_${to}` : ''}`,
        summary: [
          { label: 'Total Reservasi', value: String(rows.length) },
          { label: 'Total Peserta', value: `${active.reduce((s, r) => s + r.participantCount, 0)} org` },
          { label: 'Total Kelompok', value: String(groupIds.size) },
          { label: 'Kelompok Selesai', value: String(groupsInPeriode.filter((g) => g.progressStatus === 'DONE').length) },
          { label: 'Kelompok Diproses', value: String(groupsInPeriode.filter((g) => g.progressStatus !== 'DONE').length) },
          { label: 'Total Pendapatan', value: fmtRupiah(totalPaid) },
        ],
        columns,
        rows: rows.map((r, i) => [
          String(i + 1),
          r.reservationCode,
          fmtDate(r.schedule.date),
          r.schedule.time,
          r.name,
          fmtPhone(r.phone),
          String(r.participantCount),
          RESERVATION_STATUS_LABEL[r.reservationStatus] ?? r.reservationStatus,
          r.payment ? paymentDisplayLabel(r.payment.paymentStatus, r.payment.paymentMethod) : 'Belum Ada',
          fmtRupiah(r.payment?.amountPaid || 0),
        ]),
      });
    }

    // participants
    const columns: ReportColumn[] = [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'code', label: 'Kode Reservasi' },
      { key: 'date', label: 'Tanggal', align: 'center' },
      { key: 'time', label: 'Jam', align: 'center' },
      { key: 'name', label: 'Nama Customer' },
      { key: 'phone', label: 'No. WhatsApp' },
      { key: 'pax', label: 'Jml Peserta', align: 'center' },
      { key: 'resStatus', label: 'Status Reservasi' },
    ];
    return Response.json({
      ...base,
      title: 'Laporan Peserta',
      orientation: 'portrait',
      fileName: `laporan-peserta${from && to ? `_${from}_sd_${to}` : ''}`,
      summary: [
        { label: 'Total Reservasi', value: String(rows.length) },
        { label: 'Total Peserta', value: `${active.reduce((s, r) => s + r.participantCount, 0)} org` },
        { label: 'Terkonfirmasi', value: String(rows.filter((r) => r.reservationStatus === 'TERKONFIRMASI').length) },
        { label: 'Selesai', value: String(rows.filter((r) => r.reservationStatus === 'SELESAI').length) },
        { label: 'Dibatalkan', value: String(rows.filter((r) => r.reservationStatus === 'DIBATALKAN').length) },
      ],
      columns,
      rows: rows.map((r, i) => [
        String(i + 1),
        r.reservationCode,
        fmtDate(r.schedule.date),
        r.schedule.time,
        r.name,
        fmtPhone(r.phone),
        String(r.participantCount),
        RESERVATION_STATUS_LABEL[r.reservationStatus] ?? r.reservationStatus,
      ]),
    });
  }

  // ================= LAPORAN PENGELOMPOKAN =================
  if (type === 'grouping') {
    const where: any = { schedule: {} };
    if (from) where.schedule.date = { ...(where.schedule.date || {}), gte: from };
    if (to) where.schedule.date = { ...(where.schedule.date || {}), lte: to };
    if (scheduleDate) where.schedule.date = scheduleDate;
    if (status) where.progressStatus = status;

    const groups = await db.group.findMany({
      where,
      include: {
        schedule: true,
        members: { include: { reservation: { select: { payment: { select: { paymentStatus: true } } } } } },
        assignments: { where: { assignmentStatus: { in: ['DITUGASKAN', 'SELESAI'] } }, include: { guide: true }, orderBy: { assignedAt: 'desc' }, take: 1 },
      },
      orderBy: [{ schedule: { date: 'asc' } }, { schedule: { time: 'asc' } }],
      take: 500,
    });

    const columns: ReportColumn[] = [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'code', label: 'Group Code' },
      { key: 'date', label: 'Tanggal', align: 'center' },
      { key: 'time', label: 'Jam', align: 'center' },
      { key: 'pax', label: 'Jml Peserta', align: 'center' },
      { key: 'prog', label: 'Status Progress' },
      { key: 'cond', label: 'Kondisi', align: 'center' },
      { key: 'guide', label: 'Guide' },
      { key: 'guideStatus', label: 'Status Guide' },
      { key: 'pay', label: 'Status Pembayaran' },
    ];
    return Response.json({
      ...base,
      title: 'Laporan Pengelompokan',
      orientation: 'landscape',
      fileName: `laporan-pengelompokan${from && to ? `_${from}_sd_${to}` : ''}`,
      summary: [
        { label: 'Total Kelompok', value: String(groups.length) },
        { label: 'Total Peserta', value: `${groups.reduce((s, g) => s + g.members.reduce((x, m) => x + m.participantCount, 0), 0)} org` },
        { label: 'Selesai', value: String(groups.filter((g) => g.progressStatus === 'DONE').length) },
        { label: 'Sedang Diproses', value: String(groups.filter((g) => g.progressStatus === 'IN_PROGRESS').length) },
        { label: 'Terbaru', value: String(groups.filter((g) => g.progressStatus === 'NEW').length) },
        { label: 'Overdue', value: String(groups.filter((g) => g.conditionStatus === 'OVERDUE').length) },
      ],
      columns,
      rows: groups.map((g, i) => {
        const a = g.assignments[0] ?? null;
        const paid = g.members.filter((m) => m.reservation.payment?.paymentStatus === 'PAID').length;
        const payLabel = g.members.length === 0 ? '—' : paid === g.members.length ? 'LUNAS' : paid === 0 ? 'BELUM LUNAS' : `LUNAS ${paid}/${g.members.length}`;
        return [
          String(i + 1),
          g.groupCode,
          fmtDate(g.schedule.date),
          g.schedule.time,
          String(g.members.reduce((s, m) => s + m.participantCount, 0)),
          PROGRESS_STATUS_LABEL[g.progressStatus] ?? g.progressStatus,
          CONDITION_STATUS_LABEL[g.conditionStatus] ?? g.conditionStatus,
          a ? a.guide.name : '—',
          a ? (ASSIGNMENT_STATUS_LABEL[a.assignmentStatus] ?? a.assignmentStatus) : 'Belum Ditugaskan',
          payLabel,
        ];
      }),
    });
  }

  // ================= LAPORAN PEMBAYARAN =================
  if (type === 'payments') {
    const history = await db.paymentHistory.findMany({
      include: { payment: { include: { reservation: { include: { schedule: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    const rows = history.filter((h) => {
      const d = jakartaDateISO(h.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (scheduleDate && h.payment.reservation.schedule.date !== scheduleDate) return false;
      if (status && h.payment.paymentStatus !== status) return false;
      return true;
    });

    const sumBy = (t: string) => rows.filter((h) => h.type === t).reduce((s, h) => s + h.amount, 0);
    const TYPE_LABEL: Record<string, string> = { FULL: 'Bayar Lunas', SETTLEMENT: 'Pelunasan', ONSITE: 'Bayar di Tempat' };

    const columns: ReportColumn[] = [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'trx', label: 'Kode Transaksi' },
      { key: 'code', label: 'Kode Reservasi' },
      { key: 'name', label: 'Nama Customer' },
      { key: 'date', label: 'Tanggal Bayar', align: 'center' },
      { key: 'time', label: 'Jam', align: 'center' },
      { key: 'jenis', label: 'Jenis Pembayaran' },
      { key: 'amount', label: 'Jumlah', align: 'right' },
      { key: 'status', label: 'Status Pembayaran' },
    ];
    return Response.json({
      ...base,
      title: 'Laporan Pembayaran',
      orientation: 'landscape',
      fileName: `laporan-pembayaran${from && to ? `_${from}_sd_${to}` : ''}`,
      summary: [
        { label: 'Total Transaksi', value: String(rows.length) },
        { label: 'Total Nominal Masuk', value: fmtRupiah(rows.reduce((s, h) => s + h.amount, 0)) },
        { label: 'Bayar Lunas', value: fmtRupiah(sumBy('FULL')) },
        { label: 'Pelunasan', value: fmtRupiah(sumBy('SETTLEMENT')) },
        { label: 'Bayar di Tempat', value: fmtRupiah(sumBy('ONSITE')) },
      ],
      columns,
      rows: rows.map((h, i) => [
        String(i + 1),
        h.transactionCode || '—',
        h.payment.reservation.reservationCode,
        h.payment.reservation.name,
        fmtDate(jakartaDateISO(h.createdAt)),
        new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta', hour12: false }).format(h.createdAt),
        TYPE_LABEL[h.type] ?? h.type,
        fmtRupiah(h.amount),
        paymentDisplayLabel(h.payment.paymentStatus, h.payment.paymentMethod),
      ]),
    });
  }

  // ================= LAPORAN GUIDE & HONOR GUIDE =================
  // (sumber sama: GuideAssignment; kolom & ringkasan berbeda)
  const where: any = { assignmentStatus: { not: 'DIBATALKAN' } };
  if (from) where.assignmentDate = { ...(where.assignmentDate || {}), gte: from };
  if (to) where.assignmentDate = { ...(where.assignmentDate || {}), lte: to };
  if (scheduleDate) where.assignmentDate = scheduleDate;
  if (guideId) where.guideId = guideId;

  const assignments = await db.guideAssignment.findMany({
    where,
    include: { guide: true, group: true },
    orderBy: [{ assignmentDate: 'asc' }, { startTime: 'asc' }],
    take: 1000,
  });
  const filtered = status
    ? assignments.filter((a) => (type === 'honor' ? a.paymentStatus === status : a.assignmentStatus === status))
    : assignments;

  if (type === 'guides') {
    const columns: ReportColumn[] = [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'guide', label: 'Guide' },
      { key: 'date', label: 'Tanggal', align: 'center' },
      { key: 'time', label: 'Jam', align: 'center' },
      { key: 'code', label: 'Group Code' },
      { key: 'pax', label: 'Jml Peserta', align: 'center' },
      { key: 'status', label: 'Status Penugasan' },
      { key: 'honor', label: 'Honor', align: 'right' },
      { key: 'honorStatus', label: 'Status Honor' },
    ];
    return Response.json({
      ...base,
      title: 'Laporan Guide',
      orientation: 'landscape',
      fileName: `laporan-guide${from && to ? `_${from}_sd_${to}` : ''}`,
      summary: [
        { label: 'Total Penugasan', value: String(filtered.length) },
        { label: 'Peserta Didampingi', value: `${filtered.reduce((s, a) => s + a.participantCount, 0)} org` },
        { label: 'Guide Unik', value: String(new Set(filtered.map((a) => a.guideId)).size) },
        { label: 'Selesai', value: String(filtered.filter((a) => a.assignmentStatus === 'SELESAI').length) },
        { label: 'Sedang Bertugas', value: String(filtered.filter((a) => a.assignmentStatus === 'DITUGASKAN').length) },
        { label: 'Total Honor', value: fmtRupiah(filtered.reduce((s, a) => s + a.rate, 0)) },
      ],
      columns,
      rows: filtered.map((a, i) => [
        String(i + 1),
        `${a.guide.name} (${a.guide.guideCode})`,
        fmtDate(a.assignmentDate),
        a.startTime,
        a.group.groupCode,
        String(a.participantCount),
        ASSIGNMENT_STATUS_LABEL[a.assignmentStatus] ?? a.assignmentStatus,
        fmtRupiah(a.rate),
        HONOR_STATUS_LABEL[a.paymentStatus] ?? a.paymentStatus,
      ]),
    });
  }

  // honor
  const totalHonor = filtered.reduce((s, a) => s + a.rate, 0);
  const paidHonor = filtered.filter((a) => a.paymentStatus === 'SUDAH_DIBAYARKAN').reduce((s, a) => s + a.rate, 0);
  const columns: ReportColumn[] = [
    { key: 'no', label: 'No', align: 'center' },
    { key: 'guide', label: 'Guide' },
    { key: 'date', label: 'Tanggal', align: 'center' },
    { key: 'code', label: 'Group Code' },
    { key: 'pax', label: 'Jml Peserta', align: 'center' },
    { key: 'honor', label: 'Honor', align: 'right' },
    { key: 'honorStatus', label: 'Status Honor' },
  ];
  return Response.json({
    ...base,
    title: 'Laporan Honor Guide',
    orientation: 'portrait',
    fileName: `laporan-honor-guide${from && to ? `_${from}_sd_${to}` : ''}`,
    summary: [
      { label: 'Total Penugasan', value: String(filtered.length) },
      { label: 'Total Honor', value: fmtRupiah(totalHonor) },
      { label: 'Belum Dibayar', value: fmtRupiah(totalHonor - paidHonor) },
      { label: 'Sudah Dibayar', value: fmtRupiah(paidHonor) },
    ],
    columns,
    rows: filtered.map((a, i) => [
      String(i + 1),
      `${a.guide.name} (${a.guide.guideCode})`,
      fmtDate(a.assignmentDate),
      a.group.groupCode,
      String(a.participantCount),
      fmtRupiah(a.rate),
      HONOR_STATUS_LABEL[a.paymentStatus] ?? a.paymentStatus,
    ]),
    totals: [{ label: 'TOTAL HONOR', value: fmtRupiah(totalHonor) }],
  });
}
