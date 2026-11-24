# Sukan River Tubing — Sistem Reservasi Online

Website reservasi resmi **Sukan River Tubing** — petualangan menyusuri aliran Sungai Sukan, Desa Panembangan, Cilongok, Banyumas. Aplikasi full-stack berisi:

- **Halaman pengguna**: landing page, jadwal & kapasitas, wizard reservasi 9 langkah, payment gateway simulasi (VA/QRIS/kartu), cek reservasi, detail reservasi, pengajuan perubahan.
- **Dashboard admin**: statistik & grafik, manajemen reservasi, jadwal, kapasitas, pengelompokan peserta (algoritma kelompok 7 orang), konfirmasi peserta, pembayaran (DP & pelunasan), laporan (CSV + print), pengaturan, manajemen pemandu & honor.

## Teknologi

| Komponen | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router, output standalone) |
| UI | React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM 6 + SQLite (opsi PostgreSQL untuk serverless) |
| Autentikasi | Cookie sesi HMAC + password scrypt (custom, tanpa dependency eksternal) |
| Font | Plus Jakarta Sans (via `next/font`) |

> Semua halaman pengguna & admin disajikan melalui SPA hash-router dari `src/app/page.tsx` (`#/jadwal`, `#/reservasi`, `#/admin/login`, dst).

## Struktur Project

```
├── prisma/
│   ├── schema.prisma        # Skema database (11 model)
│   └── seed.ts              # Data demo (jadwal, reservasi, kelompok, pemandu)
├── public/images/           # Aset foto website (hero, galeri, banner)
├── src/
│   ├── app/                 # Layout + API routes (reservasi, admin, payment, dll)
│   ├── components/          # Komponen UI (user, admin, shadcn/ui)
│   ├── hooks/               # React hooks
│   └── lib/                 # db, auth, api-client, helpers
├── scripts/
│   └── migrate-sqlite-to-postgres.mjs   # Migrasi data SQLite → PostgreSQL
├── railway.toml             # Konfigurasi deployment Railway
├── Dockerfile               # Opsi deployment Docker (VPS/Fly.io/Coolify)
└── .env.example             # Contoh environment variables
```

## Menjalankan Secara Lokal

Prasyarat: **Node.js ≥ 20.9** dan npm.

```bash
# 1. Instal dependency (otomatis menjalankan prisma generate)
npm install

# 2. Siapkan environment
cp .env.example .env

# 3. Buat/mutakhirkan skema database SQLite
npx prisma db push

# 4. (Opsional) Isi data demo — login admin + jadwal + reservasi + pemandu
npm run db:seed

# 5. Mode pengembangan
npm run dev            # http://localhost:3000

# — atau mode produksi —
npm run build
npm run start          # melayani .next/standalone/server.js
```

> Catatan Windows: script `build` memakai perintah `cp` — jalankan melalui WSL/Git Bash, atau gunakan `npx next build` lalu salin manual `.next/static` dan `public` ke `.next/standalone/`.

## Environment Variables

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Ya | SQLite: `file:../db/custom.db` (lokal) / `file:/data/custom.db` (Railway volume). PostgreSQL: connection string. |
| `ADMIN_SESSION_SECRET` | Disarankan | Secret HMAC sesi admin. Generate dengan `openssl rand -hex 32`. Jika kosong dipakai secret bawaan (hanya untuk pengembangan). |

Tidak ada variabel lain yang dibutuhkan. Salin `.env.example` → `.env` dan jangan pernah commit `.env` asli.

## Akun Demo (dibuat oleh seed)

- **Admin**: `admin@sukanrivertubing.com` / `admin123` — **ganti sebelum dipakai sungguhan**.
- **Cek reservasi demo**: `SRT-260927-001` / `081234567890` (data dihasilkan relatif terhadap tanggal seed).

Untuk mengganti password admin produksi, gunakan Prisma Studio (`npx prisma studio`) pada database produksi dan perbarui kolom `password` Admin dengan hash baru (format `salt:hash` scrypt, dapat dibuat dengan fungsi `hashPassword` di `src/lib/auth.ts`).

## Deployment ke Railway (disarankan)

Railway dipilih karena mendukung **Next.js full-stack** (API routes + SSR), **volume persisten** untuk SQLite (tanpa migrasi database), environment variables, dan **auto-deploy dari GitHub**.

