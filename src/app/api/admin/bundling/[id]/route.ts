import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateBundling } from "@/services/menuService";

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
    return NextResponse.json({ message: "ID bundling tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const bundling = await updateBundling(id, body);
    return NextResponse.json({ bundling });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui bundling.";
    return NextResponse.json({ message }, { status: 400 });
  }
}