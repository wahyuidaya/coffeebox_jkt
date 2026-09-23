import { prisma } from "@/lib/prisma";
import { StatusPesanan } from "@/types/pesanan";

export const TRANSAKSI_SELESAI: StatusPesanan[] = ["diproses", "sedang_disiapkan", "sedang_diantar", "selesai"];

// ────────────────────────────────────────────────
// Helper timezone: WIB = UTC+7, tidak ada DST.
// PENTING: `createdAt` di database TIDAK disimpan sebagai UTC asli —
// yang disimpan adalah "jam WIB, tapi dilabeli sebagai UTC" (lihat
// buatPesanan() di pesananService.ts). Semua helper di bawah ini SENGAJA
// mengikuti konvensi yang sama (return value juga "WIB berlabel UTC"),
// supaya perbandingan `createdAt >= X` di Prisma selalu apple-to-apple.
// ────────────────────────────────────────────────
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function startOfDayWIB(base: Date = new Date()): Date {
  const wib = new Date(base.getTime() + WIB_OFFSET_MS);
  wib.setUTCHours(0, 0, 0, 0);
  return wib; // TIDAK digeser balik — biar sama ruang dgn createdAt tersimpan
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/**
 * Rentang satu bulan kalender WIB. `end` bersifat exclusive.
 * Dibangun langsung via Date.UTC — hasilnya otomatis di ruang "WIB
 * berlabel UTC" yang sama dengan createdAt tersimpan, TANPA shift lagi.
 */
function monthRangeWIB(tahun: number, bulan1indexed: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(tahun, bulan1indexed - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(tahun, bulan1indexed, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function getTransaksi(opts: { bulan?: number; tahun?: number; search?: string; page: number; perPage: number }) {
  const where: Record<string, unknown> = { status: "selesai" };
  if (opts.bulan && opts.tahun) {
    const { start, end } = monthRangeWIB(opts.tahun, opts.bulan);
    where.createdAt = { gte: start, lt: end };
  }

  let list = await prisma.pesanan.findMany({
    where,
    include: { meja: true, kasir: true, detailPesanan: true },
    orderBy: { createdAt: "desc" },
  });

  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.kodePesanan.toLowerCase().includes(q) ||
        p.namaPelanggan.toLowerCase().includes(q) ||
        p.meja.nomorMeja.toLowerCase().includes(q) ||
        (p.kasir?.namaLengkap || "").toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const totalRevenue = list.reduce((s, p) => s + Number(p.totalHarga), 0);
  const start = (opts.page - 1) * opts.perPage;
  const paged = list.slice(start, start + opts.perPage);

  return { data: paged, total, totalRevenue, avg: total ? Math.round(totalRevenue / total) : 0 };
}

export async function getTransaksiForExport(bulan?: number, tahun?: number) {
  const where: Record<string, unknown> = { status: "selesai" };
  if (bulan && tahun) {
    const { start, end } = monthRangeWIB(tahun, bulan);
    where.createdAt = { gte: start, lt: end };
  }
  return prisma.pesanan.findMany({
    where,
    include: { meja: true, kasir: true, detailPesanan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardAdmin() {
  const startToday = startOfDayWIB();
  const startTomorrow = addDays(startToday, 1);
  const startYesterday = addDays(startToday, -1);

  const [today, yesterday, activeMenuCount] = await Promise.all([
    prisma.pesanan.findMany({
      where: {
        createdAt: { gte: startToday, lt: startTomorrow },
        status: "selesai",
      },
      include: {
        detailPesanan: {
          include: { menu: { select: { kategori: true } } },
        },
      },
    }),
    prisma.pesanan.findMany({
      where: {
        createdAt: { gte: startYesterday, lt: startToday },
        status: "selesai",
      },
    }),
    prisma.menu.count({ where: { statusAktif: true } }),
  ]);

  const revToday = today.reduce((s, p) => s + Number(p.totalHarga), 0);
  const revYesterday = yesterday.reduce((s, p) => s + Number(p.totalHarga), 0);
  const itemTerjual = today.reduce((s, p) => s + p.detailPesanan.reduce((s2, d) => s2 + d.jumlah, 0), 0);

  const avgToday = today.length ? Math.round(revToday / today.length) : 0;
  const avgYesterday = yesterday.length ? Math.round(revYesterday / yesterday.length) : 0;

  const dayRanges = Array.from({ length: 7 }, (_, idx) => {
    const i = 6 - idx;
    const d = addDays(startToday, -i);
    return { start: d, end: addDays(d, 1) };
  });

  const dayLists = await Promise.all(
    dayRanges.map(({ start, end }) =>
      prisma.pesanan.findMany({
        where: { createdAt: { gte: start, lt: end }, status: "selesai" },
      })
    )
  );

  const days = dayRanges.map(({ start }, idx) => ({
    label: start.toLocaleDateString("id-ID", { weekday: "short", timeZone: "UTC" }),
    total: dayLists[idx].reduce((s, p) => s + Number(p.totalHarga), 0),
  }));

  const qris = today.filter((p) => p.metodePembayaran === "qris");
  const cash = today.filter((p) => p.metodePembayaran === "cash");

  const itemMap = new Map<string, { kategori: string; qty: number; revenue: number }>();
  today.forEach((p) =>
    p.detailPesanan.forEach((d) => {
      const cur = itemMap.get(d.namaItem) || { kategori: d.menu?.kategori ?? "Bundling", qty: 0, revenue: 0 };
      cur.qty += d.jumlah;
      cur.revenue += Number(d.subtotal);
      itemMap.set(d.namaItem, cur);
    })
  );

  const terlarisRaw = Array.from(itemMap.entries())
    .map(([nama, v]) => ({ id: nama, nama, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const maxQty = terlarisRaw[0]?.qty || 1;
  const terlaris = terlarisRaw.map((m) => ({
    ...m,
    pct: Math.round((m.qty / maxQty) * 100),
  }));

  let trendPendapatan = 0;
  let trendPendapatanLabel = "";

  if (revYesterday === 0) {
    if (revToday > 0) {
      trendPendapatanLabel = "Baru ada transaksi hari ini";
    } else {
      trendPendapatanLabel = "Belum ada transaksi";
    }
  } else {
    trendPendapatan = Math.round(((revToday - revYesterday) / revYesterday) * 100);
    trendPendapatanLabel = `${Math.abs(trendPendapatan)}% dari kemarin`;
  }

  return {
    pendapatanHariIni: revToday,
    trendPendapatan,
    trendPendapatanLabel,

    totalTransaksi: today.length,
    totalTransaksiKemarin: yesterday.length,
    trendTransaksi: today.length - yesterday.length,

    itemTerjual,
    activeMenuCount,

    rataRataPesanan: avgToday,
    rataRataPesananKemarin: avgYesterday,
    trendRataRata: avgToday - avgYesterday,

    pendapatan7Hari: days,
    qrisCount: qris.length,
    cashCount: cash.length,
    qrisPercent: today.length ? Math.round((qris.length / today.length) * 100) : 0,
    menuTerlaris: terlaris,
  };
}

export async function getAnalisis(tahun: number) {
  const nowWIB = startOfDayWIB();
  const currentYearWIB = nowWIB.getUTCFullYear();
  const currentMonthWIB = nowWIB.getUTCMonth() + 1; // 1-indexed

  const bulanTerakhir = tahun === currentYearWIB ? currentMonthWIB : 12;
  const bulanRanges = Array.from({ length: bulanTerakhir }, (_, idx) => {
    const bulan = idx + 1;
    const { start, end } = monthRangeWIB(tahun, bulan);
    return { bulan, start, end };
  });

  const bulanLists = await Promise.all(
    bulanRanges.map(({ start, end }) =>
      prisma.pesanan.findMany({
        where: { createdAt: { gte: start, lt: end }, status: "selesai" },
      })
    )
  );

  const bulanData = bulanRanges.map(({ start }, idx) => ({
    label: start.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }),
    total: bulanLists[idx].reduce((s, p) => s + Number(p.totalHarga), 0),
  }));

  const { start: startBulanIniKasir, end: endBulanIniKasir } = monthRangeWIB(currentYearWIB, currentMonthWIB);

  const performaKasir = await prisma.pengguna.findMany({
    where: { peran: "kasir" },
    include: {
      pesanan: {
        where: {
          status: "selesai",
          createdAt: { gte: startBulanIniKasir, lt: endBulanIniKasir },
        },
      },
    },
  });

  const hasilKasir = performaKasir
    .map((k) => ({
      nama: k.namaLengkap,
      transaksi: k.pesanan.length,
      pendapatan: k.pesanan.reduce((s, p) => s + Number(p.totalHarga), 0),
    }))
    .sort((a, b) => b.pendapatan - a.pendapatan);

  const isTahunBerjalan = tahun === currentYearWIB;

  let jamTersibuk: { label: string; count: number }[] = [];
  let insight = {
    trendPendapatanBulanIni: 0,
    bestSeller: null as { nama: string; qty: number } | null,
    peakHourLabel: "-",
    qrisPercentBulanIni: 0,
  };

  if (isTahunBerjalan) {
    const { start: startBulanIni, end: endBulanIni } = monthRangeWIB(currentYearWIB, currentMonthWIB);
    const bulanLaluTahun = currentMonthWIB === 1 ? currentYearWIB - 1 : currentYearWIB;
    const bulanLaluBulan = currentMonthWIB === 1 ? 12 : currentMonthWIB - 1;
    const { start: startBulanLalu, end: endBulanLalu } = monthRangeWIB(bulanLaluTahun, bulanLaluBulan);

    const [pesananBulanIni, pesananBulanLalu] = await Promise.all([
      prisma.pesanan.findMany({
        where: { createdAt: { gte: startBulanIni, lt: endBulanIni }, status: "selesai" },
        include: { detailPesanan: true },
      }),
      prisma.pesanan.findMany({
        where: { createdAt: { gte: startBulanLalu, lt: endBulanLalu }, status: "selesai" },
      }),
    ]);

    const HOUR_BUCKETS = [18, 19, 20, 21, 22, 23, 0, 1];
    const hourCounts = new Map<number, number>(HOUR_BUCKETS.map((h) => [h, 0]));

    pesananBulanIni.forEach((p) => {
      const hourWIB = p.createdAt.getUTCHours();
      if (hourCounts.has(hourWIB)) {
        hourCounts.set(hourWIB, (hourCounts.get(hourWIB) || 0) + 1);
      }
    });

    jamTersibuk = HOUR_BUCKETS.map((h) => ({
      label: `${String(h).padStart(2, "0")}-${String((h + 1) % 24).padStart(2, "0")}`,
      count: hourCounts.get(h) || 0,
    }));

    const revBulanIni = pesananBulanIni.reduce((s, p) => s + Number(p.totalHarga), 0);
    const revBulanLalu = pesananBulanLalu.reduce((s, p) => s + Number(p.totalHarga), 0);
    const trendPendapatanBulanIni = revBulanLalu
      ? Math.round(((revBulanIni - revBulanLalu) / revBulanLalu) * 100)
      : revBulanIni > 0
      ? 100
      : 0;

    const itemMap = new Map<string, number>();
    pesananBulanIni.forEach((p) =>
      p.detailPesanan.forEach((d) => {
        itemMap.set(d.namaItem, (itemMap.get(d.namaItem) || 0) + d.jumlah);
      })
    );
    const bestSellerEntry = Array.from(itemMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const bestSeller = bestSellerEntry ? { nama: bestSellerEntry[0], qty: bestSellerEntry[1] } : null;

    const totalJamCount = jamTersibuk.reduce((s, j) => s + j.count, 0);
    const peakBucket =
      totalJamCount > 0
        ? jamTersibuk.reduce((max, cur) => (cur.count > max.count ? cur : max), jamTersibuk[0])
        : null;
    const peakHourLabel = peakBucket ? peakBucket.label.replace("-", ".00–") + ".00" : "-";

    const qrisBulanIni = pesananBulanIni.filter((p) => p.metodePembayaran === "qris").length;
    const qrisPercentBulanIni = pesananBulanIni.length
      ? Math.round((qrisBulanIni / pesananBulanIni.length) * 100)
      : 0;

    insight = { trendPendapatanBulanIni, bestSeller, peakHourLabel, qrisPercentBulanIni };
  }

  return {
    pendapatanBulanan: bulanData,
    performaKasir: hasilKasir,
    jamTersibuk,
    insight,
  };
}