-- CreateTable
CREATE TABLE `pengguna` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama_lengkap` VARCHAR(50) NOT NULL,
    `username` VARCHAR(20) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `no_telepon` VARCHAR(15) NULL,
    `email` VARCHAR(50) NULL,
    `peran` ENUM('admin', 'kasir') NOT NULL,
    `level_admin` TINYINT UNSIGNED NULL,
    `wajib_ganti_password` BOOLEAN NOT NULL DEFAULT false,
    `status_aktif` BOOLEAN NOT NULL DEFAULT true,
    `reset_token` VARCHAR(64) NULL,
    `reset_token_expiry` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_pengguna_username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `jenis` ENUM('menu', 'bundling') NOT NULL,
    `kategori` VARCHAR(20) NULL,
    `nama` VARCHAR(40) NOT NULL,
    `deskripsi` VARCHAR(100) NULL,
    `harga` DECIMAL(6, 0) NOT NULL,
    `foto` VARCHAR(80) NULL,
    `butuh_varian` BOOLEAN NOT NULL DEFAULT true,
    `status_aktif` BOOLEAN NOT NULL DEFAULT true,
    `status_diskon` BOOLEAN NOT NULL DEFAULT false,
    `persentase_diskon` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `tanggal_mulai_diskon` DATE NULL,
    `tanggal_selesai_diskon` DATE NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_bundling` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_bundling` INTEGER UNSIGNED NOT NULL,
    `id_menu` INTEGER UNSIGNED NOT NULL,
    `jumlah` TINYINT UNSIGNED NOT NULL DEFAULT 1,

    INDEX `idx_item_bundling_id_bundling`(`id_bundling`),
    INDEX `fk_item_bundling_menu`(`id_menu`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meja` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nomor_meja` VARCHAR(5) NOT NULL,
    `status_aktif` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_meja_nomor_meja`(`nomor_meja`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pesanan` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `kode_pesanan` VARCHAR(15) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `tanggal_pesanan` DATE NOT NULL DEFAULT (cast(`created_at` as date)),
    `id_meja` SMALLINT UNSIGNED NOT NULL,
    `id_kasir` INTEGER UNSIGNED NULL,
    `nama_pelanggan` VARCHAR(50) NOT NULL,
    `telepon_pelanggan` VARCHAR(15) NOT NULL,
    `metode_pembayaran` ENUM('cash', 'qris') NOT NULL,
    `bukti_pembayaran` VARCHAR(100) NULL,
    `status` ENUM('menunggu_konfirmasi', 'diproses', 'sedang_disiapkan', 'sedang_diantar', 'selesai', 'dibatalkan') NOT NULL,
    `alasan_pembatalan` VARCHAR(100) NULL,
    `catatan` TEXT NULL,
    `total_harga` DECIMAL(7, 0) NOT NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `kode_pesanan`(`kode_pesanan`),
    INDEX `idx_pesanan_id_kasir`(`id_kasir`),
    INDEX `idx_pesanan_id_meja`(`id_meja`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detail_pesanan` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_pesanan` INTEGER UNSIGNED NOT NULL,
    `id_menu` INTEGER UNSIGNED NULL,
    `nama_item` VARCHAR(50) NOT NULL,
    `harga` DECIMAL(6, 0) NOT NULL,
    `jumlah` TINYINT UNSIGNED NOT NULL,
    `varian` ENUM('iced', 'hot') NULL,
    `catatan_item` VARCHAR(80) NULL,
    `subtotal` DECIMAL(7, 0) NOT NULL,

    INDEX `idx_detail_pesanan_id_menu`(`id_menu`),
    INDEX `fk_detail_pesanan_pesanan`(`id_pesanan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qris` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `gambar_qris` VARCHAR(60) NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_bundling` ADD CONSTRAINT `fk_item_bundling_bundling` FOREIGN KEY (`id_bundling`) REFERENCES `menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_bundling` ADD CONSTRAINT `fk_item_bundling_menu` FOREIGN KEY (`id_menu`) REFERENCES `menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pesanan` ADD CONSTRAINT `fk_pesanan_kasir` FOREIGN KEY (`id_kasir`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pesanan` ADD CONSTRAINT `fk_pesanan_meja` FOREIGN KEY (`id_meja`) REFERENCES `meja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_pesanan` ADD CONSTRAINT `fk_detail_pesanan_menu` FOREIGN KEY (`id_menu`) REFERENCES `menu`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_pesanan` ADD CONSTRAINT `fk_detail_pesanan_pesanan` FOREIGN KEY (`id_pesanan`) REFERENCES `pesanan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
