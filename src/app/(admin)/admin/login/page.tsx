"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

const MAX_USERNAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 100;

export default function AdminLoginPage() {
  const router = useRouter();
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateForm(): string | null {
    if (uname.trim().length === 0) return "Username wajib diisi.";
    if (pass.length === 0 || pass.trim().length === 0) return "Password wajib diisi.";
    return null;
  }

  async function doLogin() {
    if (loading) return;
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname.trim(), password: pass, peran: "admin" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Username atau password salah.");
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">Coffeebox_Jkt</div>
        <div className="login-sub">Login Admin</div>
        {error && <div className="login-err">{error}</div>}

        <input
          className="login-inp"
          placeholder="Username"
          type="text"
          autoComplete="off"
          maxLength={MAX_USERNAME_LENGTH}
          value={uname}
          disabled={loading}
          onChange={(e) => setUname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />

        <div className="pw-toggle">
          <input
            className="login-inp login-inp-nomargin"
            placeholder="Password"
            type={showPass ? "text" : "password"}
            maxLength={MAX_PASSWORD_LENGTH}
            style={{ paddingRight: pass.length > 0 ? 44 : undefined }}
            value={pass}
            disabled={loading}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
            {pass.length > 0 && (
              <button
                type="button"
                className="pw-toggle-btn"
                onClick={() => setShowPass((s) => !s)}
                disabled={loading}
                aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
        </div>

        <button className="login-btn" style={{ marginTop: 14 }} onClick={doLogin} disabled={loading}>
          {loading ? "Memproses..." : "Login"}
        </button>

        <div className="login-footer">
          <span className="login-footer-txt">Lupa password? </span>
          <Link href="/admin/forgot-password" className="login-footer-link">Klik di sini</Link>
        </div>
      </div>
    </div>
  );
}