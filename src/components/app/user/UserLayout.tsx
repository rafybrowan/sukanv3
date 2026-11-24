'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Waves, Menu, X, MapPin, Clock, Phone, Instagram, Facebook, Youtube, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { navigate } from '@/components/app/router';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Beranda', path: '/' },
  { label: 'Jadwal', path: '/jadwal' },
  { label: 'Kapasitas', path: '/kapasitas' },
  { label: 'Cek Reservasi', path: '/cek-reservasi' },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <button
      onClick={() => navigate('/')}
      className="flex items-center gap-2.5 text-left"
      aria-label="Beranda Sukan River Tubing"
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl shadow-sm', light ? 'bg-emerald-400/20 text-emerald-200' : 'bg-primary text-white')}>
        <Waves className="h-5.5 w-5.5" />
      </span>
      <span className="leading-tight">
        <span className={cn('block font-extrabold tracking-tight', light ? 'text-white' : 'text-foreground')}>
          Sukan River Tubing
        </span>
        <span className={cn('block text-[11px] font-medium', light ? 'text-emerald-200/80' : 'text-muted-foreground')}>
          Panembangan · Banyumas
        </span>
      </span>
    </button>
  );
}

function NavLink({ item, active, onClick }: { item: typeof NAV_ITEMS[number]; active: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={() => { navigate(item.path); onClick?.(); }}
      className={cn(
        'rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
      )}
    >
      {item.label}
    </button>
  );
}

export function UserLayout({ path, children }: { path: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const active = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.path} item={item} active={active(item.path)} />
            ))}
          </nav>
          <div className="hidden md:block">
            <Button onClick={() => navigate('/reservasi')} className="font-semibold shadow-sm">
              Reservasi Sekarang <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Buka menu navigasi">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-5">
                <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
                <div className="mb-6 flex items-center justify-between">
                  <Logo />
                </div>
                <nav className="flex flex-col gap-1.5" aria-label="Navigasi mobile">
                  {NAV_ITEMS.map((item) => (
                    <NavLink key={item.path} item={item} active={active(item.path)} onClick={() => setOpen(false)} />
                  ))}
                </nav>
                <Button onClick={() => { setOpen(false); navigate('/reservasi'); }} className="mt-5 w-full font-semibold">
                  Reservasi Sekarang <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Desa Panembangan, Kec. Cilongok, Kab. Banyumas
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ===== Konten ===== */}
      <main className="flex-1">{children}</main>

      {/* ===== Footer ===== */}
      <footer className="mt-auto bg-[oklch(0.27_0.04_158)] text-emerald-50/90">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-emerald-100/70">
              Petualangan menyusuri aliran Sungai Sukan dengan suasana alam Desa Panembangan. Aman, seru, dan berkesan bersama pemandu berpengalaman.
            </p>
            <div className="mt-4 flex gap-2">
              {[Instagram, Facebook, Youtube].map((Icon, i) => (
                <span key={i} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20" role="button" aria-label="Media sosial">
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-200">Kontak &amp; Lokasi</h3>
            <ul className="space-y-3 text-sm text-emerald-100/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                Desa Panembangan, Kec. Cilongok, Kab. Banyumas, Jawa Tengah
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                0812-2710-8910 (WhatsApp)
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                Setiap hari, 07.00 – 16.00 WIB
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-200">Tautan Cepat</h3>
            <ul className="space-y-2.5 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.path}>
                  <button onClick={() => navigate(item.path)} className="text-emerald-100/80 transition-colors hover:text-white">
                    {item.label}
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => navigate('/reservasi')} className="font-semibold text-emerald-200 transition-colors hover:text-white">
                  Reservasi Sekarang
                </button>
              </li>
            </ul>
            <button
              onClick={() => navigate('/admin/login')}
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Login Admin
            </button>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-emerald-100/50 sm:flex-row sm:px-6">
            <p>© 2026 Sukan River Tubing · Desa Panembangan, Banyumas</p>
            <p className="flex items-center gap-1.5">
              <Waves className="h-3.5 w-3.5" /> Prototipe Sistem Reservasi
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
