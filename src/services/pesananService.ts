import { prisma } from "@/lib/prisma";
import { CreatePesananInput, StatusPesanan } from "@/types/pesanan";
import { generateKodePesananAcak, roundedTotal } from "@/lib/utils";
// ────────────────────────────────────────────────
// HELPER WAKTU
// ────────────────────────────────────────────────

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Indonesia tidak pakai DST, jadi aman fixed offset

/**
 * PENTING: `createdAt` di database TIDAK disimpan sebagai UTC asli.
 * Di buatPesanan(), yang disimpan adalah `Date.now() + WIB_OFFSET_MS` —
 * artinya field ini berisi "jam WIB, tapi dibaca/dilabeli sebagai UTC".
 * Semua fungsi di bawah ini SENGAJA mengikuti konvensi yang sama (return
 * value juga dalam "WIB berlabel UTC"), supaya perbandingan `createdAt >= X`
 * di Prisma query selalu apple-to-apple. JANGAN konversi balik ke UTC asli
 * di fungsi manapun di sini kecuali storage `createdAt` juga diubah.
 */

/**
 * Ambil awal hari (00:00) menurut WIB, dikembalikan dalam ruang yang SAMA
 * dengan createdAt tersimpan ("WIB berlabel UTC") — supaya perbandingan
 * `createdAt >= start` di Prisma selalu akurat terhadap "hari ini" versi
 * Indonesia, TIDAK tergantung timezone server tempat Node.js berjalan.
 *
 * Dipakai untuk hal-hal yang MEMANG butuh patokan kalender (bukan rolling
 * window): penomoran kode pesanan harian (buatPesanan), halaman Riwayat
 * ("hari ini saja" & "bulan ini"), dan angka laporan di Dashboard
 * (selesaiHariIni, pendapatan) — supaya angka-angka ini stabil/tidak
 * berubah begitu lewat tengah malam (cocok untuk closing/rekap harian).
 */
function getAwalHariWIB(): Date {
  const now = new Date();
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  wibNow.setUTCHours(0, 0, 0, 0); // set ke 00:00 dalam "jam WIB" yg sudah digeser
  return wibNow; // TIDAK digeser balik — biar sama ruang dgn createdAt tersimpan
}

/**
 * Awal & akhir hari (versi WIB) untuk query rentang satu hari penuh.
 */
