import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { setQris } from "@/services/qrisServices";

// FIX KRITIS: sebelumnya endpoint ini tidak ada pengecekan autentikasi sama
// sekali — siapapun yang tahu path-nya bisa mengganti atau menghapus QR
// pembayaran QRIS toko tanpa login. Ini berisiko disalahgunakan untuk
// penipuan (mengganti QRIS ke rekening lain), jadi requireAuth WAJIB ada
// di sini seperti seluruh endpoint admin lainnya.
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  try {
    const body = await req.json();
    const gambarQris: string | null = body.gambarQris ?? null;

    const updated = await setQris(gambarQris);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan QRIS.";
    return NextResponse.json({ message }, { status: 400 });
  }
}