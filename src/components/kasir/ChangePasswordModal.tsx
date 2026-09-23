"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangePasswordModal({ open, onClose, onSuccess }: Props) {
  const { showToast } = useToast();

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [strength, setStrength] = useState({ width: "0%", color: "var(--bd)" });

  function checkStrength(p: string) {
    if (!p) {
      setStrength({ width: "0%", color: "var(--bd)" });
      return;
    }
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const levels = ["#EF5350", "#FF7043", "#FFB300", "#66BB6A", "#2E7D32"];
    setStrength({ width: `${(Math.min(score, 4) + 1) * 20}%`, color: levels[Math.min(score, 4)] });
  }

  function resetForm() {
    setOldPass("");
    setNewPass("");
    setConfirmPass("");
    setError("");
    setStrength({ width: "0%", color: "var(--bd)" });
  }

  function handleClose() {
    if (isSubmitting) return; // cegah tutup modal saat proses masih berjalan
    resetForm();
    onClose();
  }

  // Validasi di client dulu, supaya user langsung dapat feedback jelas
  // tanpa perlu round-trip ke server untuk kesalahan yang bisa dideteksi
  // di sisi ini. Validasi di server TETAP ada sebagai lapisan wajib
  // (lihat route.ts) karena validasi client saja bisa dilewati.
  function validateClientSide(): string | null {
    if (!oldPass) {
      return "Password lama wajib diisi.";
    }
    if (newPass.length < 8) {
      return "Password baru minimal 8 karakter.";
    }
    const hasLetter = /[A-Za-z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    if (!hasLetter || !hasNumber) {
      return "Password baru harus kombinasi huruf dan angka.";
    }
    if (newPass !== confirmPass) {
      return "Konfirmasi password tidak cocok dengan password baru.";
    }
    if (newPass === oldPass) {
      return "Password baru tidak boleh sama dengan password lama.";
    }
    return null;
  }

  async function save() {
    if (isSubmitting) return; // cegah double-submit

    setError("");
    const clientError = validateClientSide();
    if (clientError) {
      setError(clientError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordLama: oldPass, passwordBaru: newPass, konfirmasiPassword: confirmPass }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Gagal mengubah password. Silakan coba lagi.");
        return;
      }

      showToast({
        type: "success",
        title: "Password berhasil diubah",
        detail: "Gunakan password baru untuk login berikutnya.",
      });
      resetForm();
      onSuccess();
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`mo${open ? " open" : ""}`}>
      <div className="mbox" style={{ maxWidth: 400 }}>
        <button className="mclose" onClick={handleClose} disabled={isSubmitting}>
          ✕
        </button>
        <div className="mttl">Ubah Password</div>

        <div style={{ marginBottom: 13 }}>
          <label style={{ fontSize: 11, color: "var(--tm)", display: "block", marginBottom: 4 }}>Password Lama</label>
          <div style={{ position: "relative" }}>
            <input
              className="login-inp"
              type={showOldPass ? "text" : "password"}
              placeholder="Password saat ini"
              style={{ paddingRight: oldPass.length > 0 ? 44 : undefined }}
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              disabled={isSubmitting}
            />
            {oldPass.length > 0 && (
              <span
                onClick={() => setShowOldPass((s) => !s)}
                style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-60%)", fontSize: 15, color: "var(--tm)", cursor: "pointer", opacity: 0.6 }}
              >
                👁
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 13 }}>
          <label style={{ fontSize: 11, color: "var(--tm)", display: "block", marginBottom: 4 }}>Password Baru</label>
          <div style={{ position: "relative" }}>
            <input
              className="login-inp"
              type={showNewPass ? "text" : "password"}
              placeholder="Min. 8 karakter, kombinasi huruf dan angka"
              style={{ paddingRight: newPass.length > 0 ? 44 : undefined }}
              value={newPass}
              onChange={(e) => {
                setNewPass(e.target.value);
                checkStrength(e.target.value);
              }}
              disabled={isSubmitting}
            />
            {newPass.length > 0 && (
              <span
                onClick={() => setShowNewPass((s) => !s)}
                style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-60%)", fontSize: 15, color: "var(--tm)", cursor: "pointer", opacity: 0.6 }}
              >
                👁
              </span>
            )}
          </div>
          <div className="pass-strength" style={{ width: strength.width, background: strength.color }} />
        </div>

        <div style={{ marginBottom: 13 }}>
          <label style={{ fontSize: 11, color: "var(--tm)", display: "block", marginBottom: 4 }}>Konfirmasi Password Baru</label>
          <div style={{ position: "relative" }}>
            <input
              className="login-inp"
              type={showConfirmPass ? "text" : "password"}
              placeholder="Ulangi password baru"
              style={{ paddingRight: confirmPass.length > 0 ? 44 : undefined }}
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              disabled={isSubmitting}
            />
            {confirmPass.length > 0 && (
              <span
                onClick={() => setShowConfirmPass((s) => !s)}
                style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-60%)", fontSize: 15, color: "var(--tm)", cursor: "pointer", opacity: 0.6 }}
              >
                👁
              </span>
            )}
          </div>
        </div>

        {error && <div className="login-err" style={{ display: "block" }}>{error}</div>}
        <div className="mbtns">
          <button className="mbtn mbtn-pri" onClick={save} disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan Password"}
          </button>
          <button className="mbtn mbtn-sec" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}