"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ChangePasswordModal from "./ChangePasswordModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function KasirShell({
  namaKasir,
  children,
}: {
  namaKasir: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [showChangePass, setShowChangePass] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      router.push("/kasir/login");
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
    <div
      className="app-wrap"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Topbar namaKasir={namaKasir} onMenuClick={() => setSidebarOpen((o) => !o)} />
      <div className="main">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenChangePassword={() => setShowChangePass(true)}
          onOpenLogoutConfirm={() => setShowLogoutConfirm(true)}
        />
        <main className="content">{children}</main>
      </div>

      <ChangePasswordModal
        open={showChangePass}
        onClose={() => setShowChangePass(false)}
        onSuccess={() => {
          // Toast sukses ditangani di dalam ChangePasswordModal sendiri,
          // di sini cukup tutup modal supaya tidak dobel notifikasi.
          setShowChangePass(false);
        }}
      />

      <ConfirmDialog
        open={showLogoutConfirm}
        variant="warning"
        title="Keluar dari akun?"
        description="Anda akan keluar dari sesi Kasir saat ini dan perlu login kembali untuk mengakses dashboard."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        isLoading={isLoggingOut}
        onConfirm={logout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
