import { NextRequest, NextResponse } from "next/server";
import { buatPesanan } from "@/services/pesananService";
import { z } from "zod";

// Nama: tolak diawali simbol yang bisa ditafsir sebagai formula CSV (=+-@),
// dan batasi ke karakter wajar untuk nama orang (huruf, spasi, titik, apostrof, strip).
const namaPelangganRegex = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/;

// Format nomor HP Indonesia: wajib diawali 08, panjang 10-13 digit total.
const teleponRegex = /^08[0-9]{8,11}$/;

const itemSchema = z.object({
  idMenu: z.number().int().positive(),
  nama: z.string().min(1).max(50),
  harga: z.number().nonnegative(),
  jumlah: z.number().int().min(1).max(50),
  varian: z.enum(["Iced", "Hot"]),
  catatanItem: z.string().max(100).optional().default(""),
});

const bodySchema = z.object({
  nomorMeja: z.string().min(1).max(5),
  namaPelanggan: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.string().min(1, "Nama lengkap wajib diisi.")
        .max(50, "Nama maksimal 50 karakter.")
        .regex(namaPelangganRegex, "Nama hanya boleh berisi huruf, spasi, titik, apostrof, atau strip.")
    ),
  teleponPelanggan: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.string().regex(teleponRegex, "Nomor telepon harus diawali 08 dan berjumlah 10-13 digit.")
    ),
  metodePembayaran: z.enum(["cash", "qris"]),
  catatan: z.string().max(500).optional().default(""),
  items: z.array(itemSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Data pesanan tidak valid.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pesanan = await buatPesanan(parsed.data);
    return NextResponse.json({ kodePesanan: pesanan.kodePesanan, id: pesanan.id });
  } catch (error) {
    console.error("[api/pesanan] gagal membuat pesanan:", error);
    return NextResponse.json(
      { message: "Gagal membuat pesanan. Silakan coba lagi." },
      { status: 400 }
    );
  }
}