import { NextResponse } from "next/server";
import { getMenuUntukPelanggan } from "@/services/menuService";

// Wajib dynamic + revalidate 0, biar Next.js tidak cache response ini —
// tujuannya justru selalu ambil data terbaru tiap kali di-poll oleh
// halaman pelanggan (OrderClient.tsx).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const menus = await getMenuUntukPelanggan();
    return NextResponse.json({ menus });
  } catch {
    return NextResponse.json({ message: "Gagal memuat menu." }, { status: 500 });
  }
}