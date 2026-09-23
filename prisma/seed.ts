import { PrismaClient, JenisMenu } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // ===================================================================
  // AKUN PENGGUNA: hanya 1 super admin
  // ===================================================================
  await prisma.pengguna.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      namaLengkap: "Super Admin",
      username: "superadmin",
      password: hashedPassword,
      email: "superadmin@coffeebox.com",
      peran: "admin",
      levelAdmin: 1,
      wajibGantiPassword: false,
      statusAktif: true,
    },
  });

  // ===================================================================
  // KELOLA MENU (data disamakan dengan prototype Admin.html)
  // Urutan hapus: item_bundling dulu (child), baru menu (parent),
  // supaya tidak kena constraint foreign key kalau seed dijalankan ulang.
  // ===================================================================
  await prisma.itemBundling.deleteMany();
  await prisma.menu.deleteMany();

  type MenuSeed = {
    id: number;
    kategori: string;
    nama: string;
    deskripsi: string;
    harga: number;
    statusDiskon?: boolean;
    persentaseDiskon?: number;
  };

  // id sengaja mengikuti id pada array `menus` di Admin.html (termasuk
  // lompatan id 27 & 31-34 yang memang tidak dipakai di prototype)
  const menuSeeds: MenuSeed[] = [
    // --- Basic Coffee ---
    { id: 1, kategori: "Basic Coffee", nama: "Aren", deskripsi: "Espresso dengan gula aren asli.", harga: 15000, statusDiskon: true, persentaseDiskon: 10 },
    { id: 2, kategori: "Basic Coffee", nama: "Almond", deskripsi: "Espresso berpadu susu almond.", harga: 15000, statusDiskon: true, persentaseDiskon: 15 },
    { id: 3, kategori: "Basic Coffee", nama: "Tiramisu", deskripsi: "Perpaduan espresso dan tiramisu.", harga: 15000 },
    { id: 4, kategori: "Basic Coffee", nama: "Caramel", deskripsi: "Espresso dengan karamel manis.", harga: 15000 },
    { id: 5, kategori: "Basic Coffee", nama: "Vanilla", deskripsi: "Espresso dengan vanilla harum.", harga: 15000 },
    { id: 6, kategori: "Basic Coffee", nama: "Rum", deskripsi: "Espresso dengan aroma rum bold.", harga: 15000 },
    { id: 7, kategori: "Basic Coffee", nama: "Caffe Latte", deskripsi: "Espresso dengan steamed milk lembut.", harga: 18000, statusDiskon: true, persentaseDiskon: 10 },
    { id: 8, kategori: "Basic Coffee", nama: "Vietnam Drip", deskripsi: "Kopi tetes gaya Vietnam.", harga: 18000 },

    // --- Black Coffee ---
    { id: 9, kategori: "Black Coffee", nama: "Espresso", deskripsi: "Shot espresso murni.", harga: 10000, statusDiskon: true, persentaseDiskon: 20 },
    { id: 10, kategori: "Black Coffee", nama: "Black Coffee", deskripsi: "Kopi hitam panjang yang smooth.", harga: 18000 },
    { id: 11, kategori: "Black Coffee", nama: "Long Black", deskripsi: "Espresso di atas air panas.", harga: 20000 },
    { id: 12, kategori: "Black Coffee", nama: "Japanese", deskripsi: "Espresso brew di atas es.", harga: 20000 },
    { id: 13, kategori: "Black Coffee", nama: "V60", deskripsi: "Manual pour-over biji pilihan.", harga: 20000 },

    // --- Non Coffee ---
    { id: 14, kategori: "Non Coffee", nama: "Matcha Latte", deskripsi: "Matcha dengan susu creamy.", harga: 15000, statusDiskon: true, persentaseDiskon: 10 },
    { id: 15, kategori: "Non Coffee", nama: "Red Velvet", deskripsi: "Sirup red velvet berpadu susu segar dan whipped cream.", harga: 15000 },
    { id: 16, kategori: "Non Coffee", nama: "Coklat", deskripsi: "Cokelat premium leleh dengan susu hangat yang creamy.", harga: 15000 },
    { id: 17, kategori: "Non Coffee", nama: "Tiramishake", deskripsi: "Milkshake rasa tiramisu.", harga: 15000 },
    { id: 37, kategori: "Non Coffee", nama: "Teh Pucuk", deskripsi: "Teh dalam kemasan siap minum, segar untuk menemani nongkrong.", harga: 5000 },
    { id: 38, kategori: "Non Coffee", nama: "Air Mineral", deskripsi: "Air mineral dalam kemasan botol.", harga: 2000 },

    // --- Hidden Coffee ---
    { id: 18, kategori: "Hidden Coffee", nama: "Matcha Drift", deskripsi: "Matcha dengan layer espresso.", harga: 20000 },
    { id: 19, kategori: "Hidden Coffee", nama: "Kopi Jade", deskripsi: "Espresso berpadu sirup kayu manis dan rempah hangat.", harga: 20000 },
    { id: 20, kategori: "Hidden Coffee", nama: "Spanish Latte", deskripsi: "Espresso dengan susu kental manis.", harga: 20000, statusDiskon: true, persentaseDiskon: 15 },

    // --- The 10k Club ---
    { id: 21, kategori: "The 10k Club", nama: "Ice Presso", deskripsi: "Espresso shot di atas es.", harga: 10000 },
    { id: 22, kategori: "The 10k Club", nama: "Hot-Usucha", deskripsi: "Bubuk matcha usucha diseduh air panas, ringan dan lembut.", harga: 10000 },
    { id: 23, kategori: "The 10k Club", nama: "Van-Milk", deskripsi: "Susu hangat dengan vanilla.", harga: 10000 },

    // --- Makanan ---
    { id: 24, kategori: "Makanan", nama: "Nasi Goreng", deskripsi: "Nasi goreng bumbu spesial rumahan.", harga: 15000, statusDiskon: true, persentaseDiskon: 10 },
    { id: 25, kategori: "Makanan", nama: "Mie Goreng", deskripsi: "Mie goreng gurih dengan bumbu pas.", harga: 13000 },
    { id: 26, kategori: "Makanan", nama: "Mie Rebus", deskripsi: "Mie rebus hangat cocok buat nongkrong.", harga: 13000 },
    { id: 28, kategori: "Makanan", nama: "Kentang & Sosis", deskripsi: "Kentang goreng dengan potongan sosis.", harga: 8000 },
    { id: 29, kategori: "Makanan", nama: "Spaghetti", deskripsi: "Spaghetti saus rumahan yang gurih.", harga: 8000 },
    { id: 30, kategori: "Makanan", nama: "Roti Bakar", deskripsi: "Roti bakar dengan pilihan topping manis.", harga: 8000, statusDiskon: true, persentaseDiskon: 15 },
  ];

  for (const m of menuSeeds) {
    await prisma.menu.create({
      data: {
        id: m.id,
        jenis: JenisMenu.menu,
        kategori: m.kategori,
        nama: m.nama,
        deskripsi: m.deskripsi,
        harga: m.harga,
        statusAktif: true,
        statusDiskon: m.statusDiskon ?? false,
        persentaseDiskon: m.persentaseDiskon ?? 0,
      },
    });
  }

  // ===================================================================
  // BUNDLING (menu.jenis = "bundling" + relasi item_bundling)
  // ===================================================================
  type BundlingSeed = {
    id: number;
    nama: string;
    deskripsi: string;
    harga: number;
    items: number[]; // id menu anggota bundling (lihat menuSeeds di atas)
  };

  const bundlingSeeds: BundlingSeed[] = [
    { id: 35, nama: "Paket Nongkrong", deskripsi: "Cocok untuk menemani waktu santai.", harga: 20000, items: [1, 30] }, // Aren + Roti Bakar
    { id: 36, nama: "Paket Kenyang", deskripsi: "Paket hemat untuk mengisi perut.", harga: 17000, items: [24, 37] }, // Nasi Goreng + Teh Pucuk
  ];

  for (const b of bundlingSeeds) {
    await prisma.menu.create({
      data: {
        id: b.id,
        jenis: JenisMenu.bundling,
        nama: b.nama,
        deskripsi: b.deskripsi,
        harga: b.harga,
        statusAktif: true,
      },
    });

    await prisma.itemBundling.createMany({
      data: b.items.map((idMenu) => ({
        idBundling: b.id,
        idMenu,
        jumlah: 1,
      })),
    });
  }

  console.log("Seed berhasil dijalankan.");
  console.log(`- ${menuSeeds.length} menu (minuman & makanan)`);
  console.log(`- ${bundlingSeeds.length} paket bundling`);
  console.log("- 1 akun super admin");
  console.log("- Meja, pesanan, detail pesanan, admin lain, kasir, dan QRIS sengaja dikosongkan (isi manual).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });