/**
 * SUKAN RIVER TUBING - Seed Data
 * Menghasilkan data demo realistis relatif terhadap tanggal hari ini (Asia/Jakarta)
 * Jalankan: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'crypto';

const db = new PrismaClient();

const PRICE = 25000; // Rp per orang

// ---------- helpers ----------
function jakartaToday(): Date {
  const now = new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(s + 'T00:00:00Z');
}
function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function yyddmm(dateStr: string): string {
  // 2026-09-27 -> 260927
  return dateStr.slice(2, 4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
}
function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pw, salt, 64).toString('hex');
}
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// hitung urutan kode per tanggal
const codeCounters: Record<string, number> = {};
function nextCode(dateStr: string, prefix: 'SRT' | 'PAY'): string {
  const key = prefix + dateStr;
  codeCounters[key] = (codeCounters[key] || 0) + 1;
  return `${prefix}-${yyddmm(dateStr)}-${String(codeCounters[key]).padStart(3, '0')}`;
}

type GroupingOption = 'WAIT_GROUP' | 'DEPART_NOW' | 'COMPLETE';
type PayMethod = 'FULL_PAYMENT' | 'ONSITE';

interface SeedRes {
  day: number; // offset hari dari hari ini
  time: string;
  name: string;
  phone: string;
  email?: string;
  count: number;
  option: GroupingOption;
  method: PayMethod;
  // overrides
  paidOnline?: boolean; // apakah pembayaran online sudah dilakukan (default true utk FULL/DP)
  status?: 'MENUNGGU_PEMBAYARAN' | 'TERKONFIRMASI' | 'SELESAI' | 'DIBATALKAN';
  actual?: number | null;
  groupStatus?: string;
  createdAtDaysAgo?: number; // untuk simulasi waktu dibuat
  groupCode?: string; // jika sudah masuk kelompok
}

async function main() {
  console.log('🌱 Seeding Sukan River Tubing...');
  await db.$transaction([
    db.changeRequest.deleteMany(),
    db.paymentHistory.deleteMany(),
    db.payment.deleteMany(),
    db.groupMember.deleteMany(),
    db.group.deleteMany(),
    db.reservation.deleteMany(),
    db.schedule.deleteMany(),
    db.setting.deleteMany(),
    db.admin.deleteMany(),
  ]);

  // ---------- admin & settings ----------
  await db.admin.create({
    data: {
      email: 'admin@sukanrivertubing.com',
      password: hashPassword('admin123'),
      name: 'Admin Sukan',
    },
  });
  const settings = [
    { key: 'pricePerPerson', value: String(PRICE) },
    { key: 'idealGroupSize', value: '7' },
    { key: 'location', value: 'Desa Panembangan, Kec. Cilongok, Kab. Banyumas' },
  ];
  for (const s of settings) await db.setting.create({ data: s });

  const today = jakartaToday();
  console.log('Hari ini (Jakarta):', fmt(today));

  // ---------- schedules: d-6 .. d+21 ----------
  const weekendTimes = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'];
  const weekdayTimes = ['09:00', '11:00', '13:00'];
  const scheduleIds: Record<string, string> = {}; // key: `${date} ${time}`
  for (let i = -6; i <= 21; i++) {
    const d = addDays(today, i);
    const times = isWeekend(d) ? weekendTimes : weekdayTimes;
    for (const t of times) {
      const sch = await db.schedule.create({
        data: { date: fmt(d), time: t, capacity: isWeekend(d) ? 60 : 45, status: 'AKTIF' },
      });
      scheduleIds[`${fmt(d)} ${t}`] = sch.id;
    }
  }
  // jadwal khusus untuk demo status
  await db.schedule.update({ where: { date_time: { date: fmt(addDays(today, 2)), time: '13:00' } }, data: { status: 'DITUTUP' } });
  await db.schedule.update({ where: { date_time: { date: fmt(addDays(today, 3)), time: '09:00' } }, data: { status: 'DITUNDA' } });

  // ---------- reservations ----------
  const reservations: SeedRes[] = [];

  // === MASA LALU (SELESAI) — untuk grafik & laporan ===
  const pastPeople = [
    'Agus Prasetyo', 'Bella Safira', 'Candra Wijaya', 'Dewi Lestari', 'Eko Saputra',
    'Fitri Handayani', 'Galih Nugraha', 'Hana Maulida', 'Irfan Ramadhan', 'Jihan Aulia',
    'Krisna Adi', 'Laras Ayu', 'Maulana Ibrahim', 'Nadia Rahma', 'Oscar Pratama',
    'Putri Amalia', 'Qori Ananda', 'Rizky Firmansyah', 'Salsa Nabila', 'Taufik Hidayat',
    'Umi Kalsum', 'Vino Bastian', 'Wulan Sari', 'Xena Maharani', 'Yoga Pratama', 'Zidane Putra',
  ];
  let pi = 0;
  const methods: PayMethod[] = ['FULL_PAYMENT', 'ONSITE'];
  const pastDays = [-6, -5, -4, -3, -2, -1];
  const countsPerDay = [4, 3, 5, 4, 3, 5];
  for (let di = 0; di < pastDays.length; di++) {
    const day = pastDays[di];
    const times = isWeekend(addDays(today, day)) ? ['08:00', '09:00', '10:00'] : ['09:00', '11:00'];
    for (let r = 0; r < countsPerDay[di]; r++) {
      const name = pastPeople[pi % pastPeople.length]; pi++;
      const count = [2, 3, 4, 7, 7, 2, 5, 3][pi % 8];
      const option: GroupingOption = count >= 7 ? 'COMPLETE' : 'WAIT_GROUP';
      const method = methods[pi % 3];
      const cancelled = day === -1 && r === 4; // satu pembatalan utk statistik
      reservations.push({
        day, time: times[r % times.length], name,
        phone: `0813${String(10000000 + pi * 137).slice(0, 8)}`,
        email: `${name.split(' ')[0].toLowerCase()}${pi}@gmail.com`,
        count, option, method,
        paidOnline: method !== 'ONSITE',
        status: cancelled ? 'DIBATALKAN' : 'SELESAI',
        actual: cancelled ? null : count,
        groupStatus: cancelled ? 'MENUNGGU_PENGELOMPOKAN' : option === 'COMPLETE' ? 'TERKELOMPOK' : 'TERKELOMPOK',
        createdAtDaysAgo: -day - 3,
        groupCode: cancelled ? undefined : `GRP-${String(di * 3 + Math.floor(r / 2) + 100).padStart(3, '0')}`,
      });
    }
  }

  // === HARI INI ===
  reservations.push(
    { day: 0, time: '09:00', name: 'Wawan Setiawan', phone: '081234500001', email: 'wawan@gmail.com', count: 4, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'TERKELOMPOK', groupCode: 'GRP-001', actual: 4, createdAtDaysAgo: 2 },
    { day: 0, time: '09:00', name: 'Tuti Wulandari', phone: '081234500002', email: 'tuti@gmail.com', count: 3, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'TERKELOMPOK', groupCode: 'GRP-001', actual: 5, createdAtDaysAgo: 2 }, // mismatch demo: booking 3 aktual 5
    { day: 0, time: '09:00', name: 'Yoga Permana', phone: '081234500003', email: 'yoga.p@gmail.com', count: 7, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'TERKELOMPOK', groupCode: 'GRP-003', createdAtDaysAgo: 3 },
    { day: 0, time: '09:00', name: 'Zahra Amelia', phone: '081234500004', email: 'zahra@gmail.com', count: 2, option: 'DEPART_NOW', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'SIAP_BERANGKAT', createdAtDaysAgo: 1 },
    { day: 0, time: '11:00', name: 'Rina Marlina', phone: '081234500005', email: 'rina@gmail.com', count: 3, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 1 },
    { day: 0, time: '11:00', name: 'Sinta Nuriyah', phone: '081234500006', email: 'sinta@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 1 },
    { day: 0, time: '11:00', name: 'Vina Oktaviani', phone: '081234500007', email: 'vina@gmail.com', count: 4, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: false, status: 'MENUNGGU_PEMBAYARAN', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 0, time: '13:00', name: 'Bima Arya', phone: '081234500008', email: 'bima@gmail.com', count: 7, option: 'COMPLETE', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 2 },
  );

  // === BESOK — data bintang sesuai spesifikasi (09:00 terisi 42/60) ===
  reservations.push(
    { day: 1, time: '09:00', name: 'Rafy Ramadhan', phone: '081234567890', email: 'rafy@gmail.com', count: 3, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 1, time: '09:00', name: 'Budi Santoso', phone: '081234500101', email: 'budi@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 1, time: '09:00', name: 'Andi Firmansyah', phone: '081234500102', email: 'andi@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 1, time: '09:00', name: 'Gita Savitri', phone: '081234500103', email: 'gita@gmail.com', count: 7, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 1 },
    { day: 1, time: '09:00', name: 'Hadi Purnomo', phone: '081234500104', email: 'hadi@gmail.com', count: 14, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 1 },
    { day: 1, time: '09:00', name: 'Irwan Septyanto', phone: '081234500105', email: 'irwan@gmail.com', count: 7, option: 'COMPLETE', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 2 },
    { day: 1, time: '09:00', name: 'Joko Susilo', phone: '081234500106', email: 'joko@gmail.com', count: 7, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 2 },
    // 10:00 — kelompok parsial GRP-002 (Dina 3 + Fajar 2 = 5/7) + kandidat Sari 2
    { day: 1, time: '10:00', name: 'Dina Puspita', phone: '081234500107', email: 'dina@gmail.com', count: 3, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'TERKELOMPOK', groupCode: 'GRP-002', createdAtDaysAgo: 1 },
    { day: 1, time: '10:00', name: 'Fajar Nugroho', phone: '081234500108', email: 'fajar@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'TERKELOMPOK', groupCode: 'GRP-002', createdAtDaysAgo: 1 },
    { day: 1, time: '10:00', name: 'Sari Wulandari', phone: '081234500109', email: 'sari@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
  );

  // === DUA HARI KE DEPAN ===
  reservations.push(
    { day: 2, time: '09:00', name: 'Tono Sutrisno', phone: '081234500201', email: 'tono@gmail.com', count: 5, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 2, time: '09:00', name: 'Utami Dewi', phone: '081234500202', email: 'utami@gmail.com', count: 2, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 2, time: '11:00', name: 'Vero Anggraini', phone: '081234500203', email: 'vero@gmail.com', count: 3, option: 'DEPART_NOW', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'SIAP_BERANGKAT', createdAtDaysAgo: 0 },
  );

  // === D4/D5/D6/D8 ===
  reservations.push(
    { day: 4, time: '09:00', name: 'Rani Kusuma', phone: '081234500301', email: 'rani@gmail.com', count: 6, option: 'WAIT_GROUP', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 5, time: '09:00', name: 'SMP N 1 Cilongok (Rombongan)', phone: '081234500401', email: 'smp1clok@gmail.com', count: 48, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 0 },
    { day: 5, time: '09:00', name: 'Eka Fadhli', phone: '081234500402', email: 'eka@gmail.com', count: 7, option: 'COMPLETE', method: 'FULL_PAYMENT', paidOnline: true, status: 'TERKONFIRMASI', groupStatus: 'KELOMPOK_LENGKAP', createdAtDaysAgo: 0 },
    { day: 6, time: '09:00', name: 'Farhan Maulana', phone: '081234500501', email: 'farhan@gmail.com', count: 4, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
    { day: 8, time: '11:00', name: 'Gina Pratiwi', phone: '081234500601', email: 'gina@gmail.com', count: 3, option: 'WAIT_GROUP', method: 'ONSITE', status: 'TERKONFIRMASI', groupStatus: 'MENUNGGU_PENGELOMPOKAN', createdAtDaysAgo: 0 },
  );

  // ---------- buat reservasi + pembayaran ----------
  const groupMembers: { groupCode: string; reservationCode: string; count: number; scheduleKey: string }[] = [];
  const resIds: Record<string, { id: string; scheduleKey: string }> = {};

  for (const r of reservations) {
    const dateStr = fmt(addDays(today, r.day));
    const scheduleKey = `${dateStr} ${r.time}`;
    const scheduleId = scheduleIds[scheduleKey];
    if (!scheduleId) { console.warn('!! jadwal tidak ditemukan:', scheduleKey); continue; }

    const payCount = r.option === 'DEPART_NOW' ? 7 : r.count;
    const total = payCount * PRICE;
    const code = nextCode(dateStr, 'SRT');

    let reservationStatus = r.status ?? 'TERKONFIRMASI';
    let groupStatus = r.groupStatus ?? (r.option === 'COMPLETE' ? 'KELOMPOK_LENGKAP' : r.option === 'DEPART_NOW' ? 'SIAP_BERANGKAT' : 'MENUNGGU_PENGELOMPOKAN');
    if (r.status === 'DIBATALKAN') { groupStatus = r.groupStatus ?? 'MENUNGGU_PENGELOMPOKAN'; }

    const created = new Date(Date.now() - (r.createdAtDaysAgo ?? 0) * 86400000 - 3600000 * 3);

    const res = await db.reservation.create({
      data: {
        reservationCode: code,
        scheduleId,
        name: r.name,
        phone: r.phone,
        email: r.email,
        participantCount: r.count,
        paymentParticipantCount: payCount,
        groupingOption: r.option,
        reservationStatus,
        groupingStatus: groupStatus,
        totalPrice: total,
        actualParticipantCount: r.actual ?? null,
        createdAt: created,
      },
    });
    resIds[code] = { id: res.id, scheduleKey };

    // payment — dua metode: FULL_PAYMENT (Lunas) & ONSITE (Bayar di Tempat).
    // Keduanya dimulai dari UNPAID (Belum Bayar); Bayar di Tempat TIDAK dianggap sudah membayar.
    let amountPaid = 0;
    let paymentStatus = 'UNPAID';
    let remaining = total;
    if (reservationStatus === 'DIBATALKAN') {
      paymentStatus = 'CANCELLED' as string; // info saja, tidak dipakai di UI utk masa lalu
      amountPaid = 0; remaining = 0;
    } else if (r.method === 'ONSITE') {
      paymentStatus = 'UNPAID';
      if (reservationStatus === 'SELESAI') { amountPaid = total; remaining = 0; paymentStatus = 'PAID'; }
    } else if (r.paidOnline === false) {
      paymentStatus = 'UNPAID'; // metode Lunas, menunggu pembayaran online
    } else {
      amountPaid = total; remaining = 0; paymentStatus = 'PAID';
    }

    const payCode = nextCode(dateStr, 'PAY');
    const payment = await db.payment.create({
      data: {
        reservationId: res.id,
        paymentMethod: r.method,
        totalAmount: total,
        amountPaid,
        remainingAmount: remaining,
        paymentStatus,
        transactionCode: amountPaid > 0 ? payCode : null,
        paidAt: amountPaid > 0 ? created : null,
      },
    });

    // riwayat pembayaran
    if (paymentStatus === 'PAID' && r.method === 'FULL_PAYMENT') {
      await db.paymentHistory.create({ data: { paymentId: payment.id, amount: total, type: 'FULL', transactionCode: payCode, createdAt: created } });
    } else if (r.method === 'ONSITE' && paymentStatus === 'PAID') {
      await db.paymentHistory.create({ data: { paymentId: payment.id, amount: total, type: 'ONSITE', transactionCode: payCode, note: 'Dibayar di lokasi', createdAt: new Date(created.getTime() + 86400000) } });
    }

    if (r.groupCode) groupMembers.push({ groupCode: r.groupCode, reservationCode: code, count: r.count, scheduleKey });
  }

  // ---------- groups ----------
  const createdGroups = new Set<string>();
  for (const gm of groupMembers) {
    if (!createdGroups.has(gm.groupCode)) {
      // total anggota kelompok ini
      const members = groupMembers.filter((x) => x.groupCode === gm.groupCode);
      const totalP = members.reduce((s, x) => s + x.count, 0);
      await db.group.create({
        data: {
          groupCode: gm.groupCode,
          scheduleId: scheduleIds[gm.scheduleKey],
          status: totalP >= 7 ? 'LENGKAP' : 'MENUNGGU',
        },
      });
      createdGroups.add(gm.groupCode);
    }
    const grp = await db.group.findUnique({ where: { groupCode: gm.groupCode } });
    await db.groupMember.create({
      data: { groupId: grp!.id, reservationId: resIds[gm.reservationCode].id, participantCount: gm.count },
    });
  }

  // ---------- change requests ----------
  const rafy = await db.reservation.findFirst({ where: { name: 'Rafy Ramadhan' } });
  if (rafy) {
    await db.changeRequest.create({
      data: {
        reservationId: rafy.id,
        type: 'PARTICIPANTS',
        requestedChange: 'Menambah 1 peserta menjadi 4 orang (ada teman yang ikut)',
        reason: 'Teman kami baru memutuskan ikut setelah tahu jadwalnya cocok',
        status: 'PENDING',
      },
    });
  }
  const tuti = await db.reservation.findFirst({ where: { name: 'Tuti Wulandari' } });
  if (tuti) {
    await db.changeRequest.create({
      data: {
        reservationId: tuti.id,
        type: 'OTHER',
        requestedChange: 'Meminta life jacket ukuran anak-anak',
        reason: 'Ada 2 anak usia 9 tahun dalam rombongan',
        status: 'APPROVED',
        adminNote: 'Disiapkan di lokasi keberangkatan',
      },
    });
  }

  const totals = {
    schedules: await db.schedule.count(),
    reservations: await db.reservation.count(),
    payments: await db.payment.count(),
    groups: await db.group.count(),
  };
  console.log('✅ Seed selesai:', totals);

  // tampilkan info demo
  const rafyCode = await db.reservation.findFirst({ where: { name: 'Rafy Ramadhan' }, select: { reservationCode: true } });
  console.log('🔑 Login admin: admin@sukanrivertubing.com / admin123');
  console.log('🎫 Demo cek reservasi:', rafyCode?.reservationCode, '/ 081234567890');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
