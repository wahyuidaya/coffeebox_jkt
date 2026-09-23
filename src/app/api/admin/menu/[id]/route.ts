import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateMenu, deleteMenu, toggleMenuAktif } from "@/services/menuService";

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
    return NextResponse.json({ message: "ID menu tidak valid." }, { status: 400 });
  }

  const body = await req.json();
  try {
    if (body.action === "toggle") {
      const menu = await toggleMenuAktif(id);
      return NextResponse.json({ menu });
    }
    const menu = await updateMenu(id, body);
    return NextResponse.json({ menu });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui menu.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ message: "ID menu tidak valid." }, { status: 400 });
  }

  try {
    await deleteMenu(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus menu.";
    return NextResponse.json({ message }, { status: 400 });
  }
}