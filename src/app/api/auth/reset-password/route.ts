// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createHash } from "crypto";

const MAX_PASSWORD_LENGTH = 100;
const MAX_TOKEN_LENGTH = 128; // token hex dari randomBytes(32) = 64 karakter, beri margin aman

// Rate limiting sederhana per IP: max 10 percobaan per 15 menit.
// Token sudah 256-bit acak (praktis mustahil ditebak), ini cuma lapisan tambahan.
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function getClientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordAttempt(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validatePassword(pass: string): string | null {
  if (pass.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (pass.length > MAX_PASSWORD_LENGTH) {
    return `Password maksimal ${MAX_PASSWORD_LENGTH} karakter.`;
  }
  const hasLetter = /[A-Za-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  if (!hasLetter || !hasNumber) {
    return "Password harus kombinasi huruf dan angka.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rateLimitKey = getClientKey(req);
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  const { token, passwordBaru } = body as Record<string, unknown>;

  if (typeof token !== "string" || typeof passwordBaru !== "string") {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    recordAttempt(rateLimitKey);
    return NextResponse.json(
      { message: "Link reset password tidak valid atau sudah kedaluwarsa." },
      { status: 400 }
    );
  }

  const passwordError = validatePassword(passwordBaru);
  if (passwordError) {
    return NextResponse.json({ message: passwordError }, { status: 400 });
  }

  const hashedToken = hashToken(token);

  const user = await prisma.pengguna.findFirst({
    where: { resetToken: hashedToken, resetTokenExpiry: { gte: new Date() } },
  });

  if (!user) {
    recordAttempt(rateLimitKey);
    return NextResponse.json(
      { message: "Link reset password tidak valid atau sudah kedaluwarsa." },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(passwordBaru);

  await prisma.pengguna.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetToken: null,
      resetTokenExpiry: null,
      wajibGantiPassword: false,
    },
  });

  return NextResponse.json({ message: "Password berhasil diubah." });
}