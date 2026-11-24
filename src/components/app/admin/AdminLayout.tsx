'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, CalendarDays, ClipboardList, Gauge, LayoutDashboard, LogOut, Menu,
  Settings, UserCheck, Users, Waves, Wallet, Loader2, LifeBuoy, HandCoins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { navigate } from '@/components/app/router';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/reservasi', label: 'Reservasi', icon: ClipboardList },
  { path: '/admin/jadwal', label: 'Jadwal', icon: CalendarDays },
  { path: '/admin/kapasitas', label: 'Kapasitas', icon: Gauge },
  { path: '/admin/pengelompokan', label: 'Pengelompokan', icon: Users },
  { path: '/admin/pemandu', label: 'Pemandu / Guide', icon: LifeBuoy },
  { path: '/admin/honor-pemandu', label: 'Honor Guide', icon: HandCoins },
  { path: '/admin/konfirmasi', label: 'Konfirmasi Peserta', icon: UserCheck },
  { path: '/admin/pembayaran', label: 'Pembayaran', icon: Wallet },
  { path: '/admin/laporan', label: 'Laporan', icon: BarChart3 },
  { path: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
];

function SidebarContent({ path, admin, onNavigate }: { path: string; admin: any; onNavigate?: () => void }) {
  const logout = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* noop */ }
    navigate('/admin/login');
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Waves className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-extrabold text-white">Sukan River Tubing</p>
          <p className="text-[11px] text-emerald-200/60">Panel Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-thin" aria-label="Navigasi admin">
        {ADMIN_NAV.map((item) => {
          const active = path === item.path || (item.path !== '/admin/dashboard' && path.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onNavigate?.(); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all',
                active ? 'bg-emerald-400/15 text-emerald-200 shadow-inner' : 'text-emerald-100/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5', active && 'text-emerald-300')} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-extrabold text-emerald-200">
            {admin?.name?.charAt(0) ?? 'A'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{admin?.name ?? 'Admin'}</p>
            <p className="truncate text-[11px] text-emerald-200/50">{admin?.email}</p>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          className="w-full border-white/15 bg-transparent text-emerald-100/70 hover:bg-white/10 hover:text-white"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  );
}

export function AdminLayout({ path, children }: { path: string; children: React.ReactNode }) {
  const [admin, setAdmin] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/admin/me')
      .then((d) => { if (!cancelled) setAdmin(d.admin); })
      .catch(() => navigate('/admin/login'))
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.975_0.006_150)]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Memeriksa sesi admin…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[oklch(0.975_0.006_150)]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[oklch(0.27_0.04_158)] lg:block" aria-label="Sidebar admin">
        <SidebarContent path={path} admin={admin} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[oklch(0.27_0.04_158)] px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <Waves className="h-4 w-4" />
          </span>
          <span className="text-sm font-extrabold text-white">Sukan River Tubing · Admin</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Buka menu admin">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-0 bg-[oklch(0.27_0.04_158)] p-0">
            <SheetTitle className="sr-only">Menu admin</SheetTitle>
            <SidebarContent path={path} admin={admin} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Konten */}
      <main className="min-w-0 flex-1 pt-14 lg:ml-64 lg:pt-0">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // sudah login? langsung ke dashboard
    api('/api/admin/me').then(() => navigate('/admin/dashboard')).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      navigate('/admin/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.24_0.035_155)] p-4">
      <img src="/images/river-1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.24_0.035_155/0.8)] to-[oklch(0.20_0.03_155/0.95)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-300 shadow-lg">
            <Waves className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Admin Sukan River Tubing</h1>
          <p className="mt-1.5 text-sm text-emerald-100/70">Kelola reservasi, jadwal, kapasitas, dan operasional.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="admin-email" className="text-sm font-bold">Email</label>
              <input
                id="admin-email" type="email" required placeholder="admin@sukanrivertubing.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-pass" className="text-sm font-bold">Password</label>
              <input
                id="admin-pass" type="password" required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</p>
            )}
            <Button type="submit" size="lg" className="w-full text-base font-bold" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null} Masuk
            </Button>
          </form>
          <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3.5 text-center text-xs text-amber-800">
            <b>Demo:</b> admin@sukanrivertubing.com / admin123
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-emerald-100/50">
          Area khusus pengelola. Pengunjung dapat kembali ke{' '}
          <button onClick={() => navigate('/')} className="font-semibold text-emerald-200 underline-offset-2 hover:underline">
            halaman utama
          </button>.
        </p>
      </div>
    </div>
  );
}
