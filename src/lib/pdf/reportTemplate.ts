// ===== Template dasar PDF laporan Sukan River Tubing =====
// Satu template reusable untuk semua jenis laporan (spec: renderHeader, renderFooter,
// renderReportTitle, renderSummary, renderTable, renderPageNumber).
// A4 · margin konsisten · header & footer di setiap halaman · nomor halaman otomatis.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTimeID } from '@/lib/format';

export interface PDFReportPayload {
  type: string;
  title: string;
  periodeLabel: string;
  generatedAt: string;
  summary: { label: string; value: string }[];
  columns: { key: string; label: string; align?: 'left' | 'center' | 'right' }[];
  rows: string[][];
  totals?: { label: string; value: string }[];
  notes: string[];
  orientation: 'portrait' | 'landscape';
  fileName: string;
}

export interface ReportColumnStyle {
  cellWidth?: string; // mis. "10%"
  halign?: 'left' | 'center' | 'right';
}

export interface ReportConfig {
  columnStyles?: Record<string, ReportColumnStyle>;
}

type RGB = [number, number, number];
const rgb = (r: number, g: number, b: number): RGB => [r, g, b];

const C = {
  band: rgb(15, 74, 48),          // hijau tua brand
  bandTextSoft: rgb(214, 236, 224),
  tableHead: rgb(21, 106, 64),     // hijau tabel
  summaryFill: rgb(240, 249, 244),
  summaryBorder: rgb(187, 219, 200),
  text: rgb(33, 43, 36),
  muted: rgb(98, 112, 103),
  line: rgb(206, 216, 208),
  stripe: rgb(243, 249, 245),
};

const M = { left: 12, right: 12, top: 30, bottom: 20 };
const BAND_H = 20;

