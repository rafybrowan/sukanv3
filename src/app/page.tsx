'use client';

import { useHashRoute, navigate } from '@/components/app/router';
import { UserLayout } from '@/components/app/user/UserLayout';
import { LandingPage } from '@/components/app/user/LandingPage';
import { JadwalPage, KapasitasPage } from '@/components/app/user/JadwalKapasitasPage';
import { ReservasiWizard } from '@/components/app/user/ReservasiWizard';
import { CekReservasiPage } from '@/components/app/user/CekReservasiPage';
import { DetailReservasiPage, PerubahanPage } from '@/components/app/user/DetailReservasiPage';
import { AdminLayout, AdminLoginPage } from '@/components/app/admin/AdminLayout';
import { AdminDashboardPage } from '@/components/app/admin/AdminDashboardPage';
import { AdminReservasiPage } from '@/components/app/admin/AdminReservasiPage';
import { AdminJadwalPage, AdminKapasitasPage } from '@/components/app/admin/AdminJadwalKapasitasPage';
import { AdminPengelompokanPage } from '@/components/app/admin/AdminPengelompokanPage';
import { AdminPemanduPage } from '@/components/app/admin/AdminPemanduPage';
import { AdminHonorPemanduPage } from '@/components/app/admin/AdminHonorPemanduPage';
import { AdminKonfirmasiPage } from '@/components/app/admin/AdminKonfirmasiPage';
import { AdminPembayaranPage } from '@/components/app/admin/AdminPembayaranPage';
import { AdminLaporanPage, AdminPengaturanPage } from '@/components/app/admin/AdminLaporanPengaturanPage';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';

function NotFound({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Compass className="h-8 w-8 text-primary" />
      </span>
      <h1 className="text-2xl font-extrabold">Halaman Tidak Ditemukan</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Alamat yang Anda tuju tidak tersedia. Mari kembali ke jalur yang benar.
      </p>
      <Button className="mt-6 font-bold" onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/')}>
        {isAdmin ? 'Ke Dashboard Admin' : 'Kembali ke Beranda'}
      </Button>
    </div>
  );
}

/** Sisi pengunjung — tanpa login */
function UserApp({ path, query }: { path: string; query: URLSearchParams }) {
  let content: React.ReactNode;

  if (path === '/') {
    content = <LandingPage />;
  } else if (path === '/jadwal') {
    content = <JadwalPage />;
  } else if (path === '/kapasitas') {
    content = <KapasitasPage />;
  } else if (path === '/reservasi') {
    content = <ReservasiWizard prefillScheduleId={query.get('scheduleId') || undefined} />;
  } else if (path === '/cek-reservasi') {
    content = <CekReservasiPage />;
  } else if (path.startsWith('/reservasi/')) {
    const parts = path.split('/').filter(Boolean); // ['reservasi', code, 'perubahan'?]
    const code = decodeURIComponent(parts[1] || '');
    if (parts[2] === 'perubahan') {
      content = <PerubahanPage key={code} code={code} />;
    } else {
      content = <DetailReservasiPage key={code} code={code} />;
    }
  } else {
    content = <NotFound isAdmin={false} />;
  }

  return <UserLayout path={path}>{content}</UserLayout>;
}

/** Sisi admin — wajib login */
function AdminApp({ path }: { path: string }) {
  if (path === '/admin/login') return <AdminLoginPage />;

  let content: React.ReactNode;
  switch (path) {
    case '/admin/dashboard': content = <AdminDashboardPage />; break;
    case '/admin/reservasi': content = <AdminReservasiPage />; break;
    case '/admin/jadwal': content = <AdminJadwalPage />; break;
    case '/admin/kapasitas': content = <AdminKapasitasPage />; break;
    case '/admin/pengelompokan': content = <AdminPengelompokanPage />; break;
    case '/admin/pemandu': content = <AdminPemanduPage />; break;
    case '/admin/honor-pemandu': content = <AdminHonorPemanduPage />; break;
    case '/admin/konfirmasi': content = <AdminKonfirmasiPage />; break;
    case '/admin/pembayaran': content = <AdminPembayaranPage />; break;
    case '/admin/laporan': content = <AdminLaporanPage />; break;
    case '/admin/pengaturan': content = <AdminPengaturanPage />; break;
    default: content = <NotFound isAdmin />;
  }

  return <AdminLayout path={path}>{content}</AdminLayout>;
}

export default function Page() {
  const { path, query } = useHashRoute();
  const isAdmin = path.startsWith('/admin');

  if (isAdmin) return <AdminApp path={path} />;
  return <UserApp path={path} query={query} />;
}
