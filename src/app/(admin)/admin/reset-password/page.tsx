"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MAX_PASSWORD_LENGTH = 100;

function validateNewPassword(pass: string): string | null {
  if (pass.length < 8) return "Password minimal 8 karakter.";
  if (pass.length > MAX_PASSWORD_LENGTH) return `Password maksimal ${MAX_PASSWORD_LENGTH} karakter.`;
  const hasLetter = /[A-Za-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  if (!hasLetter || !hasNumber) return "Password harus kombinasi huruf dan angka.";
  return null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (loading) return;

    const passwordError = validateNewPassword(newPass);
    if (passwordError) { setError(passwordError); return; }
    if (newPass !== confirmPass) { setError("Konfirmasi password tidak cocok dengan password baru."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passwordBaru: newPass }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Gagal mengubah password. Silakan coba lagi.");
        return;
      }

      setDone(true);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-box login-box-center">
          <div className="login-emoji-lg">⚠️</div>
          <div className="login-logo" style={{ marginBottom: 8 }}>Link Tidak Valid</div>
          <div className="login-desc-lg">Link reset password tidak lengkap atau sudah kadaluarsa. Silakan minta link baru.</div>
          <button className="login-btn" onClick={() => router.push("/admin/forgot-password")}>Minta Link Baru</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="login-screen">
        <div className="login-box login-box-center">
          <div className="login-emoji-lg">✅</div>
          <div className="login-logo" style={{ marginBottom: 8 }}>Password Berhasil Diubah!</div>
          <div className="login-desc-lg">Password kamu sudah diubah. Silakan login kembali menggunakan password baru.</div>
          <button className="login-btn" onClick={() => router.push("/admin/login")}>Kembali ke Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-header">
          <div className="login-emoji-md">🔐</div>
          <div className="login-logo">Ubah Password</div>
          <div className="login-desc">Masukkan password baru untuk akun kamu.</div>
        </div>

        <div className="pw-toggle">
          <input
            className="login-inp"
            type={showNewPass ? "text" : "password"}
            placeholder="Min. 8 karakter, kombinasi huruf & angka"
            maxLength={MAX_PASSWORD_LENGTH}
            style={{ paddingRight: newPass.length > 0 ? 44 : undefined }}
            value={newPass}
            disabled={loading}
            onChange={(e) => setNewPass(e.target.value)}
          />
          {newPass.length > 0 && (
            <button
              type="button"
              className="pw-toggle-btn"
              onClick={() => setShowNewPass((s) => !s)}
              disabled={loading}
              aria-label={showNewPass ? "Sembunyikan password" : "Tampilkan password"}
            >
              👁
            </button>
          )}
        </div>

        <div className="pw-toggle">
          <input
            className="login-inp"
            type={showConfirmPass ? "text" : "password"}
            placeholder="Ulangi password baru"
            maxLength={MAX_PASSWORD_LENGTH}
            style={{ paddingRight: confirmPass.length > 0 ? 44 : undefined }}
            value={confirmPass}
            disabled={loading}
            onChange={(e) => setConfirmPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {confirmPass.length > 0 && (
            <button
              type="button"
              className="pw-toggle-btn"
              onClick={() => setShowConfirmPass((s) => !s)}
              disabled={loading}
              aria-label={showConfirmPass ? "Sembunyikan password" : "Tampilkan password"}
            >
              👁
            </button>
          )}
        </div>

        {error && <div className="login-err">{error}</div>}
        <button className="login-btn" onClick={submit} disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Password Baru"}
        </button>
      </div>
    </div>
  );
}