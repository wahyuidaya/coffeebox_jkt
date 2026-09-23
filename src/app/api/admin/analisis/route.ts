import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAnalisis } from "@/services/transaksiService";

const TAHUN_MIN = 2020; // sesuaikan dengan tahun mulai bisnis berjalan
const TAHUN_MAX_OFFSET = 1; // izinkan 1 tahun ke depan (mis. transisi awal tahun)

export async function GET(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) {
    return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  }

  const tahunParam = new URL(req.url).searchParams.get("tahun");
  const currentYear = new Date().getFullYear();
  const tahunMax = currentYear + TAHUN_MAX_OFFSET;

  let tahun = currentYear;
  if (tahunParam !== null) {
    const parsed = Number(tahunParam);
    if (!Number.isInteger(parsed) || parsed < TAHUN_MIN || parsed > tahunMax) {
      return NextResponse.json(
        {
          message: `Parameter tahun tidak valid. Harus berupa angka bulat antara ${TAHUN_MIN} dan ${tahunMax}.`,
        },
        { status: 400 }
      );
    }
    tahun = parsed;
  }

  try {
    const data = await getAnalisis(tahun);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Gagal mengambil data analisis:", err);
    return NextResponse.json(
      { message: "Gagal mengambil data analisis. Coba lagi nanti." },
      { status: 500 }
    );
  }
}