import { NextRequest, NextResponse } from "next/server";
import { requireAuthDetailed } from "@/lib/auth";
import { getTransaksi } from "@/services/transaksiService";

const MAX_SEARCH_LENGTH = 100;

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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
  const page = clampInt(searchParams.get("page"), 1, 100000, 1);
  const search = (searchParams.get("q") || "").trim().slice(0, MAX_SEARCH_LENGTH);

  try {
    const result = await getTransaksi({ bulan, tahun, search, page, perPage: 10 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/transaksi] gagal ambil data:", error);
    return NextResponse.json(
      { message: "Gagal memuat data transaksi. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}