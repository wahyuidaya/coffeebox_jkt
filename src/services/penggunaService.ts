import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { SessionUser } from "@/types/pengguna";
import { TRANSAKSI_SELESAI } from "@/services/transaksiService";

// Batas ini WAJIB sinkron dengan schema.prisma (model Pengguna):
// namaLengkap @db.VarChar(50), username @db.VarChar(25), noTelepon @db.VarChar(16), email @db.VarChar(50)
const NAMA_MAX_LEN = 50;
const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 25;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const NO_TELEPON_MAX_LEN = 16;
const EMAIL_MAX_LEN = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateNamaLengkap(nama: string): string {
  const trimmed = nama.trim();
  if (!trimmed) throw new Error("Nama lengkap wajib diisi.");
  if (trimmed.length > NAMA_MAX_LEN) throw new Error(`Nama lengkap maksimal ${NAMA_MAX_LEN} karakter.`);
  return trimmed;
}

function validateUsernameFormat(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) throw new Error("Username wajib diisi.");
  if (trimmed.length < USERNAME_MIN_LEN) throw new Error(`Username minimal ${USERNAME_MIN_LEN} karakter.`);
  if (trimmed.length > USERNAME_MAX_LEN) throw new Error(`Username maksimal ${USERNAME_MAX_LEN} karakter.`);
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new Error("Username hanya boleh berisi huruf, angka, titik, dan garis bawah, tanpa spasi.");
  }
  return trimmed;
}

/** Nomor telepon bersifat opsional (schema String?) — divalidasi hanya kalau diisi. */
function validateNoTeleponFormat(noTelepon: string): string {
  const trimmed = noTelepon.trim();
  if (!trimmed) return "";
  if (trimmed.length > NO_TELEPON_MAX_LEN) throw new Error(`Nomor telepon maksimal ${NO_TELEPON_MAX_LEN} karakter.`);
  if (!trimmed.startsWith("08") && !trimmed.startsWith("+62")) {
    throw new Error('Nomor telepon harus diawali "08" atau "+62".');
  }
  const digitPart = trimmed.replace("+", "");
  if (!/^[0-9]+$/.test(digitPart)) throw new Error("Nomor telepon hanya boleh berisi angka.");
  if (digitPart.length < 10 || digitPart.length > 13) {
    throw new Error("Nomor telepon harus terdiri dari 10-13 digit.");
  }
  return trimmed;
}

/** Email bersifat opsional (diisi belakangan oleh Admin sendiri) — divalidasi hanya kalau diisi. */
function validateEmailFormat(email: string | null | undefined): string | null {
  if (email === null || email === undefined) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (trimmed.length > EMAIL_MAX_LEN) throw new Error(`Email maksimal ${EMAIL_MAX_LEN} karakter.`);
  if (!EMAIL_PATTERN.test(trimmed)) throw new Error("Format email tidak valid.");
  return trimmed;
}

// ────────────────────────────────────────────────
// SELF-SERVICE (Fase 3) — dipakai Kasir & Admin
// ────────────────────────────────────────────────

export async function ubahPasswordSendiri(
  idPengguna: number,
  passwordLama: string,
  passwordBaru: string
) {
  const user = await prisma.pengguna.findUnique({ where: { id: idPengguna } });
  if (!user) throw new Error("Pengguna tidak ditemukan.");

  const cocok = await verifyPassword(passwordLama, user.password);
  if (!cocok) throw new Error("Password lama salah.");
  if (passwordBaru.length < 8) throw new Error("Password baru minimal 8 karakter.");
  if (!/[a-zA-Z]/.test(passwordBaru) || !/[0-9]/.test(passwordBaru)) {
    throw new Error("Password baru harus kombinasi huruf dan angka.");
  }

  const hashed = await hashPassword(passwordBaru);
  return prisma.pengguna.update({
    where: { id: idPengguna },
    data: { password: hashed, wajibGantiPassword: false },
  });
}

// ────────────────────────────────────────────────
// SISI ADMIN (Fase 4) — Kelola Pengguna
// ────────────────────────────────────────────────

export async function getAllPenggunaForAdmin(session: SessionUser) {
  const isSuperAdmin = session.peran === "admin" && session.levelAdmin === 1;

  // Super admin: lihat semua Kasir + Admin level 2 + dirinya sendiri.
  // Super admin LAIN disembunyikan (tidak bisa diakses/dilihat).
  // Admin level 2 / kasir: lihat semua Kasir + dirinya sendiri saja.
  const where = isSuperAdmin
    ? {
        OR: [
          { peran: "kasir" as const },
          { peran: "admin" as const, levelAdmin: 2 },
          { id: session.id },
        ],
      }
    : { OR: [{ peran: "kasir" as const }, { id: session.id }] };

  const users = await prisma.pengguna.findMany({ where, orderBy: { id: "asc" } });

  const kasirIds = users.filter((u) => u.peran === "kasir").map((u) => u.id);

  const stats = kasirIds.length
    ? await prisma.pesanan.groupBy({
        by: ["idKasir"],
        where: { idKasir: { in: kasirIds }, status: { in: TRANSAKSI_SELESAI } },
        _count: { _all: true },
        _sum: { totalHarga: true },
      })
    : [];

  const statsMap = new Map(stats.map((s) => [s.idKasir, s]));

  return users.map((u) => ({
    ...u,
    transaksiCount: statsMap.get(u.id)?._count._all ?? 0,
    totalPendapatan: Number(statsMap.get(u.id)?._sum.totalHarga ?? 0),
  }));
}

