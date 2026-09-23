import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ubahPasswordSendiri } from "@/services/penggunaService";

// bcrypt cuma memproses 72 byte pertama — password lebih panjang dari itu
// akan silently terpotong, jadi kita batasi juga di validasi supaya user tahu.
const passwordBaruRegex = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,72}$/;

const bodySchema = z
  .object({
    passwordLama: z.string().min(1, "Password lama wajib diisi."),
    passwordBaru: z
      .string()
      .min(8, "Password baru minimal 8 karakter.")
      .max(72, "Password baru maksimal 72 karakter.")
      .regex(passwordBaruRegex, "Password baru harus kombinasi huruf dan angka."),
    konfirmasiPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.passwordBaru === data.konfirmasiPassword, {
    message: "Konfirmasi password tidak cocok dengan password baru.",
    path: ["konfirmasiPassword"],
  })
  .refine((data) => data.passwordBaru !== data.passwordLama, {
    message: "Password baru tidak boleh sama dengan password lama.",
    path: ["passwordBaru"],
  });

export async function PATCH(req: NextRequest) {
  const session = await requireAuth(["admin", "kasir"]);
  if (!session) {
    return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: "Data yang dikirim tidak valid." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message || "Data tidak valid." },
      { status: 400 }
    );
  }

  try {
    await ubahPasswordSendiri(session.id, parsed.data.passwordLama, parsed.data.passwordBaru);
    return NextResponse.json({ success: true });
  } catch (error) {
    // Pesan spesifik dari service (mis. "Password lama salah") diteruskan apa adanya,
    // BUKAN digabung jadi satu kalimat ambigu.
    const message = error instanceof Error ? error.message : "Gagal mengubah password.";
    return NextResponse.json({ message }, { status: 400 });
  }
}