"use client";

import { Fragment, useMemo, useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Search } from "lucide-react";

interface MenuItem {
  id: number;
  jenis: "menu" | "bundling";
  kategori: string | null;
  nama: string;
  deskripsi: string | null;
  harga: number;
  foto: string | null;
  butuhVarian: boolean;
  statusAktif: boolean;
  statusDiskon: boolean;
  persentaseDiskon: number;
  tanggalMulaiDiskon: string | null;
  tanggalSelesaiDiskon: string | null;
  idMenuList?: number[];
  bundlingItems?: unknown;
  bundleItems?: unknown;
  items?: unknown;
}

const NAMA_MAX_LEN = 40;
const DESKRIPSI_MAX_LEN = 100;
const KATEGORI_MAX_LEN = 20;
const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024;

const KATEGORI_BARU_VALUE = "__kategori_baru__";
const KATEGORI_HAPUS_MODE_VALUE = "__hapus_kategori_mode__";

function getBundleMenuIds(m: MenuItem): number[] {
  if (Array.isArray(m.idMenuList) && m.idMenuList.length > 0) return m.idMenuList;
  const candidates = [m.bundlingItems, m.bundleItems, m.items];
  for (const c of candidates) {
    if (!Array.isArray(c) || c.length === 0) continue;
    const first = c[0];
    if (typeof first === "number") return c as number[];
    if (first && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      if (typeof obj.id === "number") return (c as Record<string, unknown>[]).map((x) => x.id as number);
      if (typeof obj.menuId === "number") return (c as Record<string, unknown>[]).map((x) => x.menuId as number);
      if (obj.menu && typeof (obj.menu as Record<string, unknown>).id === "number") {
        return (c as Record<string, unknown>[]).map((x) => (x.menu as Record<string, unknown>).id as number);
      }
    }
  }
  return [];
}