// Password default tetap — TIDAK diinput manual dari form
const DEFAULT_PASSWORD_KASIR = "kasir123";
const DEFAULT_PASSWORD_ADMIN = "admin123";

interface UserInput {
  namaLengkap: string;
  username: string;
  noTelepon: string;
  peran: "admin" | "kasir";
  levelAdmin?: number | null;
  email?: string | null;
}

export async function createPengguna(input: UserInput, requester: SessionUser) {
  const requesterIsSuperAdmin = requester.peran === "admin" && requester.levelAdmin === 1;
  if (input.peran === "admin" && !requesterIsSuperAdmin) {
    throw new Error("Hanya Super Admin yang dapat menambah akun Admin.");
  }

  // 🔒 Guard: Super Admin tidak bisa dibuat lewat form Tambah Pengguna.
  // Akun admin baru dari sini selalu Level 2, terlepas dari apa yang dikirim.
  if (input.peran === "admin" && Number(input.levelAdmin) === 1) {
    throw new Error("Tidak bisa membuat akun Super Admin baru. Super Admin bersifat tunggal.");
  }

  const namaLengkap = validateNamaLengkap(input.namaLengkap);
  const username = validateUsernameFormat(input.username);
  const noTelepon = validateNoTeleponFormat(input.noTelepon);

  const existing = await prisma.pengguna.findUnique({ where: { username } });
  if (existing) throw new Error("Username sudah digunakan.");

  const defaultPassword = input.peran === "kasir" ? DEFAULT_PASSWORD_KASIR : DEFAULT_PASSWORD_ADMIN;
  const hashed = await hashPassword(defaultPassword);

  return prisma.pengguna.create({
    data: {
      namaLengkap,
      username,
      noTelepon,
      peran: input.peran,
      levelAdmin: input.peran === "admin" ? 2 : null, // dipaksa Level 2 — bukan input.levelAdmin
      email: null, // email diisi belakangan sendiri oleh admin ybs lewat menu Edit
      password: hashed,
      wajibGantiPassword: true,
    },
  });
}

export async function updatePengguna(id: number, input: UserInput, requester: SessionUser) {
  const target = await prisma.pengguna.findUnique({ where: { id } });
  if (!target) throw new Error("Pengguna tidak ditemukan.");

  const requesterIsSuperAdmin = requester.peran === "admin" && requester.levelAdmin === 1;
  const targetIsSuperAdmin = target.peran === "admin" && target.levelAdmin === 1;

  // Super admin lain: tidak bisa diedit siapapun, kecuali dirinya sendiri
  if (targetIsSuperAdmin && target.id !== requester.id) {
    throw new Error("Anda tidak memiliki akses untuk mengedit akun Super Admin lain.");
  }
  // Admin level 2: hanya bisa diedit oleh super admin, atau dirinya sendiri
  if (target.peran === "admin" && !targetIsSuperAdmin && !requesterIsSuperAdmin && target.id !== requester.id) {
    throw new Error("Anda tidak memiliki akses untuk mengedit akun Admin lain.");
  }

  const namaLengkap = validateNamaLengkap(input.namaLengkap);
  const username = validateUsernameFormat(input.username);
  const noTelepon = validateNoTeleponFormat(input.noTelepon);

  // Cegah eskalasi hak akses (ubah peran/level) oleh selain super admin
  let peran = input.peran;
  let levelAdmin = input.peran === "admin" ? input.levelAdmin || 2 : null;
  if (!requesterIsSuperAdmin) {
    peran = target.peran;
    levelAdmin = target.levelAdmin;
  }
  if (targetIsSuperAdmin) {
    // Super admin yang edit profil sendiri tidak boleh menurunkan levelnya lewat form ini
    peran = "admin";
    levelAdmin = 1;
  }

  // 🔒 GUARD UTAMA: cegah pembuatan Super Admin baru.
  // Super Admin bersifat tunggal — cuma akun yang MEMANG SUDAH Super Admin
  // (targetIsSuperAdmin true) yang boleh punya levelAdmin === 1.
  // Kalau ada yang coba set levelAdmin ke 1 untuk target yang BUKAN super admin
  // (lewat bug UI, request API manual, dsb), tolak keras — jangan diloloskan.
  if (peran === "admin" && levelAdmin === 1 && !targetIsSuperAdmin) {
    throw new Error("Tidak bisa mengubah akun ini menjadi Super Admin. Super Admin bersifat tunggal dan tidak dapat dibuat melalui form edit.");
  }

  const finalEmail =
    peran === "admin"
      ? (input.email !== undefined ? validateEmailFormat(input.email) : target.email)
      : null;
  // Cek email duplikat (kecuali milik user ini sendiri) — cuma dicek kalau email diisi
  if (finalEmail) {
    const emailTaken = await prisma.pengguna.findFirst({
      where: { email: finalEmail, NOT: { id } },
    });
    if (emailTaken) {
      throw new Error("Email ini sudah digunakan oleh akun lain. Gunakan email yang berbeda.");
    }
  }

  // Cek username duplikat (kecuali milik user ini sendiri)
  if (username !== target.username) {
    const usernameTaken = await prisma.pengguna.findUnique({ where: { username } });
    if (usernameTaken) {
      throw new Error("Username sudah digunakan oleh akun lain.");
    }
  }

  // 🔑 RESET PASSWORD OTOMATIS SAAT ROLE BERUBAH
  // Kalau peran (kasir <-> admin) benar-benar berubah dibanding sebelumnya,
  // password akun tsb otomatis direset ke password default sesuai ROLE BARU
  // (kasir -> jadi "kasir123", admin -> jadi "admin123"), dan pengguna wajib
  // ganti password lagi saat login berikutnya. Ini penting secara keamanan —
  // kalau role berubah, kita tidak bisa asumsikan password lama masih aman.
  const roleChanged = peran !== target.peran;
  let passwordFields: { password?: string; wajibGantiPassword?: boolean } = {};
  let passwordDefaultBaru: string | null = null;

  if (roleChanged) {
    passwordDefaultBaru = peran === "kasir" ? DEFAULT_PASSWORD_KASIR : DEFAULT_PASSWORD_ADMIN;
    passwordFields = {
      password: await hashPassword(passwordDefaultBaru),
      wajibGantiPassword: true,
    };
  }

  const updated = await prisma.pengguna.update({
    where: { id },
    data: {
      namaLengkap,
      username,
      noTelepon,
      peran,
      levelAdmin,
      email: finalEmail,
      ...passwordFields,
    },
  });

  // Sisipkan info password default baru (kalau role berubah) supaya bisa
  // ditampilkan ke admin yang melakukan edit. Field ini BUKAN kolom database,
  // cuma info tambahan yang ikut dikirim balik ke frontend lewat response API.
  return { ...updated, passwordDefaultBaru };
}

