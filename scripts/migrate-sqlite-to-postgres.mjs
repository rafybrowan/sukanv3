/**
 * ============================================================
 * SUKAN RIVER TUBING — Migrasi Data SQLite → PostgreSQL
 * ============================================================
 *
 * Mentransfer SELURUH data (Admin, Setting, Schedule, Reservation,
 * Payment, PaymentHistory, Group, GroupMember, ChangeRequest, Guide,
 * GuideAssignment, GroupStatusHistory) dari database SQLite lokal
 * ke database PostgreSQL produksi — termasuk ID relasi antar tabel,
 * sehingga tidak ada data yang hilang atau berubah relasinya.
 *
 * Cara pakai (2 langkah, jalankan berurutan):
 *
 * LANGKAH 1 — EXPORT (saat schema.prisma masih "sqlite"):
 *   DATABASE_URL="file:../db/custom.db" npx tsx scripts/migrate-sqlite-to-postgres.mjs export
 *   → menghasilkan file data-export-sukan-river-tubing.json
 *
 * LANGKAH 2 — IMPORT (setelah provider schema.prisma diubah ke
 *   "postgresql", DATABASE_URL menunjuk ke PostgreSQL):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/migrate-sqlite-to-postgres.mjs import
 *
 * Import aman dijalankan berulang (upsert by id, tidak menduplikasi).
 */

import { readFileSync, writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EXPORT_FILE = 'data-export-sukan-river-tubing.json';

// Urutan insert mengikuti ketergantungan relasi
const TABLES = [
  'admin',
  'setting',
  'schedule',
  'guide',
  'reservation',
  'payment',
  'paymentHistory',
  'group',
  'groupMember',
  'changeRequest',
  'guideAssignment',
  'groupStatusHistory',
];

const modelMap = {
  admin: () => db.admin,
  setting: () => db.setting,
  schedule: () => db.schedule,
  guide: () => db.guide,
  reservation: () => db.reservation,
  payment: () => db.payment,
  paymentHistory: () => db.paymentHistory,
  group: () => db.group,
  groupMember: () => db.groupMember,
  changeRequest: () => db.changeRequest,
  guideAssignment: () => db.guideAssignment,
  groupStatusHistory: () => db.groupStatusHistory,
};

async function exportData() {
  const data = {};
  for (const t of TABLES) {
    const rows = await modelMap[t]().findMany();
    data[t] = rows;
    console.log(`  export ${t}: ${rows.length} baris`);
  }
  writeFileSync(EXPORT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  const total = Object.values(data).reduce((s, a) => s + a.length, 0);
  console.log(`\n✅ ${total} baris tersimpan ke ${EXPORT_FILE}`);
  console.log('   Simpan file ini, lalu lanjut ke LANGKAH 2 (import).');
}

async function importData() {
  const raw = readFileSync(EXPORT_FILE, 'utf-8');
  const data = JSON.parse(raw);
  let inserted = 0;
  let skipped = 0;
  for (const t of TABLES) {
    const rows = data[t] || [];
    for (const row of rows) {
      const exists = await modelMap[t]().findUnique({ where: { id: row.id } });
      if (exists) {
        skipped++;
        continue;
      }
      // buang field relasi (objek include) — hanya kolom skalar yang dikirim
      const scalar = {};
      for (const [k, v] of Object.entries(row)) {
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v) || v instanceof Date) {
          scalar[k] = v;
        }
      }
      await modelMap[t]().create({ data: scalar });
      inserted++;
    }
    console.log(`  import ${t}: ${rows.length} baris (total proses)`);
  }
  console.log(`\n✅ Selesai — ${inserted} baris dibuat, ${skipped} dilewati (sudah ada).`);
}

const cmd = process.argv[2];
if (cmd === 'export') {
  exportData().catch((e) => { console.error('❌ Export gagal:', e); process.exit(1); }).finally(() => db.$disconnect());
} else if (cmd === 'import') {
  importData().catch((e) => { console.error('❌ Import gagal:', e); process.exit(1); }).finally(() => db.$disconnect());
} else {
  console.log('Pemakaian: npx tsx scripts/migrate-sqlite-to-postgres.mjs <export|import>');
  process.exit(1);
}
