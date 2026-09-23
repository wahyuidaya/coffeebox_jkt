import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { Peran } from "@prisma/client";

const MAX_USERNAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 100;

// Rate limiting sederhana in-memory: max 5 percobaan gagal per 15 menit per (IP + username).
// CATATAN: ini hanya efektif untuk single-instance server (misal dev/VPS kecil).
// Kalau nanti deploy multi-instance/serverless, ini WAJIB dipindah ke store persisten (Redis/DB),
// karena in-memory Map tidak dibagi antar instance/proses.
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function getClientKey(req: NextRequest, username: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${username.toLowerCase()}`;
}

function isRateLimited(key: string): boolean {
  const entry = loginAttempts.get(key);
  if (!entry) return false;

  const isWindowExpired = Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS;
  if (isWindowExpired) {
    loginAttempts.delete(key);
    return false;
  }

  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordFailedAttempt(key: string): void {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const { username, password, peran } = body as Record<string, unknown>;

  if (typeof username !== "string" || typeof password !== "string" || typeof peran !== "string") {
    return NextResponse.json(
      { message: "Username, password, dan peran wajib diisi dengan benar." },
      { status: 400 }
    );
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length === 0 || password.length === 0) {
    return NextResponse.json(
      { message: "Username dan password wajib diisi." },
      { status: 400 }
    );
  }

  if (trimmedUsername.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { message: "Username atau password melebihi batas panjang yang diizinkan." },
      { status: 400 }
    );
  }

  if (!Object.values(Peran).includes(peran as Peran)) {
    return NextResponse.json(
      { message: "Peran tidak valid." },
      { status: 400 }
    );
  }

  const rateLimitKey = getClientKey(req, trimmedUsername);

  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit." },
      { status: 429 }
    );
  }

  const result = await login(trimmedUsername, password, peran as Peran);

  if (!result.success) {
    recordFailedAttempt(rateLimitKey);
    // Pesan sengaja generik (tidak membedakan username tidak ada vs password salah).
    return NextResponse.json({ message: result.message }, { status: 401 });
  }

  clearAttempts(rateLimitKey);

  return NextResponse.json({
    wajibGantiPassword: result.wajibGantiPassword,
    peran: result.peran,
  });
}