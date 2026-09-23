import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Lokasi baca file diambil dari env var UPLOAD_DIR — HARUS sama persis
// dengan UPLOAD_ROOT yang dipakai di upload-image/route.ts dan
// pesanan/[kode]/route.ts, karena di sinilah file yang mereka simpan
// dibaca ulang untuk ditampilkan ke browser.
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "./coffeebox-uploads";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const segments = params.path;

  // Cegah path traversal — tolak jika ada ".." atau pemisah folder di segmen manapun
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return NextResponse.json({ message: "Path tidak valid." }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_ROOT, ...segments);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];

  if (!mime) {
    return NextResponse.json({ message: "Tipe file tidak didukung." }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "File tidak ditemukan." }, { status: 404 });
  }
}