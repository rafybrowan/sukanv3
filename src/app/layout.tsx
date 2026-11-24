import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Sukan River Tubing — Reservasi River Tubing di Panembangan, Banyumas",
  description:
    "Sistem reservasi resmi Sukan River Tubing. Petualangan menyusuri aliran Sungai Sukan dengan suasana alam Desa Panembangan, Cilongok, Banyumas. Lihat jadwal, cek kapasitas, dan reservasi online.",
  keywords: ["river tubing", "Sukan River Tubing", "Panembangan", "Cilongok", "Banyumas", "wisata Banyumas", "reservasi"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
