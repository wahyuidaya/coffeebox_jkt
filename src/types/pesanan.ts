export type StatusPesanan =
  | "menunggu_konfirmasi"
  | "diproses"
  | "sedang_disiapkan"
  | "sedang_diantar"
  | "selesai"
  | "dibatalkan";

export type MetodePembayaran = "cash" | "qris";
export type Varian = "iced" | "hot";
export type VarianTampil = "Iced" | "Hot";

export interface CartItem {
  lineId: number;
  idMenu: number;
  nama: string;
  harga: number;
  kategori: string;
  jenis: string;
  bundleItems: string[];
  jumlah: number;
  varian: VarianTampil;
  catatanItem: string;
}

export interface DetailPesananItem {
  id: number;
  idMenu: number | null;
  namaItem: string;
  harga: number;
  jumlah: number;
  varian: Varian | null;
  catatanItem: string | null;
  subtotal: number;
}

export interface Pesanan {
  id: number;
  kodePesanan: string;
  idMeja: number;
  idKasir: number | null;
  namaPelanggan: string;
  teleponPelanggan: string;
  metodePembayaran: MetodePembayaran;
  buktiPembayaran: string | null;
  status: StatusPesanan;
  alasanPembatalan: string | null;
  catatan: string | null;
  totalHarga: number;
  createdAt: string;
  detailPesanan: DetailPesananItem[];
}

export interface ItemPesananInput {
  idMenu: number;
  nama: string;
  harga: number;
  jumlah: number;
  varian: VarianTampil;
  catatanItem: string;
}

export interface CreatePesananInput {
  nomorMeja: string;
  namaPelanggan: string;
  teleponPelanggan: string;
  metodePembayaran: MetodePembayaran;
  catatan?: string;
  items: ItemPesananInput[];
}