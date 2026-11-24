'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, CalendarDays, ChevronRight, Clock, LifeBuoy, MapPin, ShieldCheck,
  Sparkles, Star, Users, Waves, Camera, TentTree, Ticket, CreditCard, Banknote,
  UserCheck, BadgeCheck, ClipboardCheck, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CapacityBar } from '@/components/app/shared/CapacityBar';
import { StatusBadge } from '@/components/app/shared/StatusBadge';
import { navigate } from '@/components/app/router';
import { api } from '@/lib/api-client';
import { formatRupiah, formatDateID, formatDateShort, dayShort, isWeekendDate } from '@/lib/format';
import type { ScheduleStats, AppSettings } from '@/lib/types';

function SectionHead({ eyebrow, title, desc, center = true }: { eyebrow: string; title: string; desc?: string; center?: boolean }) {
  return (
    <div className={`mb-10 ${center ? 'mx-auto max-w-2xl text-center' : ''}`}>
      <p className="mb-2 text-sm font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      {desc && <p className="mt-3 text-muted-foreground">{desc}</p>}
    </div>
  );
}

export function LandingPage() {
  const [upcoming, setUpcoming] = useState<ScheduleStats[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    api('/api/schedules').then((d) => {
      const active = (d.schedules as ScheduleStats[]).filter((s) => s.status === 'AKTIF' && s.date >= d.today).slice(0, 4);
      setUpcoming(active);
    }).catch(() => {});
    api('/api/settings').then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        <img src="/images/hero-1.jpg" alt="Peserta river tubing menikmati arus Sungai Sukan" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.25_0.04_158/0.75)] via-[oklch(0.27_0.04_158/0.55)] to-[oklch(0.22_0.035_152/0.9)]" />
        <div className="relative mx-auto flex min-h-[88vh] w-full max-w-7xl flex-col items-center justify-center px-4 py-24 text-center text-white sm:px-6">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="mb-5 border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold text-emerald-100 backdrop-blur">
              <MapPin className="mr-1.5 h-3.5 w-3.5" /> Desa Panembangan · Cilongok · Banyumas
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
              Saatnya Rasakan Serunya{' '}
              <span className="text-emerald-300">Sukan River Tubing</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-emerald-50/85 sm:text-lg">
              Petualangan menyusuri aliran Sungai Sukan dengan suasana alam Panembangan —
              seru, aman, dan berkesan bersama keluarga maupun teman.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate('/reservasi')} className="h-13 px-8 text-base font-bold shadow-xl shadow-emerald-950/30">
                Reservasi Sekarang <ArrowRight className="ml-1.5 h-5 w-5" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/jadwal')} className="h-13 bg-white/95 px-8 text-base font-bold text-emerald-900 hover:bg-white">
                <CalendarDays className="mr-1.5 h-5 w-5" /> Lihat Jadwal
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { icon: Users, value: '1.200+', label: 'Tamu tahun ini' },
              { icon: Star, value: '4.9/5', label: 'Rating pengunjung' },
              { icon: LifeBuoy, value: '100%', label: 'Perlengkapan aman' },
              { icon: ShieldCheck, value: 'Berpengalaman', label: 'Pemandu lokal' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-md">
                <s.icon className="mx-auto mb-1.5 h-5 w-5 text-emerald-300" />
                <p className="text-lg font-extrabold leading-none">{s.value}</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-50/75">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= TENTANG ================= */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6" id="tentang">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <img src="/images/about-1.jpg" alt="Peserta tubing menyeberangi Sungai Sukan" className="h-64 w-full rounded-2xl object-cover shadow-lg" />
              <img src="/images/river-1.jpg" alt="Hijau alam sepanjang Sungai Sukan" className="mt-8 h-64 w-full rounded-2xl object-cover shadow-lg" />
            </div>
            <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border bg-white px-5 py-3 shadow-xl">
              <Waves className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-bold leading-none">Sungai Sukan</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Panembangan, Banyumas</p>
              </div>
            </div>
          </div>
          <div>
            <SectionHead
              center={false}
              eyebrow="Tentang Kami"
              title="Wisata River Tubing Ala Desa yang Membumi"
              desc="Sukan River Tubing menghadirkan pengalaman menyusuri Sungai Sukan yang tenang dan berwarna hijau sepanjang mata memandang."
            />
            <p className="-mt-4 text-muted-foreground">
              Berawal dari inisiatif pemuda Desa Panembangan, kini Sukan River Tubing menjadi salah satu
              destinasi favorit di kaki lereng Slamet. Dengan perlengkapan standar keamanan dan pemandu
              lokal yang hafal setiap belokan sungai, petualangan Anda dijamin aman untuk semua usia.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: LifeBuoy, text: 'Ban tubing, pelampung, dan helm disediakan lengkap' },
                { icon: UserCheck, text: 'Pemandu berpengalaman mendampingi setiap keberangkatan' },
                { icon: TentTree, text: 'Suasana pedesaan yang sejuk jauh dari kebisingan' },
                { icon: Camera, text: 'Banyak spot foto alami di sepanjang jalur sungai' },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-4.5 w-4.5 text-primary" />
                  </span>
                  <span className="pt-1.5 text-sm font-medium">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= PENGALAMAN / GALERI ================= */}
      <section className="bg-[oklch(0.975_0.006_150)] py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Pengalaman"
            title="Serunya Menyusuri Arus Sungai Sukan"
            desc="Rasakan sensasi mengapung bersama arus sungai yang menenangkan, ditemani pemandangan hutan dan sawah yang hijau."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              { src: '/images/gallery-1.jpg', alt: 'Persiapan sebelum keberangkatan' },
              { src: '/images/gallery-2.jpg', alt: 'Menyusuri arus Sungai Sukan' },
              { src: '/images/gallery-3.jpg', alt: 'Suasana alam sepanjang sungai' },
              { src: '/images/gallery-4.jpg', alt: 'Kegembiraan peserta river tubing' },
              { src: '/images/river-2.jpg', alt: 'Kejernihan air Sungai Sukan' },
              { src: '/images/gallery-5.jpg', alt: 'Kebersamaan peserta di sungai' },
            ].map((g, i) => (
              <motion.div
                key={g.src}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`group relative overflow-hidden rounded-2xl shadow-md ${i === 0 ? 'md:row-span-2 md:h-full' : ''}`}
              >
                <img
                  src={g.src} alt={g.alt} loading="lazy"
                  className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${i === 0 ? 'h-64 md:h-[416px]' : 'h-48 md:h-52'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PAKET / TIKET ================= */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6" id="paket">
        <SectionHead
          eyebrow="Paket & Tiket"
          title="Harga Jujur, Seru Maksimal"
          desc="Satu harga untuk semua — sudah termasuk perlengkapan lengkap dan pemandu."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {/* Reguler — featured */}
          <Card className="relative border-2 border-primary shadow-xl md:-translate-y-3">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white shadow">Paling Populer</Badge>
            <CardContent className="p-7">
              <div className="mb-1 flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-extrabold">Paket Reguler</h3>
              </div>
              <p className="text-sm text-muted-foreground">Per orang · semua umur</p>
              <p className="mt-4 text-4xl font-extrabold text-primary">
                {formatRupiah(settings?.pricePerPerson ?? 25000)}
                <span className="text-base font-semibold text-muted-foreground"> /orang</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {['Ban tubing & pelampung', 'Helm pelindung', 'Pemandu berpengalaman', 'Penitipan barang', 'Air mineral'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full font-bold" onClick={() => navigate('/reservasi')}>
                Reservasi Paket Ini
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-7">
              <div className="mb-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-extrabold">Rombongan &amp; Keluarga</h3>
              </div>
              <p className="text-sm text-muted-foreground">7 orang atau lebih</p>
              <p className="mt-4 text-4xl font-extrabold">
                {formatRupiah(settings?.pricePerPerson ?? 25000)}
                <span className="text-base font-semibold text-muted-foreground"> /orang</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {['Semua fasilitas paket reguler', 'Prioritas pengelompokan keberangkatan', 'Pendampingan khusus rombongan', 'Fleksibel ubah jadwal (H-2)'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-6 w-full font-bold" onClick={() => navigate('/reservasi')}>
                Reservasi Rombongan
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-7">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-extrabold">Sekolah &amp; Instansi</h3>
              </div>
              <p className="text-sm text-muted-foreground">Study tour · gathering</p>
              <p className="mt-4 text-4xl font-extrabold">
                Hubungi
                <span className="text-base font-semibold text-muted-foreground"> kami</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {['Jadwal khusus rombongan besar', 'Kapasitas hingga 60 orang/jadwal', 'Pembayaran Lunas atau Bayar di Tempat', 'Invoice & dokumen resmi'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-6 w-full font-bold" onClick={() => navigate('/reservasi')}>
                Ajukan Reservasi
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ================= JADWAL SINGKAT ================= */}
      <section className="bg-[oklch(0.28_0.04_158)] py-20 text-white">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-emerald-300">Jadwal Terdekat</p>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Jangan Sampai Kehabisan Slot</h2>
            </div>
            <Button variant="secondary" onClick={() => navigate('/jadwal')} className="bg-white/95 font-bold text-emerald-900 hover:bg-white">
              Lihat Semua Jadwal <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-emerald-100/70">
              Memuat jadwal terdekat…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-semibold text-emerald-200">{formatDateShort(s.date)} · {s.time}</p>
                  <p className="mt-0.5 text-xs text-emerald-100/60">{formatDateID(s.date)}</p>
                  <div className="mt-4">
                    <CapacityBar filled={s.currentParticipants} capacity={s.capacity} showLabel />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-100/70">{s.remaining} slot tersisa</span>
                    <StatusBadge status={s.availability} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= ATURAN KELOMPOK 7 ORANG ================= */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead
          eyebrow="Sistem Keberangkatan"
          title="Aturan Kelompok 7 Orang"
          desc="Setiap keberangkatan dikelompokkan ideal 7 orang agar perjalanan lebih seru dan aman. Pesanan di bawah 7 orang pun tetap bisa!"
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-dashed">
            <CardContent className="p-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </span>
                <h3 className="text-lg font-extrabold">Opsi A — Tunggu Kelompok</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Peserta Anda akan menunggu dan dapat digabungkan dengan peserta lain pada jadwal
                yang sama hingga mencapai <b>7 orang</b>. Anda hanya membayar sesuai jumlah peserta.
              </p>
              <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
                <p className="font-semibold">Contoh: memesan 3 orang</p>
                <p className="mt-1 text-muted-foreground">Bayar 3 × {formatRupiah(settings?.pricePerPerson ?? 25000)} = <b className="text-foreground">{formatRupiah(3 * (settings?.pricePerPerson ?? 25000))}</b></p>
                <Badge className="mt-2.5 border-amber-200 bg-amber-50 text-amber-700">Status: Menunggu Pengelompokan</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-dashed">
            <CardContent className="p-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <Waves className="h-5 w-5 text-sky-600" />
                </span>
                <h3 className="text-lg font-extrabold">Opsi B — Tetap Berangkat</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Anda tetap dapat berangkat dengan jumlah peserta saat ini, namun pembayaran
                dihitung berdasarkan <b>7 orang</b> (kelompok ideal).
              </p>
              <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
                <p className="font-semibold">Contoh: memesan 3 orang</p>
                <p className="mt-1 text-muted-foreground">Dihitung 7 × {formatRupiah(settings?.pricePerPerson ?? 25000)} = <b className="text-foreground">{formatRupiah(7 * (settings?.pricePerPerson ?? 25000))}</b></p>
                <Badge className="mt-2.5 border-sky-200 bg-sky-50 text-sky-700">Status: Siap Berangkat</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ================= CARA RESERVASI ================= */}
      <section className="bg-[oklch(0.975_0.006_150)] py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Cara Reservasi"
            title="Hanya 4 Langkah Mudah"
            desc="Tanpa perlu membuat akun — reservasi langsung sebagai tamu."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarDays, title: 'Pilih Tanggal & Jadwal', desc: 'Lihat jadwal tersedia beserta sisa kapasitasnya secara real-time.' },
              { icon: ClipboardCheck, title: 'Isi Data Peserta', desc: 'Nama, nomor WhatsApp, dan jumlah peserta. Tanpa registrasi akun.' },
              { icon: Users, title: 'Pilih Pengelompokan', desc: 'Tunggu kelompok atau tetap berangkat — sesuai kebutuhan Anda.' },
              { icon: BadgeCheck, title: 'Bayar & Dapatkan Kode', desc: 'Pilih metode Lunas atau Bayar di Tempat. Kode reservasi langsung terbit.' },
            ].map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border bg-white p-6 shadow-sm">
                <span className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white shadow">
                  {i + 1}
                </span>
                <s.icon className="mb-3 h-7 w-7 text-primary" />
                <h3 className="font-extrabold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CARA PEMBAYARAN ================= */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead
          eyebrow="Cara Pembayaran"
          title="2 Pilihan Pembayaran"
          desc="Pilih cara pembayaran yang paling nyaman untuk Anda."
        />
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {[
            {
              icon: CreditCard, title: 'Pembayaran Lunas', color: 'bg-emerald-100 text-emerald-700',
              desc: 'Bayar seluruh total reservasi sekarang melalui payment gateway. Praktis, tanpa sisa pembayaran.',
              example: `Contoh: total ${formatRupiah(175000)} → dibayar ${formatRupiah(175000)}`,
            },
            {
              icon: Banknote, title: 'Bayar di Tempat', color: 'bg-orange-100 text-orange-700',
              desc: 'Tanpa pembayaran online. Reservasi langsung terkonfirmasi dan pembayaran dilakukan di lokasi.',
              example: `Contoh: total ${formatRupiah(175000)} → dibayar saat hari H`,
            },
          ].map((m) => (
            <Card key={m.title} className="shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-7">
                <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${m.color}`}>
                  <m.icon className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-extrabold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
                <p className="mt-4 rounded-lg bg-muted px-3.5 py-2.5 text-xs font-medium text-muted-foreground">{m.example}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="bg-[oklch(0.975_0.006_150)] py-20" id="faq">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <SectionHead
            eyebrow="FAQ"
            title="Pertanyaan yang Sering Diajukan"
          />
          <Accordion type="single" collapsible className="rounded-2xl border bg-white px-5 shadow-sm">
            {[
              { q: 'Apakah peserta wajib bisa berenang?', a: 'Tidak wajib. Setiap peserta wajib menggunakan pelampung dan helm yang telah kami sediakan, dan selalu didampingi pemandu berpengalaman di sepanjang jalur sungai.' },
              { q: 'Berapa usia minimal peserta?', a: 'Peserta minimal berusia 7 tahun. Anak-anak usia 7–12 tahun wajib didampingi orang tua atau pendamping dewasa dalam satu kelompok keberangkatan.' },
              { q: 'Bagaimana sistem kelompok 7 orang bekerja?', a: 'Keberangkatan ideal dikelompokkan 7 orang. Jika pesanan Anda kurang dari 7, Anda bisa memilih menunggu penggabungan dengan peserta lain (membayar sesuai jumlah peserta) atau tetap berangkat dengan pembayaran dihitung 7 orang.' },
              { q: 'Metode pembayaran apa saja yang tersedia?', a: 'Tersedia dua metode: Pembayaran Lunas (bayar penuh online melalui payment gateway) atau Bayar di Tempat (tanpa pembayaran online — pembayaran dilakukan langsung di lokasi Sukan River Tubing saat hari H).' },
              { q: 'Bagaimana jika cuaca buruk di hari H?', a: 'Keamanan adalah prioritas kami. Jika kondisi sungai tidak memungkinkan, jadwal akan ditunda atau ditutup. Anda akan dihubungi via WhatsApp untuk penjadwalan ulang tanpa biaya tambahan.' },
              { q: 'Bagaimana cara melihat atau mengubah reservasi saya?', a: 'Gunakan halaman Cek Reservasi dengan memasukkan kode reservasi dan nomor WhatsApp Anda. Dari sana Anda dapat melihat status reservasi, pengelompokan, dan mengajukan perubahan.' },
            ].map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b last:border-b-0">
                <AccordionTrigger className="text-left text-sm font-bold hover:text-primary">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <section className="relative overflow-hidden">
        <img src="/images/banner-wide.jpg" alt="Keberangkatan river tubing di Sungai Sukan" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.25_0.04_158/0.92)] to-[oklch(0.30_0.05_152/0.65)]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-20 text-white sm:px-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Siap Berpetualang di Sungai Sukan?</h2>
            <p className="mt-3 text-emerald-50/85">
              Slot keberangkatan terbatas setiap jadwalnya. Amankan tempat Anda sekarang —
              bayar lunas online atau bayar penuh di lokasi.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate('/reservasi')} className="h-13 bg-emerald-400 px-8 text-base font-bold text-emerald-950 shadow-xl hover:bg-emerald-300">
              Reservasi Sekarang <ArrowRight className="ml-1.5 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/cek-reservasi')} className="h-13 border-white/40 bg-transparent px-8 text-base font-bold text-white hover:bg-white/10 hover:text-white">
              Cek Reservasi Saya
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-emerald-100/60">
            <Info className="h-3.5 w-3.5" /> Prototipe — pembayaran melalui simulasi payment gateway
          </p>
        </div>
      </section>
    </div>
  );
}
