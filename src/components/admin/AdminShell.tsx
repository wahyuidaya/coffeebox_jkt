"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { SessionUser } from "@/types/pengguna";
import ChangePasswordModal from "@/components/kasir/ChangePasswordModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const MENU = [
  { href: "/admin/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/admin/transaksi", icon: "📋", label: "Data Transaksi" },
  { href: "/admin/analisis", icon: "📈", label: "Analisis dan Grafik" },
];
const KELOLA = [
  { href: "/admin/menu", icon: "☕", label: "Kelola Menu" },
  { href: "/admin/meja", icon: "🪑", label: "Kelola Meja" },
  { href: "/admin/pengguna", icon: "👥", label: "Kelola Pengguna" },
  { href: "/admin/qris", icon: "🔳", label: "Kelola QRIS Pembayaran" },
];

function formatJamMenit(d: Date) {
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${jam}:${menit}`;
}

function useLiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(formatJamMenit(new Date()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

export default function AdminShell({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();

  const [showChPass, setShowChPass] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const clock = useLiveClock();

  // tutup drawer otomatis tiap kali pindah halaman
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function logout() {
    if (isLoggingOut) return; // cegah double-submit
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        showToast({
          type: "error",
          title: "Gagal keluar",
          detail: "Terjadi masalah saat mengakhiri sesi. Silakan coba lagi.",
        });
        return;
      }
      router.push("/admin/login");
      router.refresh();
    } catch {
      showToast({
        type: "error",
        title: "Koneksi bermasalah",
        detail: "Gagal menghubungi server. Periksa koneksi internet Anda.",
      });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  }

  return (
    <div className="app-wrap-admin" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="menu-toggle"
            aria-label="Buka menu"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>Coffeebox_Jkt</div>
            <div style={{ fontSize: 9, color: "var(--gl)", opacity: 0.5, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>Dashboard Admin</div>
          </div>
        </div>
        <div className="tr">
          <span className="tu">Halo, <strong>{session.namaLengkap}</strong></span>
          <span className="tbdg">⭐ {session.levelAdmin === 1 ? "Super Admin" : "Admin"}</span>
          <span className="tclk" style={{ marginRight: 8 }} suppressHydrationWarning>{clock}</span>
        </div>
      </header>
      <div className="main">
        <div
          className={`sidebar-overlay${sidebarOpen ? " show" : ""}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <nav className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sidebar-section">
            <div className="ns">Menu</div>
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className={`ni${pathname === m.href ? " on" : ""}`}>
                <span style={{ fontSize: 15 }}>{m.icon}</span><span>{m.label}</span>
              </Link>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="ns">Kelola</div>
            {KELOLA.map((m) => (
              <Link key={m.href} href={m.href} className={`ni${pathname === m.href ? " on" : ""}`}>
                <span style={{ fontSize: 15 }}>{m.icon}</span><span>{m.label}</span>
              </Link>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="ni" onClick={() => setShowChPass(true)}>
              <span style={{ fontSize: 15 }}>🔑</span><span>Ubah Password</span>
            </div>
            <div className="ni danger" onClick={() => setShowLogoutConfirm(true)}>
              <span style={{ fontSize: 15 }}>🚪</span><span>Logout</span>
            </div>
          </div>
        </nav>
        <main className="content">{children}</main>
      </div>

      <ChangePasswordModal
        open={showChPass}
        onClose={() => setShowChPass(false)}
        onSuccess={() => {

          setShowChPass(false);
        }}
      />

      <ConfirmDialog
        open={showLogoutConfirm}
        variant="warning"
        title="Keluar dari akun?"
        description="Anda akan keluar dari sesi Admin saat ini dan perlu login kembali untuk mengakses dashboard."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        isLoading={isLoggingOut}
        onConfirm={logout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
