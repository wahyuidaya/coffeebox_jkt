"use client";

import { useState } from "react";
import Link from "next/link";

const MAX_EMAIL_LENGTH = 50; // selaras dengan Pengguna.email @db.VarChar(50)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) return "Email wajib diisi.";
  if (!EMAIL_REGEX.test(trimmed)) return "Format email tidak valid.";
  if (trimmed.length > MAX_EMAIL_LENGTH) return `Email maksimal ${MAX_EMAIL_LENGTH} karakter.`;
  return null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;

    const validationError = validateEmail(email);
    if (validationError) { setError(validationError); setSuccess(""); return; }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Terjadi kesalahan. Silakan coba lagi.");
        return;
      }

      setSuccess(
        data?.message ||
          "Jika email terdaftar di sistem kami, link untuk mengubah password telah dikirim. Silakan cek kotak masuk (dan folder spam) email Anda."
      );
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-header">
          <div className="login-emoji-md">🔑</div>
          <div className="login-logo">Lupa Password?</div>
          <div className="login-desc">Masukkan email kamu. Kami akan mengirimkan link untuk merubah password.</div>
        </div>

        {error && <div className="login-err">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <input
          className="login-inp"
          type="email"
          placeholder="Masukkan email anda"
          maxLength={MAX_EMAIL_LENGTH}
          value={email}
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="login-btn" onClick={submit} disabled={loading}>
          {loading ? "Mengirim..." : "Kirim Link Ubah Password"}
        </button>

        <div className="login-footer">
          <Link href="/admin/login" className="login-footer-link">Kembali ke login</Link>
        </div>
      </div>
    </div>
  );
}