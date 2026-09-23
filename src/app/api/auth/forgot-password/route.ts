// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";

const MAX_EMAIL_LENGTH = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pesan & status code SELALU SAMA baik email terdaftar maupun tidak,
// supaya endpoint ini tidak bisa dipakai untuk menebak email mana saja
// yang terdaftar di sistem (user enumeration).
const GENERIC_SUCCESS_MESSAGE =
  "Jika email terdaftar di sistem kami, link untuk mengubah password telah dikirim. Silakan cek kotak masuk (dan folder spam) email Anda.";

// Rate limiting sederhana in-memory per (IP + email): max 3 percobaan per 15 menit.
// CATATAN: sama seperti di login, ini hanya efektif single-instance.
// Kalau deploy multi-instance/serverless, pindahkan ke store persisten (Redis/DB).
const requestAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

function getClientKey(req: NextRequest, email: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${email.toLowerCase()}`;
}

function isRateLimited(key: string): boolean {
  const entry = requestAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    requestAttempts.delete(key);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordAttempt(key: string): void {
  const entry = requestAttempts.get(key);
  if (!entry || Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    requestAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildResetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>Reset Password</h2>
      <p>Kami menerima permintaan untuk reset password akun kamu. Klik tombol di bawah untuk melanjutkan:</p>
      <a href="${resetUrl}" style="display:inline-block; padding:10px 20px; background:#4F46E5; color:#fff; text-decoration:none; border-radius:6px;">
        Reset Password
      </a>
      <p style="margin-top:16px; font-size:14px; color:#555;">
        Atau salin link berikut ke browser kamu:<br/>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="font-size:13px; color:#888;">Link ini berlaku selama 1 jam. Kalau kamu tidak merasa meminta reset password, abaikan email ini.</p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  const { email } = body as Record<string, unknown>;

  if (typeof email !== "string") {
    return NextResponse.json({ message: "Email wajib diisi." }, { status: 400 });
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0 || !EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > MAX_EMAIL_LENGTH) {
    // Format salah = kesalahan input murni, aman dikasih pesan spesifik
    // (ini beda kategori dari "email ini terdaftar atau tidak").
    return NextResponse.json({ message: "Format email tidak valid." }, { status: 400 });
  }

  const rateLimitKey = getClientKey(req, trimmedEmail);
  if (isRateLimited(rateLimitKey)) {
    // Pesan rate-limit ini boleh spesifik: tidak membocorkan status akun,
    // cuma memberi tahu bahwa permintaan sedang dibatasi.
    return NextResponse.json(
      { message: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit." },
      { status: 429 }
    );
  }
  recordAttempt(rateLimitKey);

  const user = await prisma.pengguna.findFirst({
    where: { email: trimmedEmail, peran: "admin" },
  });

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = hashToken(rawToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await prisma.pengguna.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExpiry: expiry },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/reset-password?token=${rawToken}`;

    // Sengaja TIDAK di-await: supaya waktu respons endpoint ini tidak berbeda
    // signifikan antara "email ditemukan" (kirim email, network call lambat)
    // vs "email tidak ditemukan" (skip). Kalau di-await, perbedaan waktu itu
    // sendiri jadi celah timing attack untuk menebak email terdaftar.
    // Error pengiriman email dicatat di log server, TIDAK dikirim ke client,
    // supaya tidak membocorkan status akun lewat perbedaan response.
    void transporter
      .sendMail({
        from: process.env.SMTP_FROM,
        to: trimmedEmail,
        subject: "Reset Password Akun Kamu",
        html: buildResetEmailHtml(resetUrl),
      })
      .catch((err) => {
        console.error("Gagal mengirim email reset password:", err);
      });
  } else {
    // "Bakar" waktu CPU yang setara dengan proses hash token di atas,
    // supaya waktu respons konsisten baik email ditemukan maupun tidak.
    hashToken(randomBytes(32).toString("hex"));
  }

  return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
}