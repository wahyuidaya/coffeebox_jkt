import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Peran } from "@prisma/client";

const MIN_SECRET_LENGTH = 32; // minimal ~256-bit untuk keamanan HS256 yang wajar

const secretKey = process.env.JWT_SECRET;

if (!secretKey || secretKey.length < MIN_SECRET_LENGTH) {
  // Gagal cepat dan jelas saat startup, daripada diam-diam jalan dengan secret
  // kosong/lemah yang bisa membuat token session dipalsukan.
  throw new Error(
    `JWT_SECRET tidak diset atau terlalu pendek (minimal ${MIN_SECRET_LENGTH} karakter). ` +
      "Set environment variable JWT_SECRET dengan string acak yang panjang dan aman."
  );
}

const encodedKey = new TextEncoder().encode(secretKey);

const DEFAULT_SESSION_DURATION = "8h";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || DEFAULT_SESSION_DURATION;

/**
 * Parse string durasi sederhana ("8h", "30m", "1d", "3600s") jadi detik.
 * Dipakai supaya maxAge cookie selalu sinkron dengan masa berlaku JWT,
 * berapa pun nilai JWT_EXPIRES_IN diubah lewat env.
 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) {
    // Format tidak dikenali: fallback aman ke default 8 jam.
    return 60 * 60 * 8;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1, m: 60, h: 60 * 60, d: 60 * 60 * 24 }[unit] ?? 1;
  return value * multiplier;
}

const SESSION_MAX_AGE_SECONDS = parseDurationToSeconds(jwtExpiresIn);

export type SessionPayload = {
  id: number;
  username: string;
  namaLengkap: string;
  peran: Peran;
  levelAdmin: number | null;
};

const COOKIE_NAME = "cbx_session";

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(jwtExpiresIn)
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encrypt(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decrypt(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  // path eksplisit disamakan dengan saat cookie dibuat, supaya browser
  // mengenalinya sebagai cookie yang sama persis dan benar-benar terhapus.
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { COOKIE_NAME };