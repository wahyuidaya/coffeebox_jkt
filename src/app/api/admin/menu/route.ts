// src/app/api/admin/menu/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAllMenuAdmin, createMenu } from "@/services/menuService";

export async function GET() {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const data = await getAllMenuAdmin();
  return NextResponse.json({ menu: data });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  try {
    const body = await req.json();
    const menu = await createMenu(body);
    return NextResponse.json({ menu });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menambah menu.";
    return NextResponse.json({ message }, { status: 400 });
  }
}