function todayStrWIB(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function isDiskonSedangAktif(m: MenuItem): boolean {
  if (!m.statusDiskon || !m.persentaseDiskon) return false;
  const today = todayStrWIB();
  if (m.tanggalMulaiDiskon && today < m.tanggalMulaiDiskon.slice(0, 10)) return false;
  if (m.tanggalSelesaiDiskon && today > m.tanggalSelesaiDiskon.slice(0, 10)) return false;
  return true;
}

function hargaSetelahDiskon(m: MenuItem) {
  if (!isDiskonSedangAktif(m)) return m.harga;
  return Math.round(m.harga - (m.harga * m.persentaseDiskon) / 100);
}

function getPlaceholderIcon(m: MenuItem): string {
  if (m.jenis === "bundling") return "🎁";
  if (m.kategori === "Makanan") return "🍽️";
  return "☕";
}

function validateRentangTanggal(mulai: string, selesai: string): string | null {
  if (mulai && selesai && mulai > selesai) {
    return "Tanggal \"Berlaku Dari\" tidak boleh setelah tanggal \"Berlaku Sampai\".";
  }
  if (selesai) {
    if (selesai < todayStrWIB()) {
      return "Tanggal \"Berlaku Sampai\" tidak boleh tanggal yang sudah lewat. Diskon dengan periode yang sudah berakhir tidak akan pernah aktif.";
    }
  }
  return null;
}

export default function MenuClient({ initialMenu, kategoriList }: { initialMenu: MenuItem[]; kategoriList: string[] }) {
  const [menu, setMenu] = useState(initialMenu);
  const [filt, setFilt] = useState("Semua");
  const [search, setSearch] = useState("");
  const { showToast } = useToast();

  // kategoriList sekarang state lokal, supaya begitu admin menambahkan menu
  // dengan kategori baru, chip filter & dropdown langsung ter-update tanpa
  // perlu refresh halaman penuh.
  const [kategoriListState, setKategoriListState] = useState(kategoriList);

  const [menuModal, setMenuModal] = useState<{ open: boolean; edit: MenuItem | null }>({ open: false, edit: null });
  const [mNama, setMNama] = useState("");
  const [mKategori, setMKategori] = useState(kategoriListState[0] || "Basic Coffee");
  const [mKategoriBaru, setMKategoriBaru] = useState(""); // nama kategori baru saat opsi "+ Tambah kategori baru" dipilih
  const [mHarga, setMHarga] = useState("");
  const [mDesk, setMDesk] = useState("");
  const [mFoto, setMFoto] = useState<string | null>(null);
  const [mButuhVarian, setMButuhVarian] = useState(true); // default menu punya pilihan Iced/Hot
  const [mDiskon, setMDiskon] = useState(false);
  const [mPersen, setMPersen] = useState("");
  const [mMulai, setMMulai] = useState("");
  const [mSelesai, setMSelesai] = useState("");
  const [mError, setMError] = useState("");
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);

  // mode "hapus kategori": diaktifkan lewat opsi paling bawah di dropdown
  // kategori. Saat aktif, daftar kategori tampil sebagai checkbox supaya
  // admin bisa centang beberapa kategori sekaligus lalu hapus semuanya.
  const [kategoriHapusMode, setKategoriHapusMode] = useState(false);
  const [kategoriChecked, setKategoriChecked] = useState<Set<string>>(new Set());

  const [bundlingModal, setBundlingModal] = useState<{ open: boolean; edit: MenuItem | null }>({ open: false, edit: null });
  const [bNama, setBNama] = useState("");
  const [bHarga, setBHarga] = useState("");
  const [bDesk, setBDesk] = useState("");
  const [bMulai, setBMulai] = useState("");
  const [bSelesai, setBSelesai] = useState("");
  const [bSelected, setBSelected] = useState<number[]>([]);
  const [bError, setBError] = useState("");
  const [isSavingBundling, setIsSavingBundling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // konfirmasi hapus kategori (batch — bisa lebih dari satu kategori sekaligus,
  // dipilih lewat checkbox di mode "hapus kategori")
  const [kategoriHapusBatch, setKategoriHapusBatch] = useState<string[] | null>(null);

  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  async function refresh() {
    try {
      const res = await fetch("/api/admin/menu", { cache: "no-store" });
      if (res.ok) setMenu((await res.json()).menu);
    } catch {
      showToast({ type: "error", title: "Gagal memuat ulang data menu", detail: "Silakan periksa koneksi internet Anda dan coba lagi." });
    }
  }

  const groupOrder = useMemo(() => [...kategoriListState, "Bundling"], [kategoriListState]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    menu.forEach((m) => {
      const g = m.jenis === "bundling" ? "Bundling" : m.kategori || "Lainnya";
      c[g] = (c[g] || 0) + 1;
    });
    // Pakai isDiskonSedangAktif (cek tanggal), bukan m.statusDiskon mentah,
    // supaya menu yang periode diskonnya sudah lewat tidak ikut kehitung di
    // chip "🔥 Diskon".
    c["Diskon"] = menu.filter((m) => isDiskonSedangAktif(m)).length;
    return c;
  }, [menu]);

  function matchesSearch(m: MenuItem) {
    if (!search.trim()) return true;
    return m.nama.toLowerCase().includes(search.trim().toLowerCase());
  }

  function itemsOfGroup(g: string) {
    return menu
      .filter((m) => (g === "Bundling" ? m.jenis === "bundling" : m.jenis !== "bundling" && m.kategori === g))
      .filter(matchesSearch);
  }

  function itemsOfDiskon() {
    // Sama seperti counts["Diskon"] di atas — filter berbasis tanggal, bukan
    // flag mentah, supaya konsisten dengan yang ditampilkan di kartu.
    return menu.filter((m) => isDiskonSedangAktif(m)).filter(matchesSearch);
  }

  const allGroups = useMemo(() => {
    if (filt !== "Semua") return [];
    return groupOrder.map((g) => ({ name: g, items: itemsOfGroup(g) })).filter((grp) => grp.items.length > 0);
  }, [menu, filt, search, groupOrder]);

  const singleGroupItems = useMemo(() => {
    if (filt === "Semua") return null;
    if (filt === "Diskon") return itemsOfDiskon();
    return itemsOfGroup(filt);
  }, [menu, filt, search]);

  function openAddMenu() {
    setMenuModal({ open: true, edit: null });
    setMNama(""); setMKategori(kategoriListState[0]); setMKategoriBaru(""); setMHarga(""); setMDesk(""); setMFoto(null);
    setMButuhVarian(true); // default menu baru punya pilihan Iced/Hot
    setMDiskon(false); setMPersen(""); setMMulai(""); setMSelesai(""); setMError("");
    setKategoriHapusMode(false); setKategoriChecked(new Set());
  }
  function openEditMenu(m: MenuItem) {
    setMenuModal({ open: true, edit: m });
    setMNama(m.nama); setMKategori(m.kategori || kategoriListState[0]); setMKategoriBaru(""); setMHarga(String(m.harga)); setMDesk(m.deskripsi || "");
    setMFoto(m.foto);
    setMButuhVarian(m.butuhVarian ?? true); // pulihkan nilai tersimpan (default true kalau belum ada data lama)
    setMDiskon(m.statusDiskon); setMPersen(String(m.persentaseDiskon || ""));
    setMMulai(m.tanggalMulaiDiskon?.slice(0, 10) || ""); setMSelesai(m.tanggalSelesaiDiskon?.slice(0, 10) || ""); setMError("");
    setKategoriHapusMode(false); setKategoriChecked(new Set());
  }

  async function handleUploadFoto(file: File) {
    if (!file.type.startsWith("image/")) {
      showToast({ type: "error", title: "File tidak valid", detail: "Foto menu harus berupa gambar (JPG, PNG, dsb)." });
      return;
    }
    if (file.size > MAX_FOTO_SIZE_BYTES) {
      showToast({ type: "error", title: "Ukuran file terlalu besar", detail: "Maksimal ukuran foto adalah 2MB." });
      return;
    }

    setIsUploadingFoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "menu");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: form });
      if (!res.ok) {
        showToast({ type: "error", title: "Gagal mengunggah foto", detail: "Silakan coba lagi atau gunakan file lain." });
        return;
      }
      setMFoto((await res.json()).url);
    } catch {
      showToast({ type: "error", title: "Gagal mengunggah foto", detail: "Silakan periksa koneksi internet Anda." });
    } finally {
      setIsUploadingFoto(false);
    }
  }

  // Kategori final yang akan dikirim ke server — hasil pilihan dropdown, atau
  // hasil ketikan di input "kategori baru" kalau opsi itu yang dipilih.
  function resolveKategoriFinal(): string {
    return mKategori === KATEGORI_BARU_VALUE ? mKategoriBaru.trim() : mKategori;
  }

  function validateMenuForm(): string | null {
    const nama = mNama.trim();
    if (!nama) return "Nama menu wajib diisi.";
    if (nama.length > NAMA_MAX_LEN) return `Nama menu maksimal ${NAMA_MAX_LEN} karakter.`;

    if (mKategori === KATEGORI_BARU_VALUE) {
      const kategoriBaru = mKategoriBaru.trim();
      if (!kategoriBaru) return "Nama kategori baru wajib diisi.";
      if (kategoriBaru.length > KATEGORI_MAX_LEN) return `Nama kategori maksimal ${KATEGORI_MAX_LEN} karakter.`;
      if (kategoriBaru.toLowerCase() === "bundling") {
        return 'Nama kategori "Bundling" tidak dapat digunakan karena dipakai sistem untuk mengelompokkan menu bundling.';
      }
    }

    const harga = Number(mHarga);
    if (mHarga.trim() === "" || !Number.isFinite(harga) || harga <= 0) {
      return "Harga harus berupa angka lebih besar dari 0.";
    }

    if (mDesk.trim().length > DESKRIPSI_MAX_LEN) {
      return `Deskripsi maksimal ${DESKRIPSI_MAX_LEN} karakter.`;
    }

    if (mDiskon) {
      const persen = Number(mPersen);
      if (mPersen.trim() === "" || !Number.isInteger(persen) || persen < 1 || persen > 100) {
        return "Persentase diskon harus berupa angka bulat antara 1 dan 100.";
      }
      // FIX: server (menuService.validateDiskon) MEWAJIBKAN kedua tanggal
      // diisi saat diskon aktif, tapi sebelumnya client tidak pernah
      // mengecek ini — admin bisa menyalakan toggle diskon, isi persentase,
      // tapi lupa isi tanggal, lalu baru ditolak di server dengan pesan
      // umum. Sekarang dicek duluan di sini supaya errornya jelas dari awal.
      if (!mMulai || !mSelesai) {
        return 'Periode diskon ("Berlaku Dari" dan "Berlaku Sampai") wajib diisi.';
      }
      const tanggalErr = validateRentangTanggal(mMulai, mSelesai);
      if (tanggalErr) return tanggalErr;
    }

    return null;
  }

  async function saveMenu() {
    const validationError = validateMenuForm();
    if (validationError) { setMError(validationError); return; }

    const kategoriFinal = resolveKategoriFinal();

    setMError("");
    setIsSavingMenu(true);
    try {
      const payload = {
        nama: mNama.trim(), kategori: kategoriFinal, harga: Number(mHarga), deskripsi: mDesk.trim(), foto: mFoto,
        butuhVarian: mButuhVarian,
        statusDiskon: mDiskon, persentaseDiskon: mDiskon ? Number(mPersen) : 0,
        tanggalMulaiDiskon: mDiskon ? (mMulai || null) : null,
        tanggalSelesaiDiskon: mDiskon ? (mSelesai || null) : null,
      };
      const url = menuModal.edit ? `/api/admin/menu/${menuModal.edit.id}` : "/api/admin/menu";
      const res = await fetch(url, {
        method: menuModal.edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMError(data?.message || "Gagal menyimpan data menu. Silakan coba lagi.");
        return;
      }
      // Kalau kategori baru berhasil dipakai, langsung masukkan ke daftar
      // kategori lokal supaya chip filter & dropdown ter-update seketika.
      if (mKategori === KATEGORI_BARU_VALUE) {
        setKategoriListState((prev) =>
          prev.some((k) => k.toLowerCase() === kategoriFinal.toLowerCase()) ? prev : [...prev, kategoriFinal]
        );
      }
      setMenuModal({ open: false, edit: null });
      await refresh();
      showToast({ type: "success", title: menuModal.edit ? "Menu diperbarui" : "Menu ditambahkan", detail: `"${mNama.trim()}" berhasil disimpan.` });
    } catch {
      setMError("Gagal terhubung ke server. Silakan periksa koneksi internet Anda.");
    } finally {
      setIsSavingMenu(false);
    }
  }

  async function toggleAktif(id: number) {
    if (togglingIds.has(id)) return;
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      if (!res.ok) {
        showToast({ type: "error", title: "Gagal mengubah status", detail: "Silakan coba lagi dalam beberapa saat." });
        return;
      }
      await refresh();
    } catch {
      showToast({ type: "error", title: "Gagal mengubah status", detail: "Silakan periksa koneksi internet Anda." });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function requestHapusMenu(m: MenuItem) { setDeleteTarget(m); }

  async function confirmHapusMenu() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/menu/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast({ type: "error", title: "Gagal menghapus menu", detail: data?.message || "Silakan coba lagi dalam beberapa saat." });
        return;
      }
      await refresh();
      showToast({ type: "success", title: "Menu dihapus", detail: `"${deleteTarget.nama}" telah dihapus dari daftar menu.` });
      setDeleteTarget(null);
    } catch {
      showToast({ type: "error", title: "Gagal menghapus menu", detail: "Silakan periksa koneksi internet Anda." });
    } finally {
      setIsDeleting(false);
    }
  }

  function countMenuByKategori(k: string) {
    return menu.filter((m) => m.jenis === "menu" && m.kategori === k).length;
  }

  function toggleKategoriChecked(k: string) {
    setKategoriChecked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function requestHapusKategoriBatch() {
    const dipilih = Array.from(kategoriChecked);
    if (dipilih.length === 0) {
      showToast({ type: "error", title: "Belum ada kategori dipilih", detail: "Centang minimal satu kategori yang ingin dihapus." });
      return;
    }
    const dipakai = dipilih.filter((k) => countMenuByKategori(k) > 0);
    if (dipakai.length > 0) {
      showToast({
        type: "error",
        title: "Kategori masih dipakai",
        detail: `Kategori ${dipakai.map((k) => `"${k}"`).join(", ")} masih dipakai oleh menu. Pindahkan menu tersebut ke kategori lain (atau hapus menunya) dulu sebelum menghapus kategori ini.`,
      });
      return;
    }
    setKategoriHapusBatch(dipilih);
  }

  function confirmHapusKategoriBatch() {
    if (!kategoriHapusBatch || kategoriHapusBatch.length === 0) return;
    const dihapus = new Set(kategoriHapusBatch);
    setKategoriListState((prev) => prev.filter((x) => !dihapus.has(x)));
    if (dihapus.has(mKategori)) setMKategori(kategoriListState.find((x) => !dihapus.has(x)) || kategoriListState[0]);
    if (dihapus.has(filt)) setFilt("Semua");
    showToast({
      type: "success",
      title: "Kategori dihapus",
      detail: `${kategoriHapusBatch.length} kategori berhasil dihapus dari daftar.`,
    });
    setKategoriHapusBatch(null);
    setKategoriChecked(new Set());
    setKategoriHapusMode(false);
  }

  function openAddBundling() {
    setBundlingModal({ open: true, edit: null });
    setBNama(""); setBHarga(""); setBDesk(""); setBMulai(""); setBSelesai(""); setBSelected([]); setBError("");
  }
  function openEditBundling(m: MenuItem) {
    setBundlingModal({ open: true, edit: m });
    setBNama(m.nama);
    setBHarga(String(m.harga));
    setBDesk(m.deskripsi || "");
    setBMulai(m.tanggalMulaiDiskon?.slice(0, 10) || "");
    setBSelesai(m.tanggalSelesaiDiskon?.slice(0, 10) || "");
    setBSelected(getBundleMenuIds(m));
    setBError("");
  }
  function toggleBundlingItem(id: number) {
    setBSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function validateBundlingForm(): string | null {
    const nama = bNama.trim();
    if (!nama) return "Nama bundling wajib diisi.";
    if (nama.length > NAMA_MAX_LEN) return `Nama bundling maksimal ${NAMA_MAX_LEN} karakter.`;

    const harga = Number(bHarga);
    if (bHarga.trim() === "" || !Number.isFinite(harga) || harga <= 0) {
      return "Harga bundling harus berupa angka lebih besar dari 0.";
    }

    if (bDesk.trim().length > DESKRIPSI_MAX_LEN) {
      return `Deskripsi maksimal ${DESKRIPSI_MAX_LEN} karakter.`;
    }

    const tanggalErr = validateRentangTanggal(bMulai, bSelesai);
    if (tanggalErr) return tanggalErr;

    if (bSelected.length < 2) return "Pilih minimal 2 menu untuk dijadikan satu paket bundling.";

    return null;
  }

  async function saveBundling() {
    const validationError = validateBundlingForm();
    if (validationError) { setBError(validationError); return; }

    setBError("");
    setIsSavingBundling(true);
    try {
      const url = bundlingModal.edit ? `/api/admin/bundling/${bundlingModal.edit.id}` : "/api/admin/bundling";
      const res = await fetch(url, {
        method: bundlingModal.edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: bNama.trim(), harga: Number(bHarga), deskripsi: bDesk.trim(),
          tanggalMulaiDiskon: bMulai || null, tanggalSelesaiDiskon: bSelesai || null, idMenuList: bSelected,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setBError(data?.message || "Gagal menyimpan data bundling. Silakan coba lagi.");
        return;
      }
      setBundlingModal({ open: false, edit: null });
      await refresh();
      showToast({ type: "success", title: bundlingModal.edit ? "Bundling diperbarui" : "Bundling ditambahkan", detail: `"${bNama.trim()}" berhasil disimpan.` });
    } catch {
      setBError("Gagal terhubung ke server. Silakan periksa koneksi internet Anda.");
    } finally {
      setIsSavingBundling(false);
    }
  }

  function renderCard(m: MenuItem) {
    const isToggling = togglingIds.has(m.id);
    // Pakai isDiskonSedangAktif (berbasis tanggal kalender WIB) untuk
    // menentukan apa yang ditampilkan di kartu, bukan m.statusDiskon mentah.
    const diskonAktif = isDiskonSedangAktif(m);
    return (
      <div className="mcard" key={m.id}>
        <div className="mcard-img-wrap">
          {m.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mcard-img-real" src={m.foto} alt={m.nama} />
          ) : (
            <div className="mcard-img-ph">{getPlaceholderIcon(m)}</div>
          )}
        </div>
        <div className="mcard-body">
          <div className="mcard-body-hdr">
            <div>
              <div className="mcard-name">{m.nama}</div>
              <div className="mcard-cat">{m.jenis === "bundling" ? "Bundling" : m.kategori}</div>
            </div>
            <span className={`badge mcard-badge-sm ${m.statusAktif ? "b-on" : "b-off"}`}>{m.statusAktif ? "Aktif" : "Nonaktif"}</span>
          </div>
          <div className="mcard-price">
            {diskonAktif ? (
              <div>
                <div className="mcard-disc-row">
                  <span className="mcard-disc-chip">Diskon {m.persentaseDiskon}%</span>
                  <span className="mcard-strike">{formatRupiah(m.harga)}</span>
                </div>
                <div className="mcard-price-lg">{formatRupiah(hargaSetelahDiskon(m))}</div>
              </div>
            ) : (
              formatRupiah(m.harga)
            )}
          </div>
          {/* Info tambahan: kalau statusDiskon masih true di database tapi
              periodenya sudah lewat, kasih tahu admin supaya tidak bingung
              kenapa harga tidak muncul diskon walau toggle "aktifkan diskon"
              sebelumnya pernah dinyalakan. */}
          {m.statusDiskon && !diskonAktif && m.tanggalSelesaiDiskon && (
            <div className="mcard-tag" style={{ color: "var(--tm)" }}>
              Periode diskon sudah berakhir
            </div>
          )}
          {/* Penanda kecil supaya admin bisa lihat sekilas dari kartu apakah
              menu ini punya pilihan Iced/Hot atau tidak, tanpa perlu buka
              modal Edit dulu. */}
          {m.jenis === "menu" && !m.butuhVarian && (
            <div className="mcard-tag" style={{ color: "var(--tm)" }}>
              🚫 Tanpa pilihan Iced/Hot
            </div>
          )}
          {m.deskripsi && <div className="mcard-tag">&quot;{m.deskripsi}&quot;</div>}
          {m.jenis === "menu" && (
            <div className="toggle-row">
              <div
                className={`tgl${m.statusAktif ? " on" : ""}${isToggling ? " disabled" : ""}`}
                onClick={() => toggleAktif(m.id)}
              />
              <span className="tgl-lbl">Aktif</span>
            </div>
          )}
          <div className="mcard-acts">
            {m.jenis === "menu" ? (
              <button className="btn btn-edit btn-flex1" onClick={() => openEditMenu(m)}>✏️ Edit</button>
            ) : (
              <button className="btn btn-edit btn-flex1" onClick={() => openEditBundling(m)}>✏️ Edit</button>
            )}
            <button className="btn btn-del" onClick={() => requestHapusMenu(m)}>🗑️</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg on">
      <div className="pghead">
        <div className="pghead-titlewrap">
          <div className="pgtitle">Kelola Menu</div>
          <div className="pgsub">Tambahkan, edit, atau nonaktifkan item menu yang tersedia</div>
        </div>
        <div className="btn-row-8">
          <button className="btn btn-edit" onClick={openAddBundling}>+ Tambah Bundling</button>
          <button className="btn btn-pri" onClick={openAddMenu}>+ Tambah Menu</button>
        </div>
      </div>

      <div className="mcat-chips">
        <div className={`mcat-chip${filt === "Semua" ? " active" : ""}`} onClick={() => setFilt("Semua")}>
          <span>Semua</span>
          <span className="cnt">{menu.length}</span>
        </div>
        {groupOrder.map((g) => {
          const c = counts[g] || 0;
          if (!c) return null;
          return (
            <div key={g} className={`mcat-chip${filt === g ? " active" : ""}`} onClick={() => setFilt(g)}>
              <span>{g}</span>
              <span className="cnt">{c}</span>
            </div>
          );
        })}
        {counts["Diskon"] > 0 && (
          <div
            className={`mcat-chip${filt === "Diskon" ? " active chip-diskon" : " chip-diskon"}`}
            onClick={() => setFilt("Diskon")}
          >
            <span>🔥 Diskon</span>
            <span className="cnt">{counts["Diskon"]}</span>
          </div>
        )}
      </div>

      <div className="mgrid-wrap">
      <div className="mgrid-search relative w-full max-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tm)] pointer-events-none z-10"
          />
          <input
            type="text"
            className="w-full py-2 px-3 pl-9 text-xs font-['DM_Sans',sans-serif] bg-[var(--cb)] text-[var(--br)] border border-[var(--bd)] rounded-full outline-none focus:border-[var(--bl)] transition-all"
            placeholder="Cari menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div className="mgrid">
          {filt === "Semua" ? (
            allGroups.length === 0 ? (
              <div className="mgrid-empty">{search ? "Menu tidak ditemukan. Coba kata kunci lain." : "Belum ada menu."}</div>
            ) : (
              allGroups.map((grp) => (
                <Fragment key={grp.name}>
                  <div className="mcat-section">
                    <span className="mcat-section-name">{grp.name}</span>
                    <span className="mcat-section-cnt">{grp.items.length} item</span>
                  </div>
                  {grp.items.map((m) => renderCard(m))}
                </Fragment>
              ))
            )
          ) : (
            <>
              <div className="mcat-section">
                <span className="mcat-section-name">{filt}</span>
                <span className="mcat-section-cnt">{(singleGroupItems?.length ?? 0)} item</span>
              </div>
              {singleGroupItems && singleGroupItems.length > 0 ? (
                singleGroupItems.map((m) => renderCard(m))
              ) : (
                <div className="mgrid-empty">{search ? "Menu tidak ditemukan. Coba kata kunci lain." : "Belum ada item pada kategori ini."}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL MENU */}
      <div className={`mo${menuModal.open ? " open" : ""}`}>
        <div className="mbox">
          <button className="mclose" onClick={() => !isSavingMenu && setMenuModal({ open: false, edit: null })} disabled={isSavingMenu}>✕</button>
          <div className="mttl">{menuModal.edit ? "Edit Menu" : "Tambah Menu"}</div>
          <div className="form-g">
            <label className="form-lbl">Nama Menu</label>
            <input className="form-inp" value={mNama} onChange={(e) => setMNama(e.target.value)} maxLength={NAMA_MAX_LEN} disabled={isSavingMenu} />
          </div>
          <div className="form-row">
            <div className="form-g">
              <label className="form-lbl">Kategori</label>

              {!kategoriHapusMode ? (
                <>
                  {/* Dropdown bawaan browser (native <select>), sama seperti
                      desain awal. Opsi paling bawah "🗑️ Hapus kategori..."
                      tidak mengubah kategori terpilih — dia cuma memicu mode
                      hapus (checkbox) di bawah ini. */}
                  <select
                    className="form-inp form-sel"
                    value={mKategori}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === KATEGORI_HAPUS_MODE_VALUE) {
                        setKategoriHapusMode(true);
                        setKategoriChecked(new Set());
                        return;
                      }
                      setMKategori(val);
                      if (val !== KATEGORI_BARU_VALUE) setMKategoriBaru("");
                    }}
                    disabled={isSavingMenu}
                  >
                    {kategoriListState.map((k) => <option key={k} value={k}>{k}</option>)}
                    <option value={KATEGORI_BARU_VALUE}>+ Tambah kategori baru...</option>
                    <option value={KATEGORI_HAPUS_MODE_VALUE}>🗑️ Hapus kategori...</option>
                  </select>

                  {mKategori === KATEGORI_BARU_VALUE && (
                    <input
                      className="form-inp"
                      style={{ marginTop: 8 }}
                      placeholder="Nama kategori baru"
                      value={mKategoriBaru}
                      onChange={(e) => setMKategoriBaru(e.target.value)}
                      maxLength={KATEGORI_MAX_LEN}
                      disabled={isSavingMenu}
                      autoFocus
                    />
                  )}
                </>
              ) : (
                // Mode hapus kategori: tampilkan tiap kategori sebagai
                // checkbox supaya admin bisa centang beberapa sekaligus,
                // lalu klik "Hapus Terpilih" untuk menghapus semuanya.
                <div
                  className="kategori-hapus-panel"
                  style={{
                    border: "1px solid var(--bd)",
                    borderRadius: 10,
                    padding: 10,
                    background: "var(--cb)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--tm)", marginBottom: 8 }}>
                    Centang kategori yang ingin dihapus:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
                    {kategoriListState.map((k) => (
                      <label
                        key={k}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fce7f3")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <input
                          type="checkbox"
                          checked={kategoriChecked.has(k)}
                          onChange={() => toggleKategoriChecked(k)}
                        />
                        <span>{k}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-del btn-flex1"
                      onClick={requestHapusKategoriBatch}
                    >
                      Hapus Terpilih
                    </button>
                    <button
                      type="button"
                      className="btn btn-edit btn-flex1"
                      onClick={() => {
                        setKategoriHapusMode(false);
                        setKategoriChecked(new Set());
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="form-g">
              <label className="form-lbl">Harga (Rp)</label>
              <input className="form-inp" type="number" min={1} value={mHarga} onChange={(e) => setMHarga(e.target.value)} disabled={isSavingMenu} />
            </div>
          </div>
          <div className="form-g">
            <label className="form-lbl">Deskripsi Singkat</label>
            <input className="form-inp" value={mDesk} onChange={(e) => setMDesk(e.target.value)} maxLength={DESKRIPSI_MAX_LEN} disabled={isSavingMenu} />
          </div>
            <div className="form-g">
              <label className="form-lbl">Foto Menu</label>
              <div className="img-upload-wrap" style={{ position: "relative" }}>
                <label className="img-upload-area" style={isUploadingFoto ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
                  {mFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="img-preview" src={mFoto} alt="Preview" />
                  ) : (
                    <div>{isUploadingFoto ? "⏳ Mengunggah..." : "📷 Unggah Foto Menu"}</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={isUploadingFoto || isSavingMenu}
                    onChange={(e) => e.target.files?.[0] && handleUploadFoto(e.target.files[0])}
                  />
                </label>
                {mFoto && !isUploadingFoto && (
                  <button
                    type="button"
                    className="btn btn-del"
                    style={{ position: "absolute", top: 6, right: 6 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMFoto(null);
                    }}
                    disabled={isSavingMenu}
                    title="Hapus foto"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          {/* Toggle "punya pilihan Iced/Hot" — berlaku per-menu, jadi item apa
              pun (mis. Air Mineral di kategori Non Coffee) bisa dimatikan
              varian-nya tanpa perlu pindah kategori. */}
          <div className="form-g discount-box">
            <div className="toggle-row toggle-row-flat">
              <div className={`tgl${mButuhVarian ? " on" : ""}`} onClick={() => !isSavingMenu && setMButuhVarian((v) => !v)} />
              <span className="tgl-lbl tgl-lbl-strong">Menu ini punya pilihan Iced/Hot</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 6 }}>
              Matikan untuk menu tanpa pilihan suhu, seperti makanan atau kopi dengan resep khusus.
            </div>
          </div>
          <div className="form-g discount-box">
            <div className="toggle-row toggle-row-flat">
              <div className={`tgl${mDiskon ? " on" : ""}`} onClick={() => !isSavingMenu && setMDiskon((v) => !v)} />
              <span className="tgl-lbl tgl-lbl-strong">Aktifkan Diskon Menu</span>
            </div>
            {mDiskon && (
              <div style={{ marginTop: 10 }}>
                <label className="form-lbl">Diskon (%)</label>
                <input className="form-inp" type="number" min={1} max={100} value={mPersen} onChange={(e) => setMPersen(e.target.value)} disabled={isSavingMenu} />
                {mHarga && Number(mPersen) > 0 && (
                  <div className="form-price-preview">
                    Harga setelah diskon:{" "}
                    <strong style={{ color: "var(--br)" }}>
                      {formatRupiah(Math.round(Number(mHarga) - (Number(mHarga) * Number(mPersen)) / 100))}
                    </strong>{" "}
                    <span className="form-price-strike">{formatRupiah(Number(mHarga))}</span>
                  </div>
                )}
                <div className="form-row" style={{ marginTop: 10 }}>
                  <div className="form-g form-g-tight">
                    <label className="form-lbl">Berlaku Dari</label>
                    <input className="form-inp" type="date" value={mMulai} onChange={(e) => setMMulai(e.target.value)} disabled={isSavingMenu} />
                  </div>
                  <div className="form-g form-g-tight">
                    <label className="form-lbl">Berlaku Sampai</label>
                    <input
                      className="form-inp"
                      type="date"
                      value={mSelesai}
                      min={todayStrWIB()}
                      onChange={(e) => setMSelesai(e.target.value)}
                      disabled={isSavingMenu}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {mError && <div className="login-err">{mError}</div>}
          <div className="mbtns">
            <button className="mbtn mbtn-pri" onClick={saveMenu} disabled={isSavingMenu || isUploadingFoto}>
              {isSavingMenu ? "Menyimpan..." : menuModal.edit ? "Simpan Perubahan" : "Tambahkan Menu"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setMenuModal({ open: false, edit: null })} disabled={isSavingMenu}>Batal</button>
          </div>
        </div>
      </div>

      {/* MODAL BUNDLING */}
      <div className={`mo${bundlingModal.open ? " open" : ""}`}>
        <div className="mbox">
          <button className="mclose" onClick={() => !isSavingBundling && setBundlingModal({ open: false, edit: null })} disabled={isSavingBundling}>✕</button>
          <div className="mttl">{bundlingModal.edit ? "Edit Bundling" : "Tambah Bundling Menu"}</div>
          <div className="form-g">
            <label className="form-lbl">Nama Bundling</label>
            <input className="form-inp" value={bNama} onChange={(e) => setBNama(e.target.value)} maxLength={NAMA_MAX_LEN} disabled={isSavingBundling} />
          </div>
          <div className="form-g">
            <label className="form-lbl">Harga Bundling (Rp)</label>
            <input className="form-inp" type="number" min={1} value={bHarga} onChange={(e) => setBHarga(e.target.value)} disabled={isSavingBundling} />
          </div>
          <div className="form-g">
            <label className="form-lbl">Deskripsi Singkat</label>
            <input className="form-inp" value={bDesk} onChange={(e) => setBDesk(e.target.value)} maxLength={DESKRIPSI_MAX_LEN} disabled={isSavingBundling} />
          </div>
          <div className="form-row">
            <div className="form-g">
              <label className="form-lbl">Berlaku Dari</label>
              <input className="form-inp" type="date" value={bMulai} onChange={(e) => setBMulai(e.target.value)} disabled={isSavingBundling} />
            </div>
            <div className="form-g">
              <label className="form-lbl">Berlaku Sampai</label>
              <input
                className="form-inp"
                type="date"
                value={bSelesai}
                min={todayStrWIB()}
                onChange={(e) => setBSelesai(e.target.value)}
                disabled={isSavingBundling}
              />
            </div>
          </div>
          <div className="form-g">
            <label className="form-lbl">Pilih Menu (minimal 2)</label>
            <div className="checkbox-list">
              {menu.filter((m) => m.jenis === "menu").map((m) => (
                <label key={m.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={bSelected.includes(m.id)}
                    onChange={() => toggleBundlingItem(m.id)}
                    disabled={isSavingBundling}
                  />
                  {m.nama} — {formatRupiah(m.harga)}
                </label>
              ))}
            </div>
          </div>
          {bError && <div className="login-err">{bError}</div>}
          <div className="mbtns">
            <button className="mbtn mbtn-pri" onClick={saveBundling} disabled={isSavingBundling}>
              {isSavingBundling ? "Menyimpan..." : bundlingModal.edit ? "Simpan Perubahan" : "Simpan Bundling"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setBundlingModal({ open: false, edit: null })} disabled={isSavingBundling}>Batal</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title="Hapus menu ini?"
        description={
          deleteTarget
            ? `"${deleteTarget.nama}" akan dihapus permanen dan tidak dapat dikembalikan. Item ini juga akan hilang dari bundling mana pun yang menggunakannya.`
            : ""
        }
        confirmLabel="Ya, Hapus"
        isLoading={isDeleting}
        onConfirm={confirmHapusMenu}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
      />

      {/* Konfirmasi hapus kategori (bisa beberapa sekaligus, belum dipakai menu manapun) */}
      <ConfirmDialog
        open={kategoriHapusBatch !== null}
        variant="danger"
        title={kategoriHapusBatch && kategoriHapusBatch.length > 1 ? "Hapus kategori-kategori ini?" : "Hapus kategori ini?"}
        description={
          kategoriHapusBatch
            ? `Kategori ${kategoriHapusBatch.map((k) => `"${k}"`).join(", ")} akan dihapus dari daftar kategori. Kategori ini belum dipakai menu manapun jadi aman dihapus.`
            : ""
        }
        confirmLabel="Ya, Hapus"
        onConfirm={confirmHapusKategoriBatch}
        onCancel={() => setKategoriHapusBatch(null)}
      />
    </div>
  );
}