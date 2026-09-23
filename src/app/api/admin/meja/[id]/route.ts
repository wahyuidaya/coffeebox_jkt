// src/app/api/admin/meja/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateMeja, deleteMeja, toggleMejaAktif } from "@/services/mejaService";

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
    return NextResponse.json({ message: "ID meja tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    if (body.action === "toggle") {
      const meja = await toggleMejaAktif(id);
      return NextResponse.json({ meja });
    }
    const meja = await updateMeja(id, body.nomorMeja);
    return NextResponse.json({ meja });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui meja.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ message: "ID meja tidak valid." }, { status: 400 });
  }

  try {
    await deleteMeja(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus meja.";
    return NextResponse.json({ message }, { status: 400 });
  }
}