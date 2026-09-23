// src/app/kasir/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function KasirLoginPage() {
  const router = useRouter();
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (loading) return; // cegah double-submit (Enter berkali-kali / klik cepat)

    const trimmedUname = uname.trim();
    if (!trimmedUname || !pass) {
      setError("Username dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUname, password: pass, peran: "kasir" }),
      });

      let data: { message?: string; wajibGantiPassword?: boolean; peran?: string } = {};
      try {
        data = await res.json();
      } catch {
        // respons bukan JSON valid (mis. error 500 HTML dari server)
      }

      if (!res.ok) {
        setError(data.message || "Username atau password salah.");
        return;
      }

      // Langsung ke dashboard, terlepas dari status wajibGantiPassword.
      // Notice untuk ganti password akan muncul di dalam dashboard.
      router.push("/kasir/dashboard");
      router.refresh();
    } catch {
      // fetch gagal total: server tidak terjangkau / koneksi putus
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen" style={{ display: "flex" }}>
      <div className="login-box">
        <div className="login-logo">Coffeebox_Jkt</div>
        <div className="login-sub">Login Kasir</div>

        {error && (
          <div className="login-err" style={{ display: "block" }} role="alert">
            {error}
          </div>
        )}

        <input
          className="login-inp"
          placeholder="Username"
          type="text"
          autoComplete="off"
          value={uname}
          disabled={loading}
          onChange={(e) => setUname(e.target.value)}
        />

        <div style={{ position: "relative" }}>
          <input
            className="login-inp"
            placeholder="Password"
            type={showPass ? "text" : "password"}
            style={{ marginBottom: 0, paddingRight: pass.length > 0 ? 44 : undefined }}
            value={pass}
            disabled={loading}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
          {pass.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              disabled={loading}
              aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                padding: 4,
                color: "var(--tm)",
                cursor: "pointer",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
              }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        <button
          className="login-btn"
          style={{ marginTop: 14 }}
          onClick={doLogin}
          disabled={loading || !uname.trim() || !pass}
        >
          {loading ? "Memproses..." : "Login"}
        </button>
      </div>
    </div>
  );
}