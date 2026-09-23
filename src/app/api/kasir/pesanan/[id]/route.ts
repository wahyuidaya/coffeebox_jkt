// src/app/api/kasir/pesanan/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  konfirmasiPembayaran,
  kirimKeDapur,
  antarKeMeja,
  selesaikanPesanan,
  batalkanPesanan,
} from "@/services/pesananService";

const AKSI_LANJUTAN = ["kirim_dapur", "antar_meja", "selesai"];
const AKSI_VALID = ["konfirmasi_bayar", "kirim_dapur", "antar_meja", "selesai", "batalkan"];
const MAX_ALASAN_LENGTH = 500;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(["kasir"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "ID pesanan tidak valid." }, { status: 400 });
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

  const { action, alasan } = body as Record<string, unknown>;

  if (typeof action !== "string" || !AKSI_VALID.includes(action)) {
    return NextResponse.json({ message: "Aksi tidak dikenal." }, { status: 400 });
  }

  // Validasi alasan khusus untuk aksi "batalkan" — wajib string, tidak kosong
  // setelah di-trim, dan dibatasi panjangnya. Divalidasi ulang di server
  // karena validasi client bisa dilewati.
  let alasanTrimmed = "";
  if (action === "batalkan") {
    if (typeof alasan !== "string" || alasan.trim().length === 0) {
      return NextResponse.json({ message: "Alasan pembatalan wajib diisi." }, { status: 400 });
    }
    alasanTrimmed = alasan.trim();
    if (alasanTrimmed.length > MAX_ALASAN_LENGTH) {
      return NextResponse.json(
        { message: `Alasan pembatalan maksimal ${MAX_ALASAN_LENGTH} karakter.` },
        { status: 400 }
      );
    }
  }

  try {
    if (AKSI_LANJUTAN.includes(action)) {
      const pesanan = await prisma.pesanan.findUnique({
        where: { id },
        select: { idKasir: true },
      });

      if (!pesanan) {
        return NextResponse.json({ message: "Pesanan tidak ditemukan." }, { status: 404 });
      }

      if (pesanan.idKasir !== session.id) {
        return NextResponse.json(
          { message: "Pesanan ini sedang ditangani oleh kasir lain." },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case "konfirmasi_bayar":
        await konfirmasiPembayaran(id, session.id);
        break;
      case "kirim_dapur":
        await kirimKeDapur(id);
        break;
      case "antar_meja":
        await antarKeMeja(id);
        break;
      case "selesai":
        await selesaikanPesanan(id);
        break;
      case "batalkan":
        await batalkanPesanan(id, alasanTrimmed);
        break;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memproses pesanan.";
    return NextResponse.json({ message }, { status: 400 });
  }
}