/** Header band brand + judul laporan + periode (diulang di setiap halaman). */
function renderHeader(doc: jsPDF, payload: PDFReportPayload): void {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.band);
  doc.rect(0, 0, w, BAND_H, 'F');
  // garis aksen tipis
  doc.setFillColor(120, 200, 160);
  doc.rect(0, BAND_H - 1.2, w, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('SUKAN RIVER TUBING', M.left, 8.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.bandTextSoft);
  doc.text('Sistem Informasi Reservasi · Desa Panembangan, Kec. Cilongok, Kab. Banyumas', M.left, 14.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(payload.title.toUpperCase(), w - M.right, 8.6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.bandTextSoft);
  doc.text(payload.periodeLabel, w - M.right, 14.2, { align: 'right' });
}

/** Blok judul + tanggal cetak (halaman 1). Return posisi Y setelah blok. */
function renderReportTitle(doc: jsPDF, payload: PDFReportPayload): number {
  const w = doc.internal.pageSize.getWidth();
  let y = BAND_H + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.text);
  doc.text(payload.title, M.left, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Periode: ${payload.periodeLabel}`, M.left, y + 5.5);
  doc.text(`Tanggal Cetak: ${formatDateTimeID(payload.generatedAt)}`, w - M.right, y + 5.5, { align: 'right' });
  return y + 11;
}

/** Kotak ringkasan (grid 3 kolom). Return posisi Y setelah ringkasan. */
function renderSummary(doc: jsPDF, payload: PDFReportPayload, startY: number): number {
  if (payload.summary.length === 0) return startY;
  const w = doc.internal.pageSize.getWidth();
  const usable = w - M.left - M.right;
  const cols = 3;
  const gap = 4;
  const boxW = (usable - gap * (cols - 1)) / cols;
  const boxH = 13.5;
  let y = startY;
  let x = M.left;
  let col = 0;
  for (const item of payload.summary) {
    doc.setFillColor(...C.summaryFill);
    doc.setDrawColor(...C.summaryBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...C.muted);
    doc.text(item.label.toUpperCase(), x + 3, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    doc.text(item.value, x + 3, y + 10.3);
    col += 1;
    x += boxW + gap;
    if (col === cols) {
      col = 0;
      x = M.left;
      y += boxH + gap;
    }
  }
  if (col !== 0) y += boxH + gap; // baris terakhir belum dihitung
  return y + 2;
}

/** Bangun tabel via autoTable (header tabel otomatis diulang tiap halaman). */
function renderTable(doc: jsPDF, payload: PDFReportPayload, startY: number, config: ReportConfig): void {
  const columnStyles: Record<number, any> = {};
  payload.columns.forEach((col, idx) => {
    const cfg = config.columnStyles?.[col.key] ?? {};
    columnStyles[idx] = {
      halign: cfg.halign ?? col.align ?? 'left',
      ...(cfg.cellWidth ? { cellWidth: cfg.cellWidth } : {}),
    };
  });

  autoTable(doc, {
    head: [payload.columns.map((c) => c.label)],
    body: payload.rows,
    startY,
    margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      textColor: C.text,
      lineColor: C.line,
      lineWidth: 0.15,
      cellPadding: { top: 1.7, bottom: 1.7, left: 1.6, right: 1.6 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: C.tableHead,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7.4,
      halign: 'center',
      lineColor: C.tableHead,
      lineWidth: 0.15,
      cellPadding: { top: 2.1, bottom: 2.1, left: 1.6, right: 1.6 },
    },
    alternateRowStyles: { fillColor: C.stripe },
    columnStyles,
    didDrawPage: () => renderHeader(doc, payload),
  });
}

/** Blok total (mis. TOTAL HONOR) di bawah tabel. */
function renderTotals(doc: jsPDF, payload: PDFReportPayload, y: number): number {
  if (!payload.totals || payload.totals.length === 0) return y;
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let cur = y;
  if (cur > pageH - M.bottom - 22) {
    doc.addPage();
    renderHeader(doc, payload);
    cur = M.top;
  }
  cur += 3;
  for (const t of payload.totals) {
    const labelW = 34;
    const valueW = 40;
    const boxW = labelW + valueW;
    const x = w - M.right - boxW;
    doc.setFillColor(...C.tableHead);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.rect(x, cur, labelW, 9, 'F');
    doc.text(t.label, x + 2.5, cur + 6);
    doc.setFillColor(...C.summaryFill);
    doc.setDrawColor(...C.summaryBorder);
    doc.setLineWidth(0.25);
    doc.rect(x + labelW, cur, valueW, 9, 'FD');
    doc.setTextColor(...C.text);
    doc.setFontSize(9.5);
    doc.text(t.value, x + labelW + valueW - 2.5, cur + 6.1, { align: 'right' });
    cur += 11;
  }
  return cur + 2;
}

/** Bagian Keterangan / Catatan. */
function renderNotes(doc: jsPDF, payload: PDFReportPayload, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let cur = y + 4;
  if (cur > pageH - M.bottom - 24) {
    doc.addPage();
    renderHeader(doc, payload);
    cur = M.top + 2;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('KETERANGAN / CATATAN', M.left, cur);
  cur += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const maxW = w - M.left - M.right;
  for (const note of payload.notes) {
    const lines = doc.splitTextToSize(`• ${note}`, maxW);
    if (cur + lines.length * 3.4 > pageH - M.bottom) {
      doc.addPage();
      renderHeader(doc, payload);
      cur = M.top + 2;
    }
    doc.setTextColor(...C.muted);
    doc.text(lines, M.left, cur);
    cur += lines.length * 3.4 + 1;
  }
  return cur;
}

/** Footer di setiap halaman: brand, tanggal cetak, Halaman X dari Y (total pasti). */
function renderFooter(doc: jsPDF, payload: PDFReportPayload): void {
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    const y = pageH - 13;
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.25);
    doc.line(M.left, y - 4.5, w - M.right, y - 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...C.muted);
    doc.text('Sukan River Tubing — Laporan Sistem Informasi Reservasi', M.left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak: ${formatDateTimeID(payload.generatedAt)}`, w / 2, y, { align: 'center' });
    doc.text(`Halaman ${i} dari ${total}`, w - M.right, y, { align: 'right' });
  }
}

/**
 * Bangun dokumen PDF laporan dari payload siap-tampil (lihat /api/admin/reports/data).
 * Struktur: header band -> judul & tanggal cetak -> ringkasan -> tabel (multi-halaman,
 * header tabel diulang) -> total -> keterangan -> footer + nomor halaman.
 */
export function buildReportDoc(payload: PDFReportPayload, config: ReportConfig = {}): jsPDF {
  const doc = new jsPDF({
    orientation: payload.orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  renderHeader(doc, payload);
  let y = renderReportTitle(doc, payload);
  y = renderSummary(doc, payload, y);
  renderTable(doc, payload, y + 2, config);

  let finalY = (doc as any).lastAutoTable?.finalY ?? y;
  finalY = renderTotals(doc, payload, finalY);
  renderNotes(doc, payload, finalY);
  renderFooter(doc, payload);
  return doc;
}
