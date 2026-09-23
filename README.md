# Coffeebox_Jkt

Sistem pemesanan menu berbasis QR Code yang dirancang untuk membantu proses pemesanan pada Coffeebox_Jkt.

Pelanggan dapat memindai QR Code yang tersedia di meja untuk melihat menu, melakukan pemesanan, memilih metode pembayaran, serta memantau status pesanan tanpa harus mengantre di kasir.

## Demo

🌐 https://coffeebox-jkt.com

## Fitur Utama

* Pemesanan menu melalui QR Code berdasarkan nomor meja
* Tampilan menu berdasarkan kategori
* Pilihan varian menu
* Keranjang dan catatan pesanan
* Pembayaran tunai dan QRIS
* Upload bukti pembayaran QRIS
* Pemantauan status pesanan
* Pengelolaan pesanan oleh kasir
* Pengelolaan menu oleh admin
* Pengelolaan meja dan QR Code
* Pengelolaan pengguna
* Riwayat transaksi dan analisis penjualan

## Hak Akses Pengguna

### Pelanggan

* Memindai QR Code meja
* Melihat informasi menu
* Menambahkan menu ke keranjang
* Membuat pesanan
* Memilih metode pembayaran
* Memantau status pesanan

### Kasir

* Melihat pesanan yang masuk
* Mengonfirmasi pesanan
* Mengelola dan memperbarui status pesanan
* Melihat riwayat pesanan

### Admin

* Mengelola menu
* Mengelola meja dan QR Code
* Mengelola pengguna
* Mengelola informasi pembayaran QRIS
* Melihat transaksi
* Melihat analisis penjualan

## Teknologi yang Digunakan

* **Frontend:** Next.js, TypeScript, Tailwind CSS
* **Backend:** Next.js API Routes
* **Database:** MySQL
* **ORM:** Prisma
* **Perancangan UI:** Figma
* **Version Control:** Git & GitHub

## Struktur Project

```text
src/
├── app/
│   ├── (admin)/
│   ├── (kasir)/
│   ├── (pelanggan)/
│   ├── api/
│   └── layout.tsx
├── components/
├── hooks/
├── lib/
├── services/
└── types/

prisma/
├── migrations/
├── schema.prisma
└── seed.ts
```

## Instalasi

Clone repository:

```bash
git clone https://github.com/wahyuidaya/coffeebox_jkt.git
cd coffeebox_jkt
```

Install dependencies:

```bash
npm install
```

Buat file `.env` dan masukkan konfigurasi environment yang diperlukan.

Generate Prisma Client:

```bash
npx prisma generate
```

Jalankan server development:

```bash
npm run dev
```

Kemudian buka:

```text
http://localhost:3000
```

## Catatan

Project ini dibuat sebagai proyek tugas akhir sekaligus portfolio untuk menerapkan sistem pemesanan digital menggunakan teknologi QR Code.
