import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updatePengguna, deletePengguna, resetPasswordPengguna } from "@/services/penggunaService";

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ message: "ID pengguna tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    if (body.action === "reset_password") {
      const defaultPassword = await resetPasswordPengguna(id, session);
      return NextResponse.json({ defaultPassword });
    }
    const user = await updatePengguna(id, body, session);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return NextResponse.json({ pengguna: rest });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui pengguna.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ message: "ID pengguna tidak valid." }, { status: 400 });
  }

  try {
    await deletePengguna(id, session);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus pengguna.";
    return NextResponse.json({ message }, { status: 400 });
  }
}