import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import QRCode from "qrcode";

const NOMOR_MEJA_MAX_LEN = 5; // harus sinkron dengan @db.VarChar(5) di schema Prisma
const NOMOR_MEJA_PATTERN = /^[A-Za-z0-9]+$/; // hanya huruf & angka, tanpa spasi/simbol

/** Validasi format nomor meja — dipakai baik saat create maupun update. */
function validateNomorMejaFormat(nomorMeja: string): string {
  const trimmed = nomorMeja.trim();
  if (!trimmed) throw new Error("Nomor meja wajib diisi.");
  if (trimmed.length > NOMOR_MEJA_MAX_LEN) {
    throw new Error(`Nomor meja maksimal ${NOMOR_MEJA_MAX_LEN} karakter.`);
  }
  if (!NOMOR_MEJA_PATTERN.test(trimmed)) {
    throw new Error("Nomor meja hanya boleh berisi huruf dan angka, tanpa spasi atau simbol.");
  }
  return trimmed;
}

// ────────────────────────────────────────────────
// SISI PELANGGAN (Fase 2)
// ────────────────────────────────────────────────

export async function getMejaAktifByNomor(nomorMeja: string) {
  return prisma.meja.findFirst({
    where: { nomorMeja, statusAktif: true },
  });
}

// ────────────────────────────────────────────────
// SISI ADMIN (Fase 4) — Kelola Meja & QR
// ────────────────────────────────────────────────

export async function getAllMejaAdmin() {
  return prisma.meja.findMany({ orderBy: { id: "asc" } });
}

export async function createMeja(nomorMejaInput: string) {
  const nomorMeja = validateNomorMejaFormat(nomorMejaInput);
  const existing = await prisma.meja.findUnique({ where: { nomorMeja } });
  if (existing) throw new Error("Nomor meja sudah digunakan.");
  return prisma.meja.create({ data: { nomorMeja } });
}

/**
 * FIX: sebelumnya tidak ada validasi format maupun keunikan di sini —
 * padahal createMeja sudah cek keunikan. Sekarang update juga divalidasi
 * sama ketatnya, dan mengecualikan baris meja itu sendiri saat cek duplikat.
 */
export async function updateMeja(id: number, nomorMejaInput: string) {
  const nomorMeja = validateNomorMejaFormat(nomorMejaInput);

  const existing = await prisma.meja.findUnique({ where: { nomorMeja } });
  if (existing && existing.id !== id) {
    throw new Error("Nomor meja sudah digunakan oleh meja lain.");
  }

  const target = await prisma.meja.findUnique({ where: { id } });
  if (!target) throw new Error("Meja tidak ditemukan.");

  return prisma.meja.update({ where: { id }, data: { nomorMeja } });
}

export async function toggleMejaAktif(id: number) {
  const m = await prisma.meja.findUnique({ where: { id } });
  if (!m) throw new Error("Meja tidak ditemukan.");
  return prisma.meja.update({ where: { id }, data: { statusAktif: !m.statusAktif } });
}

/**
 * FIX: Pesanan.idMeja tidak onDelete Cascade, jadi menghapus meja yang
 * sudah pernah punya pesanan akan lempar error foreign key constraint (P2003)
 * mentah dari Prisma. Ditangkap di sini dan diubah jadi pesan yang bisa
 * dipahami user, sekaligus mengarahkan ke alternatif yang benar
 * (nonaktifkan meja, bukan hapus).
 */
export async function deleteMeja(id: number) {
  const target = await prisma.meja.findUnique({ where: { id } });
  if (!target) throw new Error("Meja tidak ditemukan.");

  try {
    return await prisma.meja.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new Error(
        "Meja ini tidak bisa dihapus karena sudah memiliki riwayat pesanan. Nonaktifkan saja meja ini alih-alih menghapusnya."
      );
    }
    throw err;
  }
}

export async function generateQrDataUrl(nomorMeja: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/order/${encodeURIComponent(nomorMeja)}`;
  return QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: "#1A0F07", light: "#FFFFFF" } });
}