import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPesananAktif, getPesananDibatalkanBaru } from "@/services/pesananService";

export async function GET() {
  const session = await requireAuth(["kasir"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const [aktif, dibatalkan] = await Promise.all([
    getPesananAktif(),
    getPesananDibatalkanBaru(),
  ]);
  return NextResponse.json({ pesanan: [...aktif, ...dibatalkan] });
}