import { NextResponse } from "next/server";
import { requireAuthDetailed } from "@/lib/auth";
import { getDashboardAdmin } from "@/services/transaksiService";

export async function GET() {
  const auth = await requireAuthDetailed(["admin"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  try {
    const data = await getDashboardAdmin();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[dashboard/admin] gagal ambil data:", error);
    return NextResponse.json(
      { message: "Gagal memuat data dashboard. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}