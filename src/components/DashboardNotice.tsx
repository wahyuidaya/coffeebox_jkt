"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ChangePasswordModal from "@/components/kasir/ChangePasswordModal";

interface Props {
  wajibGantiPassword: boolean;
  peran: "admin" | "kasir";
  email: string | null;
}

export function DashboardNotice({ wajibGantiPassword, peran, email }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const showEmailNotice = peran === "admin" && !email;

  function handleSuccess() {
    setModalOpen(false);
    router.refresh(); // supaya wajibGantiPassword ke-update jadi false tanpa perlu logout-login
  }

  if (!wajibGantiPassword && !showEmailNotice) return null;

  return (
    <>
      <style>{`
        @keyframes cbxAlertPulse {
          0%   { box-shadow: 0 0 0 0 rgba(198,40,40,0.28); }
          70%  { box-shadow: 0 0 0 8px rgba(198,40,40,0); }
          100% { box-shadow: 0 0 0 0 rgba(198,40,40,0); }
        }
        .cbx-alert-btn { animation: cbxAlertPulse 2s infinite; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {wajibGantiPassword && (
          <button
            className="cbx-alert-btn"
            onClick={() => setModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 12,
              background: "#FFF3E0", color: "#B71C1C",
              border: "2px solid #E65100",
              fontSize: 13, textAlign: "left", cursor: "pointer", width: "100%",
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🚨</span>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-block", fontSize: 10, fontWeight: 700,
                  background: "#C62828", color: "#fff", padding: "2px 8px",
                  borderRadius: 999, marginBottom: 5, letterSpacing: 0.4,
                }}
              >
                WAJIB DILAKUKAN
              </span>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "#B71C1C" }}>
                Anda masih menggunakan password default
              </div>
              <div style={{ fontSize: 11.5, color: "#8D3A0D", marginTop: 2 }}>
                Demi keamanan akun, segera ganti password Anda. Klik di sini untuk mengganti sekarang.
              </div>
            </span>
            <span style={{ fontSize: 18, flexShrink: 0 }}>›</span>
          </button>
        )}

        {showEmailNotice && (
          <Link
            href="/admin/pengguna?edit=me"
            className="cbx-alert-btn"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 12,
              background: "#FFEBEE", color: "#C62828",
              border: "2px solid #C62828",
              fontSize: 13, textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🚨</span>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-block", fontSize: 10, fontWeight: 700,
                  background: "#C62828", color: "#fff", padding: "2px 8px",
                  borderRadius: 999, marginBottom: 5, letterSpacing: 0.4,
                }}
              >
                WAJIB DILENGKAPI
              </span>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "#C62828" }}>
                Email akun Anda belum diisi
              </div>
              <div style={{ fontSize: 11.5, color: "#8D3A0D", marginTop: 2 }}>
                Email wajib dilengkapi untuk verifikasi saat fitur "Lupa Password". Klik untuk melengkapinya.
              </div>
            </span>
            <span style={{ fontSize: 18, flexShrink: 0 }}>›</span>
          </Link>
        )}
      </div>

      <ChangePasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}