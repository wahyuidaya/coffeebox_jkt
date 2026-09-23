import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { MenuTampil } from "@/types/menu";

const CAT_SLUG_MAP: Record<string, string> = {
  "Basic Coffee": "basic",
  "Black Coffee": "black",
  "Non Coffee": "noncoff",
  "Hidden Coffee": "hidden",
  "The 10k Club": "club",
  Makanan: "makanan",
};

const NAMA_MAX_LEN = 40;
const DESKRIPSI_MAX_LEN = 100;
const KATEGORI_MAX_LEN = 20;
const HARGA_MAX = 999_999;

const KATEGORI_RESERVED = ["bundling"];

// ────────────────────────────────────────────────
// HELPER TANGGAL (FIX zona waktu diskon)
// ────────────────────────────────────────────────

function dbDateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayStrWIB(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function isDiskonAktif(menu: {
  statusDiskon: boolean;
  persentaseDiskon: number;
  tanggalMulaiDiskon: Date | null;
  tanggalSelesaiDiskon: Date | null;
}): boolean {
  if (!menu.statusDiskon || menu.persentaseDiskon <= 0) return false;
  const today = todayStrWIB();
  if (menu.tanggalMulaiDiskon && today < dbDateToStr(menu.tanggalMulaiDiskon)) return false;
  if (menu.tanggalSelesaiDiskon && today > dbDateToStr(menu.tanggalSelesaiDiskon)) return false;
  return true;
}

function badgeFromKategori(kategori: string | null): "hidden" | "club" | null {
  if (kategori === "Hidden Coffee") return "hidden";
  if (kategori === "The 10k Club") return "club";
  return null;
}

function slugifyKategori(kategori: string): string {
  const slug = kategori
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "lainnya";
}

// ────────────────────────────────────────────────
// VALIDATOR BERSAMA (dipakai oleh menu & bundling)
// ────────────────────────────────────────────────

/** Validasi nama, harga, dan deskripsi — dipakai untuk menu maupun bundling. */
function validateNamaHargaDeskripsi(nama: string, harga: number, deskripsi: string, label: string) {
  const namaTrim = nama.trim();
  if (!namaTrim) throw new Error(`Nama ${label} wajib diisi.`);
  if (namaTrim.length > NAMA_MAX_LEN) {
    throw new Error(`Nama ${label} maksimal ${NAMA_MAX_LEN} karakter.`);
  }

  if (!Number.isFinite(harga) || !Number.isInteger(harga) || harga <= 0) {
    throw new Error(`Harga ${label} harus berupa angka bulat lebih dari 0.`);
  }
  if (harga > HARGA_MAX) {
    throw new Error(`Harga ${label} maksimal Rp${HARGA_MAX.toLocaleString("id-ID")}.`);
  }

  if (deskripsi.trim().length > DESKRIPSI_MAX_LEN) {
    throw new Error(`Deskripsi maksimal ${DESKRIPSI_MAX_LEN} karakter.`);
  }
}

async function validateKategori(kategori: string): Promise<string> {
  const kategoriTrim = kategori.trim();
  if (!kategoriTrim) throw new Error("Kategori wajib diisi.");
  if (kategoriTrim.length > KATEGORI_MAX_LEN) {
    throw new Error(`Nama kategori maksimal ${KATEGORI_MAX_LEN} karakter.`);
  }
  if (KATEGORI_RESERVED.includes(kategoriTrim.toLowerCase())) {
    throw new Error(
      `Nama kategori "${kategoriTrim}" tidak dapat digunakan karena dipakai sistem untuk mengelompokkan menu bundling.`
    );
  }

  const daftarKategori = await getKategoriList();
  const existing = daftarKategori.find((k) => k.toLowerCase() === kategoriTrim.toLowerCase());
  return existing ?? kategoriTrim;
}

// ────────────────────────────────────────────────
// SISI PELANGGAN (Fase 2)
// ────────────────────────────────────────────────

/**
 * Mengambil seluruh menu + bundling aktif, dengan harga final (setelah diskon)
 * sudah dihitung, sesuai Kebutuhan Fungsional Pelanggan #1 & #2.
 */
export async function getMenuUntukPelanggan(): Promise<MenuTampil[]> {
  const semuaMenu = await prisma.menu.findMany({
    where: { statusAktif: true },
    orderBy: { id: "asc" },
  });

  const bundlingItems = await prisma.itemBundling.findMany({
    include: { menu: true },
  });

  const menuMap = new Map(semuaMenu.map((m) => [m.id, m]));

  return semuaMenu.map((m): MenuTampil => {
    const hargaAsli = Number(m.harga);
    const diskonAktif = isDiskonAktif(m);
    const harga = diskonAktif
      ? Math.round(hargaAsli - (hargaAsli * m.persentaseDiskon) / 100)
      : hargaAsli;

    if (m.jenis === "bundling") {
      const isi = bundlingItems
        .filter((it) => it.idBundling === m.id)
        .map((it) => menuMap.get(it.idMenu)?.nama)
        .filter((x): x is string => !!x);

      return {
        id: m.id,
        jenis: "bundling",
        kategori: "Bundling",
        catSlug: "bundling",
        nama: m.nama,
        deskripsi: isi.join(", "),
        harga,
        hargaAsli,
        sedangDiskon: diskonAktif,
        persentaseDiskon: m.persentaseDiskon,
        foto: m.foto,
        badge: null,
        bundleItems: isi,
        // Bundling tidak pernah punya konsep Iced/Hot tunggal (isinya bisa
        // campuran menu dingin & panas), jadi selalu false apa pun nilai
        // butuhVarian mentahnya di database.
        butuhVarian: false,
      };
    }

    return {
      id: m.id,
      jenis: "menu",
      kategori: m.kategori || "",
      // Kategori yang sudah dikenal pakai slug tetap (stabil), kategori baru
      // yang belum ada di CAT_SLUG_MAP dapat slug hasil generate otomatis
      // supaya bisa jadi tab filter tersendiri di halaman pelanggan.
      catSlug: CAT_SLUG_MAP[m.kategori || ""] || slugifyKategori(m.kategori || ""),
      nama: m.nama,
      deskripsi: m.deskripsi || "",
      harga,
      hargaAsli,
      sedangDiskon: diskonAktif,
      persentaseDiskon: m.persentaseDiskon,
      foto: m.foto,
      badge: badgeFromKategori(m.kategori),
      bundleItems: [],
      // Dikontrol per-menu oleh admin di halaman Kelola Menu, bukan lagi
      // hardcode berdasarkan kategori "Makanan".
      butuhVarian: m.butuhVarian,
    };
  });
}

// ────────────────────────────────────────────────
// SISI ADMIN (Fase 4) — Kelola Menu & Bundling
// ────────────────────────────────────────────────

export async function getAllMenuAdmin() {
  const data = await prisma.menu.findMany({
    orderBy: { id: "asc" },
    include: {
      itemSebagaiBundling: { select: { idMenu: true } },
    },
  });

  return data.map(({ itemSebagaiBundling, ...m }) => ({
    ...m,
    idMenuList: m.jenis === "bundling" ? itemSebagaiBundling.map((it) => it.idMenu) : undefined,
  }));
}

export async function getMenuById(id: number) {
  return prisma.menu.findUnique({
    where: { id },
    include: {
      itemSebagaiBundling: { select: { idMenu: true } },
    },
  });
}

interface MenuInput {
  nama: string;
  kategori: string;
  harga: number;
  deskripsi: string;
  foto: string | null;
  butuhVarian: boolean;
  statusDiskon: boolean;
  persentaseDiskon: number;
  tanggalMulaiDiskon: string | null;
  tanggalSelesaiDiskon: string | null;
}

function validateDiskon(input: MenuInput) {
  if (input.statusDiskon) {
    if (!Number.isInteger(input.persentaseDiskon) || input.persentaseDiskon < 1 || input.persentaseDiskon > 100) {
      throw new Error("Persentase diskon harus berupa angka bulat antara 1 - 100.");
    }
    if (!input.tanggalMulaiDiskon || !input.tanggalSelesaiDiskon) {
      throw new Error("Periode diskon wajib diisi.");
    }

    if (input.tanggalMulaiDiskon > input.tanggalSelesaiDiskon) {
      throw new Error("Tanggal mulai tidak boleh setelah tanggal berakhir.");
    }

    if (input.tanggalSelesaiDiskon < todayStrWIB()) {
      throw new Error(
        'Tanggal "Berlaku Sampai" tidak boleh tanggal yang sudah lewat. Diskon dengan periode yang sudah berakhir tidak akan pernah aktif.'
      );
    }
  }
}

export async function createMenu(input: MenuInput) {
  validateNamaHargaDeskripsi(input.nama, input.harga, input.deskripsi, "menu");
  const kategoriFinal = await validateKategori(input.kategori);
  validateDiskon(input);

  return prisma.menu.create({
    data: {
      jenis: "menu",
      nama: input.nama.trim(),
      kategori: kategoriFinal,
      harga: input.harga,
      deskripsi: input.deskripsi.trim(),
      foto: input.foto,
      butuhVarian: input.butuhVarian,
      statusDiskon: input.statusDiskon,
      persentaseDiskon: input.statusDiskon ? input.persentaseDiskon : 0,
      tanggalMulaiDiskon: input.statusDiskon ? new Date(input.tanggalMulaiDiskon!) : null,
      tanggalSelesaiDiskon: input.statusDiskon ? new Date(input.tanggalSelesaiDiskon!) : null,
    },
  });
}

export async function updateMenu(id: number, input: MenuInput) {
  validateNamaHargaDeskripsi(input.nama, input.harga, input.deskripsi, "menu");
  const kategoriFinal = await validateKategori(input.kategori);
  validateDiskon(input);

  return prisma.menu.update({
    where: { id },
    data: {
      nama: input.nama.trim(),
      kategori: kategoriFinal,
      harga: input.harga,
      deskripsi: input.deskripsi.trim(),
      foto: input.foto,
      butuhVarian: input.butuhVarian,
      statusDiskon: input.statusDiskon,
      persentaseDiskon: input.statusDiskon ? input.persentaseDiskon : 0,
      tanggalMulaiDiskon: input.statusDiskon ? new Date(input.tanggalMulaiDiskon!) : null,
      tanggalSelesaiDiskon: input.statusDiskon ? new Date(input.tanggalSelesaiDiskon!) : null,
    },
  });
}

export async function toggleMenuAktif(id: number) {
  const m = await prisma.menu.findUnique({ where: { id } });
  if (!m) throw new Error("Menu tidak ditemukan.");
  return prisma.menu.update({ where: { id }, data: { statusAktif: !m.statusAktif } });
}

export async function deleteMenu(id: number) {
  try {
    return await prisma.menu.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new Error(
        "Menu ini tidak bisa dihapus karena sudah pernah digunakan dalam transaksi. Nonaktifkan saja menu ini alih-alih menghapusnya."
      );
    }
    throw err;
  }
}

