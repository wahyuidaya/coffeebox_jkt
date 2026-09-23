// src/app/api/admin/bundling/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createBundling } from "@/services/menuService";

export async function POST(req: NextRequest) {
  const session = await requireAuth(["admin"]);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  try {
    const body = await req.json();
    const bundling = await createBundling(body);
    return NextResponse.json({ bundling });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat bundling.";
    return NextResponse.json({ message }, { status: 400 });
  }
}