/**
 * FIX: Pesanan.idKasir tidak eksplisit onDelete SetNull/Cascade, jadi
 * menghapus kasir yang sudah pernah menangani transaksi akan lempar error
 * foreign key constraint (P2003) mentah dari Prisma. Ditangkap di sini dan
 * diubah jadi pesan yang bisa dipahami admin.
 */
export async function deletePengguna(id: number, requester: SessionUser) {
  if (id === requester.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
  }
  const target = await prisma.pengguna.findUnique({ where: { id } });
  if (!target) throw new Error("Pengguna tidak ditemukan.");

  if (target.peran === "admin" && target.levelAdmin === 1) {
    throw new Error("Akun Super Admin tidak dapat dihapus.");
  }

  const requesterIsSuperAdmin = requester.peran === "admin" && requester.levelAdmin === 1;
  if (target.peran === "admin" && !requesterIsSuperAdmin) {
    throw new Error("Anda tidak memiliki akses untuk menghapus akun Admin lain.");
  }

  try {
    return await prisma.pengguna.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new Error(
        "Pengguna ini tidak bisa dihapus karena sudah memiliki riwayat transaksi. Hubungi developer untuk menonaktifkan akun ini alih-alih menghapusnya."
      );
    }
    throw err;
  }
}

export async function resetPasswordPengguna(id: number, requester: SessionUser) {
  const target = await prisma.pengguna.findUnique({ where: { id } });
  if (!target) throw new Error("Pengguna tidak ditemukan.");

  if (target.id === requester.id) {
    throw new Error("Anda tidak dapat mereset password akun sendiri. Gunakan fitur Ubah Password.");
  }

  const targetIsSuperAdmin = target.peran === "admin" && target.levelAdmin === 1;
  if (targetIsSuperAdmin) {
    throw new Error("Password Super Admin tidak dapat direset melalui fitur ini.");
  }

  const requesterIsSuperAdmin = requester.peran === "admin" && requester.levelAdmin === 1;
  if (target.peran === "admin" && !requesterIsSuperAdmin) {
    throw new Error("Anda tidak memiliki akses untuk mereset password akun Admin lain.");
  }

  const defaultPassword = target.peran === "kasir" ? DEFAULT_PASSWORD_KASIR : DEFAULT_PASSWORD_ADMIN;
  const hashed = await hashPassword(defaultPassword);
  await prisma.pengguna.update({
    where: { id },
    data: { password: hashed, wajibGantiPassword: true },
  });
  return defaultPassword;
}

export async function getSessionUserDetail(id: number) {
  const user = await prisma.pengguna.findUnique({
    where: { id },
    select: { wajibGantiPassword: true, email: true, peran: true },
  });
  return user;
}