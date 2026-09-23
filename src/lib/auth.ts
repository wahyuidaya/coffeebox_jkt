import bcrypt from "bcryptjs";
import type { Peran } from "@prisma/client";
import { prisma } from "./prisma";
import { createSession, deleteSession, getSession } from "./session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Hash statis (bukan dari akun asli manapun) dipakai untuk "membakar" waktu
// saat user tidak ditemukan / tidak aktif, supaya waktu respons konsisten
// dengan kasus password salah pada user yang valid. Ini mencegah timing attack
// yang bisa dipakai untuk menebak username mana saja yang terdaftar di sistem.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Fp4/O3S4ELE7dCOqLC7RTKfEjR2Ku";

type LoginResult =
  | { success: true; wajibGantiPassword: boolean; peran: Peran }
  | { success: false; message: string };

export async function login(
  username: string,
  password: string,
  expectedPeran?: Peran
): Promise<LoginResult> {
  const user = await prisma.pengguna.findUnique({ where: { username } });

  if (!user || !user.statusAktif) {
    // Tetap jalankan bcrypt.compare (terhadap hash palsu) supaya waktu respons
    // sama dengan kasus username valid + password salah.
    await verifyPassword(password, DUMMY_HASH);
    return { success: false, message: "Username atau password salah." };
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return { success: false, message: "Username atau password salah." };
  }

  // Validasi role: pastikan user login di halaman yang sesuai dengan perannya.
  // Pesan sengaja dibuat GENERIK (sama seperti kegagalan lain) walau kredensial
  // sebenarnya benar, supaya tidak membocorkan info "kombinasi ini valid untuk role lain"
  // ke pihak yang mencoba menebak kredensial lewat portal yang salah.
  if (expectedPeran && user.peran !== expectedPeran) {
    return { success: false, message: "Username atau password salah." };
  }

  await createSession({
    id: user.id,
    username: user.username,
    namaLengkap: user.namaLengkap,
    peran: user.peran,
    levelAdmin: user.levelAdmin,
  });

  return {
    success: true,
    wajibGantiPassword: user.wajibGantiPassword,
    peran: user.peran,
  };
}

export async function logout() {
  await deleteSession();
}

export async function requireAuth(peranYangDiizinkan?: Peran[]) {
  const session = await getSession();
  if (!session) return null;
  if (peranYangDiizinkan && !peranYangDiizinkan.includes(session.peran)) {
    return null;
  }
  return session;
}

type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>;

type AuthCheckResult =
  | { ok: true; session: SessionData }
  | { ok: false; status: 401; message: string }
  | { ok: false; status: 403; message: string };

/**
 * Sama seperti requireAuth, tapi membedakan "belum login" (401) vs
 * "login tapi role tidak diizinkan" (403). Dibuat terpisah supaya
 * TIDAK mengubah requireAuth yang sudah dipakai di route-route lain.
 * Aman dipakai bertahap — pakai ini di route baru yang butuh pembedaan status.
 */
export async function requireAuthDetailed(
  peranYangDiizinkan?: Peran[]
): Promise<AuthCheckResult> {
  const session = await getSession();

  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "Sesi Anda telah berakhir. Silakan login kembali.",
    };
  }

  if (peranYangDiizinkan && !peranYangDiizinkan.includes(session.peran)) {
    return {
      ok: false,
      status: 403,
      message: "Anda tidak memiliki akses ke halaman ini.",
    };
  }

  return { ok: true, session };
}

/**
 * Kekuatan password sederhana untuk indikator di halaman Ubah Password Kasir.
 * Mengembalikan skor 0-4. CATATAN: ini hanya untuk indikator visual (meter),
 * BUKAN validator final. Validasi wajib "min 8 karakter + kombinasi huruf & angka"
 * harus tetap dicek terpisah (fungsi validator sendiri) di halaman Register/Ubah Password.
 */
export function checkPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}