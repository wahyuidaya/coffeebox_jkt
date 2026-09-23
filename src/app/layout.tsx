// app/layout.tsx
import type { Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "Coffeebox_Jkt",
  description: "Sistem pemesanan Coffeebox_Jkt",
};

// PENTING: tanpa ini, browser mobile render halaman di kanvas ~980px
// lalu di-scale-down biar muat di layar — efeknya: layout kelihatan
// salah posisi, bisa digeser ke samping, elemen kepotong/goyang.
// Media query manapun tidak akan bekerja benar tanpa ini.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
