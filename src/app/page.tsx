import Link from "next/link";
import { Coffee, QrCode, ShieldCheck, ShoppingBag, ArrowRight, ExternalLink, Sparkles, Database } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-white to-amber-50/30 text-stone-800 flex flex-col justify-between">
      {/* Top Banner */}
      <div className="w-full bg-stone-900 text-stone-300 text-xs py-2 px-4 text-center border-b border-stone-800 flex items-center justify-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
          <Sparkles className="w-3 h-3" /> Live Demo Portofolio
        </span>
        <span>•</span>
        <span>Dikembangkan oleh <strong>Wahyu Idaya</strong></span>
        <span>•</span>
        <a
          href="https://wahyuidaya.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:underline inline-flex items-center gap-1"
        >
          Lihat Portofolio Lengkap <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 w-full">
        {/* Brand & Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 text-white shadow-lg shadow-amber-600/30 mb-5">
            <Coffee className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 mb-3 font-serif">
            CoffeeBox_Jkt
          </h1>
          <p className="text-base sm:text-lg text-stone-600 font-medium mb-4">
            Sistem Pemesanan Menu Berbasis QR Code & Manajemen Cafe
          </p>
          <p className="text-sm text-stone-500 leading-relaxed">
            Aplikasi full-stack yang menghubungkan pesanan mandiri pelanggan di meja langsung ke kasir dan dashboard analitik admin secara real-time. Silakan pilih portal demo di bawah ini untuk mencoba:
          </p>
        </div>

        {/* 3 Portal Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Pelanggan */}
          <div className="relative group bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-xl hover:border-amber-500 transition-all duration-200 flex flex-col justify-between">
            <div className="absolute -top-3 left-6">
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full tracking-wide uppercase shadow-sm">
                Pelanggan
              </span>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mt-1">
                <QrCode className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Simulasi Meja 01</h2>
              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                Tampilan yang dilihat pelanggan saat scan QR Code di meja. Jelajahi katalog menu, pilih varian rasa, catatan, dan lakukan checkout tunai atau QRIS.
              </p>
            </div>
            <div>
              <div className="bg-amber-50 rounded-lg p-2.5 mb-4 text-xs text-amber-900 border border-amber-200/60">
                💡 <strong>Siap dicoba:</strong> Langsung pesan menu minuman & makanan yang sudah aktif.
              </div>
              <Link
                href="/order/01"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Buka Menu Meja 01 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Kasir */}
          <div className="relative group bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-xl hover:border-sky-500 transition-all duration-200 flex flex-col justify-between">
            <div className="absolute -top-3 left-6">
              <span className="bg-sky-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full tracking-wide uppercase shadow-sm">
                Kasir & Barista
              </span>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4 mt-1">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Portal Kasir</h2>
              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                Menerima pesanan masuk pelanggan, verifikasi bukti pembayaran QRIS/tunai, ubah status pesanan, dan cetak struk pembayaran.
              </p>
            </div>
            <div>
              <div className="bg-sky-50 rounded-lg p-2.5 mb-4 text-xs text-sky-900 border border-sky-200/60 font-mono">
                Akun Demo: <strong>kasir</strong> / <strong>kasir123</strong>
              </div>
              <Link
                href="/kasir/login"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Masuk Portal Kasir <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: Admin */}
          <div className="relative group bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-xl hover:border-purple-500 transition-all duration-200 flex flex-col justify-between">
            <div className="absolute -top-3 left-6">
              <span className="bg-purple-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full tracking-wide uppercase shadow-sm">
                Super Admin
              </span>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4 mt-1">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Portal Admin</h2>
              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                Akses penuh ke master data menu & bundling, manajemen nomor meja & generate QR code, serta grafik analitik pendapatan omzet cafe.
              </p>
            </div>
            <div>
              <div className="bg-purple-50 rounded-lg p-2.5 mb-4 text-xs text-purple-900 border border-purple-200/60 font-mono">
                Akun Demo: <strong>superadmin</strong> / <strong>admin123</strong>
              </div>
              <Link
                href="/admin/login"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Masuk Portal Admin <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Tech Stack Info */}
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-stone-200/80 p-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
            <Database className="w-3.5 h-3.5" /> Arsitektur & Teknologi Proyek
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-medium text-stone-700">
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">Next.js 14 App Router</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">TypeScript</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">Tailwind CSS</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">Prisma ORM</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">TiDB Cloud (MySQL Serverless)</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">JWT Authentication</span>
            <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200">Vercel Edge</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500">
        <p className="mb-2">
          © {new Date().getFullYear()} CoffeeBox_Jkt • Portofolio Proyek oleh <strong>Wahyu Idaya</strong>
        </p>
        <div className="flex justify-center items-center gap-4">
          <a
            href="https://github.com/wahyuidaya/coffeebox_jkt"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-900 inline-flex items-center gap-1 font-medium underline"
          >
            GitHub Repository <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <a
            href="https://wahyuidaya.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-900 inline-flex items-center gap-1 font-medium underline"
          >
            Website Portofolio <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </main>
  );
}
