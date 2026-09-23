import { prisma } from "@/lib/prisma";

// Gambar QRIS hanya boleh berupa path hasil upload lewat /api/admin/upload-image
// (folder "qris"), TIDAK BOLEH sembarang URL — mencegah orang menyisipkan
// gambar dari domain luar (mis. untuk phishing/menyamar sebagai QRIS resmi)
// lewat request API manual, karena endpoint ini menerima string apa saja
// sebelum validasi ini ditambahkan.
const GAMBAR_QRIS_PATTERN = /^\/api\/uploads\/qris\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/;

function validateGambarQris(gambarQris: string | null): string | null {
  if (gambarQris === null) return null;
  if (!GAMBAR_QRIS_PATTERN.test(gambarQris)) {
    throw new Error("Format gambar QRIS tidak valid. Unggah ulang gambar lewat form yang tersedia.");
  }
  return gambarQris;
}

export async function getQris() {
  return prisma.qris.findFirst({ orderBy: { id: "asc" } });
}

export async function setQris(gambarQrisInput: string | null) {
  const gambarQris = validateGambarQris(gambarQrisInput);

  const existing = await prisma.qris.findFirst();
  if (existing) {
    return prisma.qris.update({
      where: { id: existing.id },
      data: { gambarQris },
    });
  }
  return prisma.qris.create({ data: { gambarQris } });
}