// ── Bundling ──
interface BundlingInput {
  nama: string;
  harga: number;
  deskripsi: string;
  tanggalMulaiDiskon: string | null; // dipakai sebagai periode berlaku bundling
  tanggalSelesaiDiskon: string | null;
  idMenuList: number[];
}

async function validateBundlingInput(input: BundlingInput) {
  validateNamaHargaDeskripsi(input.nama, input.harga, input.deskripsi, "bundling");

  if (input.tanggalMulaiDiskon && input.tanggalSelesaiDiskon) {
    if (input.tanggalMulaiDiskon > input.tanggalSelesaiDiskon) {
      throw new Error("Tanggal mulai tidak boleh setelah tanggal berakhir.");
    }
  }

  const idList = input.idMenuList;
  if (!Array.isArray(idList) || idList.length < 2) {
    throw new Error("Pilih minimal 2 menu untuk dijadikan bundling.");
  }
  if (idList.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("Daftar menu bundling tidak valid.");
  }
  if (new Set(idList).size !== idList.length) {
    throw new Error("Ada menu yang dipilih dua kali dalam bundling ini.");
  }

  const menuValid = await prisma.menu.findMany({
    where: { id: { in: idList }, jenis: "menu" },
    select: { id: true },
  });
  if (menuValid.length !== idList.length) {
    throw new Error("Salah satu menu yang dipilih tidak valid atau sudah dihapus.");
  }
}

