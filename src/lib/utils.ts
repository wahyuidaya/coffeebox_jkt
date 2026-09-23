export function formatRupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

// Parameter kedua (withPrefix) opsional -> default true, jadi pemanggilan lama formatRupiahSingkat(x) tetap jalan
export function formatRupiahSingkat(n: number, withPrefix: boolean = true): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const prefix = withPrefix ? "Rp " : "";
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "");
    return `${sign}${prefix}${val}jt`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(1).replace(".", ",").replace(",0", "");
    return `${sign}${prefix}${val}k`;
  }
  return withPrefix ? `${sign}${formatRupiah(abs)}` : `${sign}${Math.round(abs).toLocaleString("id-ID")}`;
}

// Format "Bergabung sejak" / "Sejak ..." -> contoh: "Feb 2025"
export function formatBulanTahun(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export function roundedTotal(n: number): number {
  return Math.ceil(n / 500) * 500;
}

export function roundingAmount(n: number): number {
  return roundedTotal(n) - n;
}

// ────────────────────────────────────────────────
// KODE PESANAN: acak & unik, contoh "K7X9QM".
// Keunikan dijamin oleh constraint @unique di kolom kode_pesanan pada
// schema Prisma — kalau tabrakan (sangat jarang), buatPesanan() akan
// retry generate kode baru (lihat catch P2002 di pesananService.ts).
// ────────────────────────────────────────────────
import { randomBytes } from "crypto";

// Tanpa 0/O dan 1/I biar gak ketuker pas dibaca kasir/pelanggan
const KODE_PESANAN_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KODE_PESANAN_LENGTH = 6;

export function generateKodePesananAcak(): string {
  const bytes = randomBytes(KODE_PESANAN_LENGTH);
  let kode = "";
  for (let i = 0; i < KODE_PESANAN_LENGTH; i++) {
    kode += KODE_PESANAN_CHARSET[bytes[i] % KODE_PESANAN_CHARSET.length];
  }
  return kode;
}