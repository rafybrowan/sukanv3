// ===== Generator PDF per jenis laporan (konfigurasi kolom + entry point) =====
// Struktur modular: reportTemplate.ts = template dasar reusable;
// file ini = konfigurasi lebar kolom per laporan + fungsi unduh/cetak.
import { buildReportDoc, type PDFReportPayload, type ReportConfig } from './reportTemplate';

/** Konfigurasi lebar kolom (persentase lebar pakai) per jenis laporan. */
export const REPORT_CONFIG: Record<string, ReportConfig> = {
  reservations: {
    columnStyles: {
      no: { cellWidth: '4%', halign: 'center' },
      code: { cellWidth: '11%' },
      date: { cellWidth: '9%', halign: 'center' },
      time: { cellWidth: '5%', halign: 'center' },
      name: { cellWidth: '15%' },
      phone: { cellWidth: '12%' },
      pax: { cellWidth: '7%', halign: 'center' },
      resStatus: { cellWidth: '12%' },
      payStatus: { cellWidth: '11%' },
      paid: { cellWidth: '14%', halign: 'right' },
    },
  },
  grouping: {
    columnStyles: {
      no: { cellWidth: '4%', halign: 'center' },
      code: { cellWidth: '9%' },
      date: { cellWidth: '9%', halign: 'center' },
      time: { cellWidth: '5%', halign: 'center' },
      pax: { cellWidth: '6.5%', halign: 'center' },
      prog: { cellWidth: '11%', halign: 'center' },
      cond: { cellWidth: '8%', halign: 'center' },
      guide: { cellWidth: '17%' },
      guideStatus: { cellWidth: '14.5%', halign: 'center' },
      pay: { cellWidth: '16%', halign: 'center' },
    },
  },
  participants: {
    columnStyles: {
      no: { cellWidth: '5%', halign: 'center' },
      code: { cellWidth: '15%' },
      date: { cellWidth: '13%', halign: 'center' },
      time: { cellWidth: '8%', halign: 'center' },
      name: { cellWidth: '22%' },
      phone: { cellWidth: '16%' },
      pax: { cellWidth: '9%', halign: 'center' },
      resStatus: { cellWidth: '12%' },
    },
  },
  payments: {
    columnStyles: {
      no: { cellWidth: '4%', halign: 'center' },
      trx: { cellWidth: '13%' },
      code: { cellWidth: '12%' },
      name: { cellWidth: '15%' },
      date: { cellWidth: '10%', halign: 'center' },
      time: { cellWidth: '6%', halign: 'center' },
      jenis: { cellWidth: '14%' },
      amount: { cellWidth: '12%', halign: 'right' },
      status: { cellWidth: '14%' },
    },
  },
  guides: {
    columnStyles: {
      no: { cellWidth: '4%', halign: 'center' },
      guide: { cellWidth: '18%' },
      date: { cellWidth: '10%', halign: 'center' },
      time: { cellWidth: '6%', halign: 'center' },
      code: { cellWidth: '10%' },
      pax: { cellWidth: '8%', halign: 'center' },
      status: { cellWidth: '14%', halign: 'center' },
      honor: { cellWidth: '12%', halign: 'right' },
      honorStatus: { cellWidth: '18%', halign: 'center' },
    },
  },
  honor: {
    columnStyles: {
      no: { cellWidth: '5%', halign: 'center' },
      guide: { cellWidth: '22%' },
      date: { cellWidth: '13%', halign: 'center' },
      code: { cellWidth: '12%' },
      pax: { cellWidth: '9%', halign: 'center' },
      honor: { cellWidth: '15%', halign: 'right' },
      honorStatus: { cellWidth: '24%', halign: 'center' },
    },
  },
};

/** Bangun dokumen PDF laporan (tanpa memicu unduhan — untuk preview/blob). */
export function generateReportDoc(payload: PDFReportPayload) {
  return buildReportDoc(payload, REPORT_CONFIG[payload.type] ?? {});
}

/** Bangun + unduh file PDF laporan. */
export function downloadReportPDF(payload: PDFReportPayload): void {
  const doc = generateReportDoc(payload);
  doc.save(`${payload.fileName}.pdf`);
}

/** Bangun + cetak PDF (buka dialog cetak browser). */
export function printReportPDF(payload: PDFReportPayload): void {
  const doc = generateReportDoc(payload);
  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // popup diblokir — fallback unduh
    doc.save(`${payload.fileName}.pdf`);
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export type { PDFReportPayload } from './reportTemplate';
