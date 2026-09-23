import { NextResponse } from "next/server";
import { requireAuthDetailed } from "@/lib/auth";
import { getDashboardKasir } from "@/services/pesananService";

export async function GET() {
const auth = await requireAuthDetailed(["kasir", "admin"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  try {
    const data = await getDashboardKasir();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[dashboard/kasir] gagal ambil data:", error);
    return NextResponse.json(
      { message: "Gagal memuat data dashboard. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}