// src/app/api/admin/meja/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAllMejaAdmin, createMeja, generateQrDataUrl } from "@/services/mejaService";

export async function GET() {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const mejaList = await getAllMejaAdmin();
  const withQr = await Promise.all(
    mejaList.map(async (m) => ({ ...m, qr: await generateQrDataUrl(m.nomorMeja) }))
  );
  return NextResponse.json({ meja: withQr });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  try {
    const { nomorMeja } = await req.json();
    const meja = await createMeja(nomorMeja);
    const qr = await generateQrDataUrl(meja.nomorMeja);
    return NextResponse.json({ meja: { ...meja, qr } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menambah meja.";
    return NextResponse.json({ message }, { status: 400 });
  }
}