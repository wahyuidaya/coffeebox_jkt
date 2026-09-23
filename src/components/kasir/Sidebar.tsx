"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const MENU_ITEMS = [
  { href: "/kasir/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/kasir/pesanan-masuk", icon: "📋", label: "Pesanan Masuk" },
  { href: "/kasir/riwayat", icon: "🕐", label: "Riwayat" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChangePassword: () => void;
  onOpenLogoutConfirm: () => void;
}

export default function Sidebar({ isOpen, onClose, onOpenChangePassword, onOpenLogoutConfirm }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* overlay gelap di belakang drawer, cuma muncul di mobile saat isOpen */}
      <div
        className={`sidebar-overlay${isOpen ? " show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <nav className={`sidebar${isOpen ? " open" : ""}`}>
        <div className="sidebar-section">
          <div className="ns">Menu</div>
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`ni${pathname === item.href ? " on" : ""}`}
              onClick={onClose}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="sidebar-section">
          <div className="ns">Informasi</div>
          <Link
            href="/kasir/panduan"
            className={`ni${pathname === "/kasir/panduan" ? " on" : ""}`}
            onClick={onClose}
          >
            <span style={{ fontSize: 15 }}>📖</span>
            <span>Panduan Alur</span>
          </Link>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-section" style={{ padding: "0 0px" }}>
            <div
              className="ni"
              onClick={() => {
                onClose();
                onOpenChangePassword();
              }}
            >
              <span style={{ fontSize: 15 }}>🔑</span>
              <span>Ubah Password</span>
            </div>
          </div>
          <div
            className="ni danger"
            onClick={() => {
              onClose();
              onOpenLogoutConfirm();
            }}
          >
            <span style={{ fontSize: 15 }}>🚪</span>
            <span>Logout</span>
          </div>
        </div>
      </nav>
    </>
  );
}
