import Link from "next/link";
import { Coffee, QrCode, ShoppingBag, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";

export default function HomePage() {
  return (
    <main
      style={{
        backgroundColor: "#FBF4E8",
        minHeight: "100vh",
        color: "#1A0F07",
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
      className="flex flex-col justify-between"
    >
      {/* Top Simple Nav */}
      <header
        style={{
          backgroundColor: "#1A0F07",
          borderBottom: "1px solid rgba(200, 151, 47, 0.25)",
        }}
        className="w-full px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{
              backgroundColor: "rgba(200, 151, 47, 0.15)",
              color: "#E8C878",
              border: "1px solid rgba(200, 151, 47, 0.3)",
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <Coffee className="w-4 h-4" />
          </div>
          <span
            style={{ color: "#FEFCF7" }}
            className="font-bold text-base tracking-wide"
          >
            CoffeeBox_Jkt
          </span>
        </div>

        <a
          href="https://wahyuidaya.github.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#E8C878",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(200, 151, 47, 0.2)",
          }}
          className="text-xs px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors inline-flex items-center gap-1.5"
        >
          Portofolio Wahyu Idaya <ExternalLink className="w-3 h-3" />
        </a>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-16 w-full">
        {/* Title / Intro */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <span
            style={{
              color: "#7A5C3A",
              backgroundColor: "rgba(200, 151, 47, 0.12)",
              borderColor: "#DFC9A8",
            }}
            className="inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-3 tracking-wide"
          >
            Sistem Pemesanan Menu QR Code
          </span>
          <h1
            style={{ color: "#1A0F07" }}
            className="text-2xl sm:text-3xl font-bold tracking-tight mb-3"
          >
            Selamat Datang di CoffeeBox
          </h1>
          <p
            style={{ color: "#7A5C3A" }}
            className="text-sm sm:text-base leading-relaxed"
          >
            Pilih portal di bawah ini untuk mencoba alur pemesanan mandiri pelanggan atau manajemen operasional cafe:
          </p>
        </div>

        {/* 3 Simple Cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {/* 1. Pelanggan */}
          <div
            style={{
              backgroundColor: "#FEFCF7",
              borderColor: "#DFC9A8",
            }}
            className="rounded-xl border p-5 flex flex-col justify-between hover:border-[#B87040] hover:shadow-sm transition-all"
          >
            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#B87040",
                  borderColor: "#DFC9A8",
                }}
                className="w-10 h-10 rounded-lg border flex items-center justify-center mb-4"
              >
                <QrCode className="w-5 h-5" />
              </div>
              <h2
                style={{ color: "#1A0F07" }}
                className="text-base font-bold mb-1.5"
              >
                Menu Pelanggan
              </h2>
              <p
                style={{ color: "#7A5C3A" }}
                className="text-xs leading-relaxed mb-4"
              >
                Simulasi pelanggan di meja 01: lihat daftar menu, pilih varian rasa, dan lakukan pemesanan.
              </p>
            </div>

            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#7A5C3A",
                  borderColor: "#DFC9A8",
                }}
                className="rounded-lg p-2.5 mb-3.5 text-[11px] border"
              >
                Akses: <strong>Meja 01</strong> (aktif)
              </div>
              <Link
                href="/order/01"
                style={{
                  backgroundColor: "#1A0F07",
                  color: "#FEFCF7",
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Buka Menu Meja 01 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 2. Kasir */}
          <div
            style={{
              backgroundColor: "#FEFCF7",
              borderColor: "#DFC9A8",
            }}
            className="rounded-xl border p-5 flex flex-col justify-between hover:border-[#B87040] hover:shadow-sm transition-all"
          >
            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#B87040",
                  borderColor: "#DFC9A8",
                }}
                className="w-10 h-10 rounded-lg border flex items-center justify-center mb-4"
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2
                style={{ color: "#1A0F07" }}
                className="text-base font-bold mb-1.5"
              >
                Portal Kasir
              </h2>
              <p
                style={{ color: "#7A5C3A" }}
                className="text-xs leading-relaxed mb-4"
              >
                Menerima pesanan masuk real-time, verifikasi pembayaran, update status, dan cetak struk kasir.
              </p>
            </div>

            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#7A5C3A",
                  borderColor: "#DFC9A8",
                }}
                className="rounded-lg p-2.5 mb-3.5 text-[11px] border"
              >
                Akun: <strong>kasir</strong> • Sandi: <strong>kasir123</strong>
              </div>
              <Link
                href="/kasir/login"
                style={{
                  backgroundColor: "#5C2E1A",
                  color: "#FEFCF7",
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Masuk Kasir <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 3. Admin */}
          <div
            style={{
              backgroundColor: "#FEFCF7",
              borderColor: "#DFC9A8",
            }}
            className="rounded-xl border p-5 flex flex-col justify-between hover:border-[#B87040] hover:shadow-sm transition-all"
          >
            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#B87040",
                  borderColor: "#DFC9A8",
                }}
                className="w-10 h-10 rounded-lg border flex items-center justify-center mb-4"
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2
                style={{ color: "#1A0F07" }}
                className="text-base font-bold mb-1.5"
              >
                Portal Admin
              </h2>
              <p
                style={{ color: "#7A5C3A" }}
                className="text-xs leading-relaxed mb-4"
              >
                Kelola katalog menu makanan/minuman, generate QR meja, kelola pengguna, dan analitik penjualan.
              </p>
            </div>

            <div>
              <div
                style={{
                  backgroundColor: "#FBF4E8",
                  color: "#7A5C3A",
                  borderColor: "#DFC9A8",
                }}
                className="rounded-lg p-2.5 mb-3.5 text-[11px] border"
              >
                Akun: <strong>superadmin</strong> • Sandi: <strong>admin123</strong>
              </div>
              <Link
                href="/admin/login"
                style={{
                  backgroundColor: "#1A0F07",
                  color: "#FEFCF7",
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Masuk Admin <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Tech Stack Summary - Minimal */}
        <div
          style={{
            backgroundColor: "#FEFCF7",
            borderColor: "#DFC9A8",
            color: "#7A5C3A",
          }}
          className="rounded-xl border p-4 text-center text-xs"
        >
          <span className="font-semibold" style={{ color: "#1A0F07" }}>
            Teknologi:
          </span>{" "}
          Next.js 14 • TypeScript • Prisma ORM • TiDB Cloud MySQL • Tailwind CSS
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #DFC9A8",
          color: "#7A5C3A",
        }}
        className="w-full py-5 text-center text-xs"
      >
        <p className="mb-1.5">
          © {new Date().getFullYear()} CoffeeBox_Jkt • Dikembangkan oleh{" "}
          <strong style={{ color: "#1A0F07" }}>Wahyu Idaya</strong>
        </p>
        <div className="flex justify-center items-center gap-3">
          <a
            href="https://github.com/wahyuidaya/coffeebox_jkt"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
          <span>•</span>
          <a
            href="https://wahyuidaya.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Portofolio Pribadi
          </a>
        </div>
      </footer>
    </main>
  );
}