export async function createBundling(input: BundlingInput) {
  await validateBundlingInput(input);

  return prisma.menu.create({
    data: {
      jenis: "bundling",
      nama: input.nama.trim(),
      harga: input.harga,
      deskripsi: input.deskripsi.trim(),
      tanggalMulaiDiskon: input.tanggalMulaiDiskon ? new Date(input.tanggalMulaiDiskon) : null,
      tanggalSelesaiDiskon: input.tanggalSelesaiDiskon ? new Date(input.tanggalSelesaiDiskon) : null,
      itemSebagaiBundling: {
        create: input.idMenuList.map((idMenu) => ({ idMenu, jumlah: 1 })),
      },
    },
  });
}

export async function updateBundling(id: number, input: BundlingInput) {
  await validateBundlingInput(input);

  return prisma.$transaction(async (tx) => {
    // Hapus dulu daftar item lama, baru buat ulang sesuai pilihan terbaru
    await tx.itemBundling.deleteMany({ where: { idBundling: id } });

    return tx.menu.update({
      where: { id },
      data: {
        nama: input.nama.trim(),
        harga: input.harga,
        deskripsi: input.deskripsi.trim(),
        tanggalMulaiDiskon: input.tanggalMulaiDiskon ? new Date(input.tanggalMulaiDiskon) : null,
        tanggalSelesaiDiskon: input.tanggalSelesaiDiskon ? new Date(input.tanggalSelesaiDiskon) : null,
        itemSebagaiBundling: {
          create: input.idMenuList.map((idMenu) => ({ idMenu, jumlah: 1 })),
        },
      },
    });
  });
}

export async function getKategoriList() {
  const rows = await prisma.menu.findMany({
    where: { jenis: "menu", kategori: { not: null } },
    distinct: ["kategori"],
    select: { kategori: true },
  });
  const preferredOrder = ["Basic Coffee", "Black Coffee", "Non Coffee", "Hidden Coffee", "The 10k Club", "Makanan"];
  const fromDb = Array.from(new Set(rows.map((r) => r.kategori!).filter(Boolean)));

  return fromDb.sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}