1. **Push repository ini ke GitHub** (lihat riwayat commit di bawah).
2. Login ke [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pilih `sukan-river-tubing`.
3. Railway otomatis membaca `railway.toml`: build `npx prisma generate && npm run build`, start `npx prisma db push --skip-generate && node .next/standalone/server.js`.
4. Buka service → tab **Variables**, tambahkan:
   - `DATABASE_URL` = `file:/data/custom.db`
   - `ADMIN_SESSION_SECRET` = string acak (mis. hasil `openssl rand -hex 32`)
5. Tab **Settings** → **Volumes** → **+ New Volume** → **Mount path**: `/data` → Add (untuk penyimpanan SQLite yang persisten).
6. **Deploy pertama**: setelah sukses, isi data demo dengan mengubah sementara `startCommand` di Railway (Settings → Deploy → Custom Start Command) menjadi:
   ```
   npx prisma db push --skip-generate && npx tsx prisma/seed.ts && node .next/standalone/server.js
   ```
   lalu **Redeploy**. Setelah seed sukses, kembalikan startCommand ke nilai semula (agar data tidak di-seed ulang setiap boot).
7. Tab **Settings** → **Networking** → **Generate Domain** → website online di URL Railway.
8. **Auto-deploy**: setiap push ke branch `main` otomatis memicu deployment baru (aktif secara default di tab Settings → Deployments).

### Alternatif: Vercel + Neon PostgreSQL (untuk hosting serverless gratis)

Filesystem Vercel bersifat ephemeral sehingga **SQLite tidak dapat menyimpan data secara persisten** di sana. Jika memilih Vercel, gunakan PostgreSQL (mis. [Neon](https://neon.tech) free tier):

1. Buat database di Neon → salin connection string.
2. Ubah satu baris di `prisma/schema.prisma`: `provider = "sqlite"` → `provider = "postgresql"`.
3. Push ke GitHub → import repo di Vercel → set Environment Variables:
   - `DATABASE_URL` = connection string Neon
   - `ADMIN_SESSION_SECRET` = string acak
4. Buat skema + data dari komputer lokal:
   ```bash
   # sebelum mengubah provider: export data SQLite lama (opsional)
   DATABASE_URL="file:../db/custom.db" npx tsx scripts/migrate-sqlite-to-postgres.mjs export
   # setelah mengubah provider:
   npx prisma generate
   DATABASE_URL="postgresql://..." npx prisma db push
   # pilih salah satu:
   npm run db:seed                                            # data demo baru
   DATABASE_URL="postgresql://..." npx tsx scripts/migrate-sqlite-to-postgres.mjs import   # data lama
   ```
5. Deploy di Vercel (build otomatis terdeteksi). Setiap push ke `main` memicu deployment baru.

### Alternatif: Docker di VPS

```bash
docker build -t sukan-river-tubing .
docker volume create sukan-data
docker run -d --name srt -p 80:3000 \
  -e DATABASE_URL="file:/data/custom.db" \
  -e ADMIN_SESSION_SECRET="$(openssl rand -hex 32)" \
  -v sukan-data:/data --restart unless-stopped \
  sukan-river-tubing
```

## Memperbarui Website (alur harian)

1. Edit kode → commit → `git push origin main`.
2. Railway/Vercel otomatis build & deploy versi terbaru (± 2-4 menit).
3. Jika skema database berubah, jalankan `npx prisma db push` (lokal terhadap `DATABASE_URL` produksi) atau biarkan startCommand Railway melakukannya saat boot.

## Perintah yang Tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan (port 3000) |
| `npm run build` | Build produksi Next.js standalone |
| `npm run start` | Menjalankan server produksi |
| `npm run lint` | Pemeriksaan ESLint |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Sinkronisasi skema ke database |
| `npm run db:seed` | Mengisi data demo |
| `npm run db:migrate` / `db:reset` | Migrasi dev / reset database |

## Keamanan

- File `.env`, `db/*.db`, dan seluruh log **tidak pernah** di-commit (sudah dikonfigurasi di `.gitignore`).
- Database produksi berisi data pribadi pelanggan — pastikan repository **private** jika menyimpan data sungguhan, dan selalu ganti password admin demo.
- Payment gateway adalah **simulasi** (tanpa transaksi nyata) — hubungkan penyedia pembayaran sungguhan sebelum go-live komersial.
