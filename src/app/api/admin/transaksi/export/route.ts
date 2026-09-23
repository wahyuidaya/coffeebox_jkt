import { NextRequest, NextResponse } from "next/server";
import { requireAuthDetailed } from "@/lib/auth";
import { getTransaksiForExport } from "@/services/transaksiService";

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Cegah CSV/Formula Injection: kalau isi cell diawali karakter yang bisa
 * ditafsirkan Excel/Sheets sebagai awal formula (=, +, -, @, tab, CR),
 * beri prefix tanda kutip tunggal supaya dibaca sebagai teks, bukan dieksekusi.
 * Wajib untuk field yang berasal dari input pelanggan (nama, telepon).
 */
function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthDetailed(["admin"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const now = new Date();
  const { searchParams } = new URL(req.url);
  const bulan = clampInt(searchParams.get("bulan"), 1, 12, now.getMonth() + 1);
  const tahun = clampInt(searchParams.get("tahun"), 2000, 2100, now.getFullYear());

  try {
    const data = await getTransaksiForExport(bulan, tahun);

    const header = ["No. Pesanan", "Tanggal", "Pelanggan", "No. HP", "Meja", "Item", "Kasir", "Metode Bayar", "Total"];
    const rows = data.map((p) => [
      sanitizeCsvCell(p.kodePesanan),
      p.createdAt.toLocaleDateString("id-ID"),
      sanitizeCsvCell(p.namaPelanggan),
      sanitizeCsvCell(p.teleponPelanggan),
      sanitizeCsvCell(p.meja.nomorMeja),
      sanitizeCsvCell(p.detailPesanan.map((d) => `${d.namaItem} x${d.jumlah}`).join("; ")),
      sanitizeCsvCell(p.kasir?.namaLengkap || "-"),
      p.metodePembayaran.toUpperCase(),
      Number(p.totalHarga),
    ]);

    const csvBody = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // BOM UTF-8 supaya Excel membaca karakter non-ASCII (nama dengan aksen, dll) dengan benar.
    const csv = "\uFEFF" + csvBody;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transaksi-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("[admin/transaksi/export] gagal export:", error);
    return NextResponse.json(
      { message: "Gagal mengekspor data. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}