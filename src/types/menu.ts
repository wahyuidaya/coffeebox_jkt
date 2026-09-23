export type JenisMenu = "menu" | "bundling";

export interface MenuTampil {
  id: number;
  jenis: JenisMenu;
  kategori: string;       // nama asli, mis. "Basic Coffee"
  catSlug: string;        // slug untuk filter tab, mis. "basic"
  nama: string;
  deskripsi: string;
  harga: number;          // harga setelah diskon (final)
  hargaAsli: number;      // harga sebelum diskon
  sedangDiskon: boolean;
  persentaseDiskon: number;
  foto: string | null;
  badge: "hidden" | "club" | null;
  bundleItems: string[];  // nama menu isi bundling
  butuhVarian: boolean;   // ⬅️ BARU: apakah menu ini punya pilihan Iced/Hot
                          // (selalu false untuk item bundling, lihat menuService.ts)
}