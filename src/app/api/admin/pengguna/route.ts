import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAllPenggunaForAdmin, createPengguna } from "@/services/penggunaService";

export async function GET() {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const data = await getAllPenggunaForAdmin(session);
  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pengguna: data.map(({ password, ...rest }) => rest),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  try {
    const body = await req.json();
    const user = await createPengguna(body, session);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return NextResponse.json({ pengguna: rest });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menambah pengguna.";
    return NextResponse.json({ message }, { status: 400 });
  }
}