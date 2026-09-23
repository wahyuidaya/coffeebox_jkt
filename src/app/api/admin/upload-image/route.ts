// src/app/api/admin/upload-image/route.ts  (untuk foto menu & QRIS toko)
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Whitelist folder tujuan — JANGAN percaya nilai "folder" dari client apa adanya,
// karena sebelumnya bisa dipakai untuk path traversal (mis. folder="../../..").
const ALLOWED_FOLDERS = ["menu", "qris"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

// Ekstensi ditentukan dari MIME type asli file (dicek server-side), BUKAN dari
// nama file yang dikirim client — supaya tidak bisa upload file berbahaya
// menyamar sebagai gambar.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Lokasi penyimpanan file diambil dari env var UPLOAD_DIR — SENGAJA di luar
// folder "public", karena Next.js production (next start) tidak mendeteksi
// file baru yang ditambahkan ke folder public setelah server pertama kali
// jalan (akan 404 sampai PM2 di-restart manual). Fallback "./coffeebox-uploads"
// dipakai kalau UPLOAD_DIR belum di-set (mis. lupa isi di .env lokal).
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "./coffeebox-uploads";

export async function POST(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const folderRaw = (form.get("folder") as string) || "menu";

  if (!file) {
    return NextResponse.json({ message: "File wajib diunggah." }, { status: 400 });
  }

  if (!ALLOWED_FOLDERS.includes(folderRaw as AllowedFolder)) {
    return NextResponse.json({ message: "Tujuan folder upload tidak valid." }, { status: 400 });
  }
  const folder: AllowedFolder = folderRaw as AllowedFolder;

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { message: "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FOTO_SIZE_BYTES) {
    return NextResponse.json({ message: "Ukuran maksimal 2MB." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    // Nama file sepenuhnya dibuat di server (timestamp + random + ekstensi dari
    // MIME asli) — tidak pernah mengambil sepotong pun dari nama file client.
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const dir = path.join(UPLOAD_ROOT, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    return NextResponse.json({ url: `/api/uploads/${folder}/${fileName}` });
  } catch {
    return NextResponse.json({ message: "Gagal menyimpan file. Coba lagi." }, { status: 500 });
  }
}