function getRentangHariIniWIB(): { start: Date; end: Date } {
  const start = getAwalHariWIB();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

/**
 * Awal & akhir bulan (versi WIB) untuk query rentang satu bulan penuh.
 * `bulanStr` format "YYYY-MM" (sesuai <input type="month">).
 */
function getRentangBulanWIB(bulanStr: string): { start: Date; end: Date } {
  const [tahun, bulan] = bulanStr.split("-").map(Number);
  // Dibangun langsung lewat Date.UTC — hasilnya sudah dalam ruang "WIB
  // berlabel UTC" yang sama seperti getAwalHariWIB, TANPA perlu shift lagi.
  const start = new Date(Date.UTC(tahun, bulan - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(tahun, bulan, 1, 0, 0, 0, 0) - 1);
  return { start, end };
}

/**
 * Batas rolling 24 jam terakhir dari waktu sekarang (BUKAN patokan tengah
 * malam). Dipakai untuk hal-hal yang sifatnya ANTREAN KERJA LIVE, bukan
 * laporan — kartu status Menunggu/Diproses/Disiapkan/Diantar di Dashboard,
 * dan daftar pesanan aktif di halaman Pesanan Masuk (isDalam24Jam() di
 * OrdersClient.tsx) — supaya pesanan yang baru lewat tengah malam TIDAK
 * hilang mendadak dari layar kasir tepat jam 00:00.
 *
 * "now" di sini SENGAJA digeser +WIB_OFFSET_MS dulu sebelum dikurangi 24
 * jam, supaya berada di ruang yang sama dengan createdAt tersimpan
 * ("WIB berlabel UTC"). Tanpa shift ini, window jadi 31 jam, bukan 24 jam.
 */
function getBatas24Jam(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS - 24 * 60 * 60 * 1000);
}

// ────────────────────────────────────────────────
// SISI PELANGGAN (Fase 2)
// ────────────────────────────────────────────────

export async function buatPesanan(input: CreatePesananInput) {
  const meja = await prisma.meja.findFirst({
    where: { nomorMeja: input.nomorMeja, statusAktif: true },
  });
  if (!meja) throw new Error("Meja tidak ditemukan atau tidak aktif.");
  if (!input.items.length) throw new Error("Keranjang tidak boleh kosong.");

  // ── VERIFIKASI HARGA DI SERVER ──
  // JANGAN PERNAH percaya field `harga` yang dikirim client — request bisa
  // dimodifikasi (price tampering) sebelum sampai ke server, misalnya diubah
  // jadi 0 atau angka sangat kecil. Harga yang dipakai untuk hitung subtotal
  // dan disimpan ke database HARUS diambil ulang dari tabel Menu di sini.
  const idMenuList = [...new Set(input.items.map((i) => i.idMenu))];
  const menuRecords = await prisma.menu.findMany({
    where: { id: { in: idMenuList } },
  });
  const menuMap = new Map(menuRecords.map((m) => [m.id, m]));

  const itemsWithVerifiedPrice = input.items.map((i) => {
    const menu = menuMap.get(i.idMenu);
    if (!menu) {
      throw new Error(`Menu "${i.nama}" tidak ditemukan.`);
    }
    if (!menu.statusAktif) {
      throw new Error(`Menu "${menu.nama}" sedang tidak tersedia.`);
    }

    const hargaAsli = Number(menu.harga);
    const now = new Date();
    const sedangDiskon =
      menu.statusDiskon &&
      menu.persentaseDiskon > 0 &&
      (!menu.tanggalMulaiDiskon || now >= menu.tanggalMulaiDiskon) &&
      (!menu.tanggalSelesaiDiskon || now <= menu.tanggalSelesaiDiskon);

    // Harga efektif dihitung ulang di server (termasuk diskon jika memang
    // sedang berlaku) — nilai ini yang dipakai, BUKAN `i.harga` dari client.
    const hargaVerified = sedangDiskon
      ? Math.round(hargaAsli * (1 - menu.persentaseDiskon / 100))
      : hargaAsli;

    return {
      idMenu: i.idMenu,
      nama: menu.nama, // nama juga diambil dari DB, bukan dari client
      harga: hargaVerified,
      jumlah: i.jumlah,
      varian: i.varian,
      catatanItem: i.catatanItem,
    };
  });

  const subtotal = itemsWithVerifiedPrice.reduce((s, i) => s + i.harga * i.jumlah, 0);
  const total = roundedTotal(subtotal);

  // Pakai rentang hari WIB eksplisit, bukan setHours() yang tergantung
  // timezone server — supaya nomor urut kode pesanan tetap benar walau
  // server berjalan di UTC.
  const { start: startOfDay, end: endOfDay } = getRentangHariIniWIB();

let pesanan;
  let attempt = 0;
  const maxAttempt = 5;

  while (true) {
    const kodePesanan = generateKodePesananAcak();

    try {
      const nowWib = new Date(Date.now() + WIB_OFFSET_MS);

      pesanan = await prisma.pesanan.create({
        data: {
          kodePesanan,
          idMeja: meja.id,
          namaPelanggan: input.namaPelanggan,
          tanggalPesanan: new Date(),
          teleponPelanggan: input.teleponPelanggan,
          metodePembayaran: input.metodePembayaran,
          status: "menunggu_konfirmasi",
          catatan: input.catatan || null,
          totalHarga: total,
          createdAt: nowWib,
          updatedAt: nowWib,
          detailPesanan: {
            create: itemsWithVerifiedPrice.map((i) => ({
              idMenu: i.idMenu,
              namaItem: i.nama,
              harga: i.harga,
              jumlah: i.jumlah,
              varian: i.varian === "Iced" ? "iced" : i.varian === "Hot" ? "hot" : null,
              catatanItem: i.catatanItem || null,
              subtotal: i.harga * i.jumlah,
            })),
          },
        },
        include: { detailPesanan: true },
      });
      break;
    } catch (err: unknown) {
      const isUniqueConflict =
        typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
      if (!isUniqueConflict || attempt >= maxAttempt) throw err;
      attempt++;
    }
  }

  return pesanan;
}

export async function getPesananByKode(kodePesanan: string) {
  const pesanan = await prisma.pesanan.findFirst({
    where: { kodePesanan },
    include: { detailPesanan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!pesanan) return null;

  // Auto-batalkan pesanan yang sudah lebih dari 24 jam masih menunggu
  // konfirmasi kasir — supaya pelanggan yang tidak upload bukti / tidak
  // dikonfirmasi kasir tidak stuck selamanya di halaman status pembayaran.
  if (pesanan.status === "menunggu_konfirmasi" && pesanan.createdAt < getBatas24Jam()) {
    return prisma.pesanan.update({
      where: { id: pesanan.id },
      data: {
        status: "dibatalkan",
        alasanPembatalan: "Pesanan otomatis dibatalkan karena tidak ada konfirmasi pembayaran dalam 24 jam. Silakan pesan ulang.",
      },
      include: { detailPesanan: true },
    });
  }

  return pesanan;
}

export async function simpanBuktiPembayaran(kodePesanan: string, namaFile: string) {
  const pesanan = await prisma.pesanan.findFirst({
    where: { kodePesanan },
    orderBy: { createdAt: "desc" },
  });
  if (!pesanan) {
    throw new Error("Pesanan tidak ditemukan.");
  }
  // Update dilakukan berdasarkan `id` (primary key, benar-benar unik),
  // bukan `kodePesanan` — supaya sesuai tipe PesananWhereUniqueInput dari Prisma.
  return prisma.pesanan.update({
    where: { id: pesanan.id },
    data: { buktiPembayaran: namaFile },
  });
}

// ────────────────────────────────────────────────
// SISI KASIR (Fase 3)
// ────────────────────────────────────────────────

export async function getPesananAktif() {
  // Auto-batalkan pesanan menunggu_konfirmasi yang sudah lebih dari 24 jam,
  // dijalankan tiap kasir refresh (setiap 15 detik) supaya data konsisten
  // di database, bukan cuma disembunyikan dari tampilan seperti sebelumnya.
  await prisma.pesanan.updateMany({
    where: { status: "menunggu_konfirmasi", createdAt: { lt: getBatas24Jam() } },
    data: {
      status: "dibatalkan",
      alasanPembatalan: "Pesanan otomatis dibatalkan karena tidak ada konfirmasi pembayaran dalam 24 jam.",
    },
  });

  return prisma.pesanan.findMany({
    where: { status: { not: "dibatalkan" } },
    include: { detailPesanan: true, meja: true, kasir: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPesananDibatalkanBaru() {
  const batas = getBatas24Jam();
  return prisma.pesanan.findMany({
    where: { status: "dibatalkan", updatedAt: { gte: batas } },
    include: { detailPesanan: true, meja: true, kasir: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function konfirmasiPembayaran(id: number, idKasir: number) {
  const pesanan = await prisma.pesanan.findUnique({ where: { id } });
  if (!pesanan || pesanan.status !== "menunggu_konfirmasi") {
    throw new Error("Pesanan tidak dapat dikonfirmasi pada status ini.");
  }
  return prisma.pesanan.update({
    where: { id },
    data: { status: "diproses", idKasir },
  });
}

export async function kirimKeDapur(id: number) {
  const pesanan = await prisma.pesanan.findUnique({ where: { id } });
  if (!pesanan || pesanan.status !== "diproses") {
    throw new Error("Pesanan belum dikonfirmasi pembayarannya.");
  }
  return prisma.pesanan.update({ where: { id }, data: { status: "sedang_disiapkan" } });
}

export async function antarKeMeja(id: number) {
  const pesanan = await prisma.pesanan.findUnique({ where: { id } });
  if (!pesanan || pesanan.status !== "sedang_disiapkan") {
    throw new Error("Pesanan belum selesai disiapkan.");
  }
  return prisma.pesanan.update({ where: { id }, data: { status: "sedang_diantar" } });
}

export async function selesaikanPesanan(id: number) {
  const pesanan = await prisma.pesanan.findUnique({ where: { id } });
  if (!pesanan || pesanan.status !== "sedang_diantar") {
    throw new Error("Pesanan belum diantar ke meja.");
  }
  return prisma.pesanan.update({ where: { id }, data: { status: "selesai" } });
}

export async function batalkanPesanan(id: number, alasan: string) {
  const pesanan = await prisma.pesanan.findUnique({ where: { id } });
  if (!pesanan || pesanan.status !== "menunggu_konfirmasi") {
    throw new Error("Hanya pesanan berstatus Menunggu Konfirmasi yang dapat dibatalkan.");
  }
  if (!alasan.trim()) throw new Error("Alasan pembatalan wajib diisi.");
  return prisma.pesanan.update({
    where: { id },
    data: { status: "dibatalkan", alasanPembatalan: alasan },
  });
}

export async function getRiwayatTransaksi(opts: {
  filter?: "today" | "bulan" | "all";
  bulan?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {
    status: "selesai",
  };

  if (opts.filter === "today") {
    const { start, end } = getRentangHariIniWIB();
    where.createdAt = { gte: start, lte: end };
  } else if (opts.filter === "bulan" && opts.bulan) {
    const { start, end } = getRentangBulanWIB(opts.bulan);
    where.createdAt = { gte: start, lte: end };
  }

  const list = await prisma.pesanan.findMany({
    where,
    include: { detailPesanan: true, meja: true, kasir: true },
    orderBy: { createdAt: "desc" },
  });
  if (!opts.search) return list;
  const q = opts.search.toLowerCase();
  return list.filter(
    (p) =>
      p.kodePesanan.toLowerCase().includes(q) ||
      p.namaPelanggan.toLowerCase().includes(q) ||
      p.teleponPelanggan.toLowerCase().includes(q) ||
      p.meja.nomorMeja.toLowerCase().includes(q) ||
      p.detailPesanan.some((d) => d.namaItem.toLowerCase().includes(q))
  );
}

export async function getDashboardKasir() {
  const batas24Jam = getBatas24Jam();
  const { start: startHariIni, end: endHariIni } = getRentangHariIniWIB();

  const [semua, hariIni] = await Promise.all([
    prisma.pesanan.findMany({
      where: {
        status: { not: "dibatalkan" },
        createdAt: { gte: batas24Jam },
      },
    }),
    prisma.pesanan.findMany({
      where: {
        createdAt: { gte: startHariIni, lte: endHariIni },
        status: "selesai",
      },
    }),
  ]);

  const qris = hariIni.filter((p) => p.metodePembayaran === "qris");
  const cash = hariIni.filter((p) => p.metodePembayaran === "cash");

  return {
    menungguKonfirmasi: semua.filter((p) => p.status === "menunggu_konfirmasi").length,
    diproses: semua.filter((p) => p.status === "diproses").length,
    sedangDisiapkan: semua.filter((p) => p.status === "sedang_disiapkan").length,
    sedangDiantar: semua.filter((p) => p.status === "sedang_diantar").length,
    selesaiHariIni: hariIni.length, // semua item di hariIni sekarang sudah pasti "selesai"
    totalPendapatan: hariIni.reduce((s, p) => s + Number(p.totalHarga), 0),
    pendapatanQris: qris.reduce((s, p) => s + Number(p.totalHarga), 0),
    jumlahQris: qris.length,
    pendapatanCash: cash.reduce((s, p) => s + Number(p.totalHarga), 0),
    jumlahCash: cash.length,
    terbaru: [...semua].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5),
  };
}
