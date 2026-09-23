import { NextRequest, NextResponse } from "next/server";
import { getPesananByKode, simpanBuktiPembayaran } from "@/services/pesananService";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Lokasi penyimpanan file diambil dari env var UPLOAD_DIR — SENGAJA di luar
// folder "public", karena Next.js production (next start) tidak mendeteksi
// file baru yang ditambahkan ke folder public setelah server pertama kali
// jalan (akan 404 sampai PM2 di-restart manual). Fallback "./coffeebox-uploads"
// dipakai kalau UPLOAD_DIR belum di-set (mis. lupa isi di .env lokal).
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "./coffeebox-uploads";

export async function GET(
  _req: NextRequest,
  { params }: { params: { kode: string } }
) {
  try {
    const pesanan = await getPesananByKode(params.kode);
    if (!pesanan) {
      return NextResponse.json({ message: "Pesanan tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({
      kodePesanan: pesanan.kodePesanan,
      status: pesanan.status,
      alasanPembatalan: pesanan.alasanPembatalan,
      totalHarga: Number(pesanan.totalHarga),
    });
  } catch (error) {
    console.error("[api/pesanan/kode] gagal ambil pesanan:", error);
    return NextResponse.json({ message: "Gagal memuat data pesanan." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { kode: string } }
) {
  try {
    const pesanan = await getPesananByKode(params.kode);
    if (!pesanan) {
      return NextResponse.json({ message: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "File bukti pembayaran wajib diunggah." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "Ukuran file maksimal 5MB." }, { status: 400 });
    }

    // Validasi tipe file dari MIME yang dilaporkan browser DAN dari isi byte
    // pertama file (magic number), supaya tidak asal percaya ekstensi/nama file
    // yang sepenuhnya dikontrol oleh pengirim request.
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (!isValidImageMagicBytes(bytes, file.type)) {
      return NextResponse.json(
        { message: "File tidak valid atau rusak. Pastikan file adalah gambar asli." },
        { status: 400 }
      );
    }

    // Nama file di-generate sendiri oleh server (kode pesanan + timestamp),
    // TIDAK memakai nama file asli dari client sama sekali.
    const ext = MIME_TO_EXT[file.type];
    const fileName = `${pesanan.kodePesanan}-${Date.now()}${ext}`;
    const uploadDir = path.join(UPLOAD_ROOT, "bukti-pembayaran");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);
    await simpanBuktiPembayaran(params.kode, `/api/uploads/bukti-pembayaran/${fileName}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/pesanan/kode] gagal unggah bukti:", error);
    return NextResponse.json({ message: "Gagal mengunggah bukti pembayaran." }, { status: 500 });
  }
}

function isValidImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  switch (mimeType) {
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8;
    case "image/png":
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case "image/webp":
      return buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    default:
      return false;
  }
}