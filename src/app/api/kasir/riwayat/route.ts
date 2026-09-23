import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getRiwayatTransaksi } from "@/services/pesananService";

export async function GET(req: NextRequest) {
  const session = await requireAuth(["kasir", "admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");
  const filter: "today" | "bulan" | "all" =
    filterParam === "bulan" ? "bulan" : filterParam === "all" ? "all" : "today";
  const bulan = searchParams.get("bulan") || undefined;
  const search = searchParams.get("q") || "";

  const data = await getRiwayatTransaksi({ filter, bulan, search });
  return NextResponse.json({ riwayat: data });
}