"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MenuTampil } from "@/types/menu";
import { CartItem, MetodePembayaran, StatusPesanan, VarianTampil } from "@/types/pesanan";
import { formatRupiah, roundedTotal, roundingAmount } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/components/ui/Toast";
import VariantModal from "./VariantModal";

type PageId =
  | "pg-menu"
  | "pg-detail"
  | "pg-paymethod"
  | "pg-qris"
  | "pg-upload"
  | "pg-cash"
  | "pg-status"
  | "pg-success"
  | "pg-rejected";

// BARU: tab kategori TIDAK lagi hardcoded statis — dihitung otomatis dari
// data menu yang sedang tampil (lihat `categoryTabs` di dalam komponen),
// supaya kategori baru yang ditambahkan admin langsung muncul jadi tab
// filter di halaman pelanggan tanpa perlu ubah kode ini lagi.
// Array ini hanya dipakai untuk menentukan URUTAN tab kategori "bawaan" agar
// tetap konsisten seperti sebelumnya; kategori baru di luar daftar ini akan
// otomatis ditambahkan setelahnya.
const KNOWN_CATEGORY_ORDER: { slug: string; label: string }[] = [
  { slug: "basic", label: "Basic Coffee" },
  { slug: "black", label: "Black Coffee" },
  { slug: "noncoff", label: "Non Coffee" },
  { slug: "hidden", label: "Hidden Coffee" },
  { slug: "club", label: "The 10k Club" },
  { slug: "makanan", label: "Makanan" },
];

const STATUS_STEPS: { key: StatusPesanan; t: string; s: string }[] = [
  { key: "menunggu_konfirmasi", t: "Menunggu Konfirmasi", s: "Kasir sedang memeriksa pesanan Anda" },
  { key: "diproses", t: "Diproses", s: "Pesanan Anda telah dikonfirmasi kasir" },
  { key: "sedang_disiapkan", t: "Sedang Disiapkan", s: "Barista sedang menyiapkan pesanan Anda ☕" },
  { key: "sedang_diantar", t: "Sedang Diantar ke Meja", s: "Pesanan Anda sedang diantar ke meja Anda oleh pelayan" },
  { key: "selesai", t: "Selesai", s: "Terima kasih, selamat menikmati! 🎉" },
];

interface OrderClientProps {
  nomorMeja: string;
  menus: MenuTampil[];
  qrisToko: string | null;
}
function sessionKey(nomorMeja: string) {
  return `cb_order_${nomorMeja}`;
}

function saveSession(nomorMeja: string, data: Record<string, unknown>) {
  try {
    const key = sessionKey(nomorMeja);
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
  } catch {
    // localStorage bisa gagal (mode private/incognito dsb), abaikan saja
  }
}

function readSession(nomorMeja: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(sessionKey(nomorMeja));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession(nomorMeja: string) {
  try {
    localStorage.removeItem(sessionKey(nomorMeja));
  } catch {
    // no-op
  }
}

// ── PENYIMPANAN HALAMAN AKTIF (agar tidak reset saat refresh) ──
function pageKey(nomorMeja: string) {
  return `cb_page_${nomorMeja}`;
}

function savePage(nomorMeja: string, page: PageId) {
  try {
    localStorage.setItem(pageKey(nomorMeja), page);
  } catch {
    // no-op
  }
}

function readPage(nomorMeja: string): PageId | null {
  try {
    return localStorage.getItem(pageKey(nomorMeja)) as PageId | null;
  } catch {
    return null;
  }
}

function clearPage(nomorMeja: string) {
  try {
    localStorage.removeItem(pageKey(nomorMeja));
  } catch {
    // no-op
  }
}

// ── PENYIMPANAN DRAFT INPUT (nama, telepon, catatan, metode) ──
// Supaya kalau user refresh sebelum sempat klik "Bayar Sekarang",
// isian yang sudah diketik tidak hilang.
function draftKey(nomorMeja: string) {
  return `cb_draft_${nomorMeja}`;
}

function saveDraft(nomorMeja: string, data: Record<string, unknown>) {
  try {
    const key = draftKey(nomorMeja);
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
  } catch {
    // no-op
  }
}

function readDraft(nomorMeja: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(draftKey(nomorMeja));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft(nomorMeja: string) {
  try {
    localStorage.removeItem(draftKey(nomorMeja));
  } catch {
    // no-op
  }
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleTouch = ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document;
  return /iPhone|iPad|iPod/.test(ua) || isAppleTouch;
}

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent || "");
}

function toChromeIntentUrl(url: string) {
  try {
    const u = new URL(url);
    const scheme = u.protocol.replace(":", ""); // "https"
    const rest = url.replace(/^https?:\/\//, "");
    return `intent://${rest}#Intent;scheme=${scheme};package=com.android.chrome;end`;
  } catch {
    return url;
  }
}

function toIOSChromeUrl(url: string) {
  // Skema resmi Chrome for iOS: googlechrome:// untuk http, googlechromes:// untuk https
  return url.replace(/^https:\/\//, "googlechromes://").replace(/^http:\/\//, "googlechrome://");
}

function AutoRedirectToBrowser() {
  useEffect(() => {
    const url = window.location.href;

    if (isAndroidDevice()) {
      // Langsung lempar ke Chrome, tanpa UI apapun.
      window.location.href = toChromeIntentUrl(url);
      return;
    }

    if (isIOSDevice()) {
      window.location.href = toIOSChromeUrl(url);
    }
  }, []);

  return null;
}

// BARU: sekarang dikontrol per-menu lewat kolom `butuhVarian` di database
// (diatur admin di halaman Kelola Menu), bukan lagi hardcode berdasarkan
// kategori "Makanan". Bundling tetap selalu dianggap tidak butuh varian,
// apa pun nilai butuhVarian-nya, karena bundling memang tidak punya konsep
// Iced/Hot tunggal (isinya bisa campuran).
function itemNeedsVarian(item: { jenis?: string; butuhVarian?: boolean }) {
  return item.jenis !== "bundling" && item.butuhVarian !== false;
}

export default function OrderClient({ nomorMeja, menus: initialMenus, qrisToko }: OrderClientProps) {
  const cartApi = useCart(`cb_cart_${nomorMeja}`);
  const { cart, qtyOfMenu, firstLineOfMenu, totalCount, totalPrice, addItem, updateLine, changeLineQty, menuMinus, resetCart } = cartApi;

  const { showToast } = useToast();

  // BARU: menu sekarang state lokal (bukan langsung pakai prop), supaya bisa
  // di-update tanpa reload halaman lewat polling di bawah.
  const [menus, setMenus] = useState<MenuTampil[]>(initialMenus);

  const [page, setPage] = useState<PageId>("pg-menu");
  const [curFilt, setCurFilt] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [modalMenuId, setModalMenuId] = useState<number | null>(null);
  const [modalLineId, setModalLineId] = useState<number | null>(null);
  const [modalVarian, setModalVarian] = useState<VarianTampil>("Iced");
  const [modalNote, setModalNote] = useState("");
  const [modalShowVarian, setModalShowVarian] = useState(true); // ⬅️ BARU

  const [globalNote, setGlobalNote] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [metode, setMetode] = useState<MetodePembayaran>("qris");

  const [kodePesanan, setKodePesanan] = useState("");

  // Cegah pesanan terkirim dua kali kalau tombol "Bayar Sekarang" ditekan berkali-kali
  // dengan cepat (misal koneksi lambat, user tidak sadar sudah tap).
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [statusData, setStatusData] = useState<{
    status: StatusPesanan;
    alasanPembatalan: string | null;
  } | null>(null);

  const [restoring, setRestoring] = useState(true);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── BARU: REAL-TIME MENU (POLLING) ──
     Setiap 5 detik, ambil ulang data menu dari server. Kalau admin/kasir
     nonaktifkan menu, ubah diskon, edit harga/nama, dsb — perubahan itu
     otomatis muncul di sini tanpa pelanggan perlu refresh halaman. */
  useEffect(() => {
    let cancelled = false;

    async function pollMenu() {
      try {
        const res = await fetch("/api/menu", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.menus)) {
          setMenus(data.menus);
        }
      } catch {
        // Gagal fetch sementara (mis. koneksi putus) — abaikan saja,
        // akan dicoba lagi otomatis di interval berikutnya.
      }
    }

    menuPollingRef.current = setInterval(pollMenu, 5000);
    return () => {
      cancelled = true;
      if (menuPollingRef.current) clearInterval(menuPollingRef.current);
    };
  }, []);

  /* ── FILTER + SEARCH ── */
  const filteredMenus = useMemo(() => {
    let list =
      curFilt === "diskon"
        ? menus.filter((m) => m.sedangDiskon)
        : curFilt === "all"
        ? menus
        : menus.filter((m) => m.catSlug === curFilt);

    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (m) =>
          m.nama.toLowerCase().includes(q) ||
          m.deskripsi.toLowerCase().includes(q) ||
          m.kategori.toLowerCase().includes(q)
      );
    }
    return list;
  }, [menus, curFilt, searchQ]);

  /* ── BARU: TAB KATEGORI DINAMIS ──
     Dihitung ulang setiap kali `menus` berubah (termasuk saat polling 5 detik
     menemukan menu baru). Kategori "bawaan" tetap ditampilkan dengan urutan
     seperti sebelumnya (KNOWN_CATEGORY_ORDER), kategori baru yang belum
     dikenal otomatis ditambahkan setelahnya sebagai tab tersendiri. */
  const categoryTabs = useMemo(() => {
    const labelBySlug = new Map<string, string>();
    for (const m of menus) {
      if (m.jenis === "bundling") continue; // bundling ditangani terpisah di bawah
      if (!labelBySlug.has(m.catSlug)) labelBySlug.set(m.catSlug, m.kategori);
    }

    const known = KNOWN_CATEGORY_ORDER.filter((c) => labelBySlug.has(c.slug));
    const extra = Array.from(labelBySlug.entries())
      .filter(([slug]) => !KNOWN_CATEGORY_ORDER.some((c) => c.slug === slug))
      .map(([slug, label]) => ({ slug, label }));

    const hasBundling = menus.some((m) => m.jenis === "bundling");
    const hasDiskon = menus.some((m) => m.sedangDiskon);

    return [
      { slug: "all", label: "Semua" },
      ...known,
      ...extra,
      ...(hasBundling ? [{ slug: "bundling", label: "Bundling" }] : []),
      ...(hasDiskon ? [{ slug: "diskon", label: "Diskon" }] : []),
    ];
  }, [menus]);

  /* ── BARU: KELOMPOKKAN MENU PER KATEGORI (tampilan section, mirip admin) ──
     - Saat filter "Semua" aktif: pecah jadi banyak section sesuai urutan tab
       kategori (categoryTabs), skip tab "all" dan "diskon" karena keduanya
       bukan partisi kategori sungguhan (diskon lintas-kategori).
     - Saat filter kategori/bundling tertentu aktif: tetap tampilkan 1 section
       dengan judul kategori tsb, supaya header + jumlah item tetap konsisten.
     - Saat filter "diskon" aktif: 1 section berjudul "Diskon".
     Pencarian (searchQ) otomatis ikut terkelompok karena handleSearch()
     selalu mereset curFilt ke "all". */
  const displayGroups = useMemo(() => {
    if (curFilt === "all") {
      const groups: { slug: string; label: string; items: MenuTampil[] }[] = [];
      for (const tab of categoryTabs) {
        if (tab.slug === "all" || tab.slug === "diskon") continue;
        const items =
          tab.slug === "bundling"
            ? filteredMenus.filter((m) => m.jenis === "bundling")
            : filteredMenus.filter((m) => m.jenis !== "bundling" && m.catSlug === tab.slug);
        if (items.length > 0) groups.push({ slug: tab.slug, label: tab.label, items });
      }
      return groups;
    }
    const tab = categoryTabs.find((c) => c.slug === curFilt);
    return [{ slug: curFilt, label: tab?.label || "", items: filteredMenus }];
  }, [filteredMenus, categoryTabs, curFilt]);

  function goto(p: PageId) {
    setPage(p);
    savePage(nomorMeja, p);
    window.scrollTo(0, 0);
  }

  /* ── MODAL VARIAN ── */
  function openVariantAdd(menu: MenuTampil) {
    setModalMode("add");
    setModalMenuId(menu.id);
    setModalLineId(null);
    setModalVarian("Iced");
    setModalNote("");
    setModalShowVarian(itemNeedsVarian(menu)); // ⬅️ BARU
    setModalOpen(true);
  }

  function openVariantEdit(line: CartItem) {
    setModalMode("edit");
    setModalLineId(line.lineId);
    setModalMenuId(null);
    setModalVarian(line.varian);
    setModalNote(line.catatanItem);
    setModalShowVarian(itemNeedsVarian(line)); // ⬅️ BARU
    setModalOpen(true);
  }

  function handleSaveVariant(varian: VarianTampil, note: string) {
    if (modalMode === "add" && modalMenuId !== null) {
      const menu = menus.find((m) => m.id === modalMenuId);
      if (menu) addItem(menu, varian, note);
    } else if (modalMode === "edit" && modalLineId !== null) {
      updateLine(modalLineId, varian, note);
    }
    setModalOpen(false);
  }

  /* ── SEARCH & FILTER HANDLERS ── */
  function handleFilt(slug: string) {
    setCurFilt(slug);
    setSearchQ("");
    setSearchOpen(false);
  }
  function handleSearch(v: string) {
    setSearchQ(v);
    if (v) setCurFilt("all");
  }

  /* ── DETAIL PESANAN ── */
  function goDetail() {
    goto("pg-detail");
  }

  function goPayMethod() {
    if (!cart.length) {
      showToast({
        type: "warning",
        title: "Keranjang kosong",
        detail: "Tambahkan menu ke keranjang terlebih dahulu untuk melanjutkan.",
      });
      return;
    }
    goto("pg-paymethod");
  }

  /* ── SUBMIT PESANAN ── */
  async function payNow() {
    if (isSubmittingOrder) return; // cegah double-submit kalau tombol ditekan berkali-kali

    if (!custName.trim()) {
      showToast({
        type: "warning",
        title: "Nama belum diisi",
        detail: "Silakan isi nama lengkap Anda terlebih dahulu.",
      });
      return;
    }
    const phoneDigits = custPhone.trim();
    const phoneRegex = /^08[0-9]{8,11}$/;
    if (!phoneRegex.test(phoneDigits)) {
      showToast({
        type: "warning",
        title: "Nomor telepon tidak valid",
        detail: "Gunakan format nomor telepon yang benar, contoh: 081234567890.",
      });
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch("/api/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorMeja,
          namaPelanggan: custName.trim(),
          teleponPelanggan: custPhone.trim(),
          metodePembayaran: metode,
          catatan: globalNote.trim(),
          items: cart.map((l) => ({
            idMenu: l.idMenu,
            nama: l.nama,
            harga: l.harga,
            jumlah: l.jumlah,
            varian: l.varian,
            catatanItem: l.catatanItem,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast({
          type: "error",
          title: "Gagal membuat pesanan",
          detail: err?.message || "Silakan periksa kembali data pesanan Anda dan coba lagi.",
        });
        return;
      }

      const data = await res.json();
      setKodePesanan(data.kodePesanan);
      saveSession(nomorMeja, {
        kodePesanan: data.kodePesanan,
        custName: custName.trim(),
        custPhone: custPhone.trim(),
        metode,
      });
      clearDraft(nomorMeja);

      if (metode === "qris") {
        goto("pg-qris");
      } else {
        goto("pg-cash");
        startPolling(data.kodePesanan);
      }
    } catch {
      showToast({
        type: "error",
        title: "Koneksi bermasalah",
        detail: "Terjadi kesalahan jaringan. Silakan coba lagi.",
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  /* ── UPLOAD BUKTI PEMBAYARAN ── */
  function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submitProof() {
    if (!uploadFile) {
      showToast({
        type: "warning",
        title: "Belum ada file",
        detail: "Silakan pilih tangkapan layar bukti pembayaran terlebih dahulu.",
      });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await fetch(`/api/pesanan/${kodePesanan}`, {
        method: "PATCH",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast({
          type: "error",
          title: "Gagal mengunggah",
          detail: err?.message || "Gagal mengunggah bukti pembayaran. Silakan coba lagi.",
        });
        return;
      }
      goto("pg-status");
      startPolling(kodePesanan);
    } catch {
      showToast({
        type: "error",
        title: "Koneksi bermasalah",
        detail: "Periksa koneksi internet Anda, lalu coba lagi.",
      });
    } finally {
      setUploading(false);
    }
  }

  /* ── STATUS PESANAN (polling ke database) ── */
  function startPolling(kode: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const check = async () => {
      const res = await fetch(`/api/pesanan/${kode}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStatusData({ status: data.status, alasanPembatalan: data.alasanPembatalan });

      if (data.status === "selesai") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        goto("pg-success");
        // Pesanan sudah tuntas, session & halaman tersimpan tidak perlu disimpan lagi.
        clearSession(nomorMeja);
        clearPage(nomorMeja);
        clearDraft(nomorMeja);
        resetCart();
      } else if (data.status === "dibatalkan") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        goto("pg-rejected");
        clearSession(nomorMeja);
        clearPage(nomorMeja);
        clearDraft(nomorMeja);
        resetCart();
      } else if (["diproses", "sedang_disiapkan", "sedang_diantar"].includes(data.status)) {
        goto("pg-status");
      }
    };
    check();
    pollingRef.current = setInterval(check, 5000);
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      // Pulihkan draft input dulu (nama, telepon, catatan, metode) — akan
      // ditimpa lagi di bawah kalau ternyata ada pesanan aktif dari session.
      const draft = readDraft(nomorMeja);
      if (draft) {
        if (typeof draft.custName === "string") setCustName(draft.custName);
        if (typeof draft.custPhone === "string") setCustPhone(draft.custPhone);
        if (typeof draft.globalNote === "string") setGlobalNote(draft.globalNote);
        if (draft.metode === "qris" || draft.metode === "cash") setMetode(draft.metode as MetodePembayaran);
      }

      const sess = readSession(nomorMeja);
      if (!sess || !sess.kodePesanan) {
        setRestoring(false);
        return;
      }

      try {
        const res = await fetch(`/api/pesanan/${sess.kodePesanan}`, { cache: "no-store" });
        if (!res.ok) {
          // kodePesanan sudah tidak valid / expired di server, bersihkan session
          clearSession(nomorMeja);
          setRestoring(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setKodePesanan(sess.kodePesanan as string);
        if (typeof sess.custName === "string") setCustName(sess.custName);
        if (typeof sess.custPhone === "string") setCustPhone(sess.custPhone);
        if (sess.metode === "qris" || sess.metode === "cash") setMetode(sess.metode as MetodePembayaran);

        if (data.status === "selesai") {
          goto("pg-success");
          clearSession(nomorMeja);
          clearPage(nomorMeja);
          clearDraft(nomorMeja);
          resetCart();
        } else if (data.status === "dibatalkan") {
          setStatusData({ status: data.status, alasanPembatalan: data.alasanPembatalan });
          goto("pg-rejected");
          clearSession(nomorMeja);
          clearPage(nomorMeja);
          clearDraft(nomorMeja);
          resetCart();
        } else if (data.status === "menunggu_bukti" || (sess.metode === "qris" && !data.buktiPembayaran)) {

          goto("pg-upload");
        } else {
          setStatusData({ status: data.status, alasanPembatalan: data.alasanPembatalan });
          goto("pg-status");
          startPolling(sess.kodePesanan as string);
        }
      } catch {
        clearSession(nomorMeja);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomorMeja]);

  /* ── PULIHKAN HALAMAN pg-detail / pg-paymethod SETELAH REFRESH ──
     Ini hanya jalan kalau TIDAK ada pesanan aktif (kodePesanan kosong),
     karena kalau ada pesanan aktif, effect restore() di atas yang menentukan
     halaman (prioritas lebih tinggi). Cart harus masih ada isinya supaya
     tidak nyasar ke halaman detail yang kosong. */
  useEffect(() => {
    if (restoring) return;
    if (kodePesanan) return;
    if (page !== "pg-menu") return; // sudah dipulihkan / user sudah pindah manual, jangan ditimpa lagi

    const savedPage = readPage(nomorMeja);
    if ((savedPage === "pg-detail" || savedPage === "pg-paymethod") && cart.length > 0) {
      setPage(savedPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring, cart, kodePesanan, nomorMeja, page]);

  /* ── AUTO-SAVE DRAFT INPUT ──
     Setiap kali nama/telepon/catatan/metode berubah, simpan sebagai draft.
     Tidak disimpan lagi kalau sudah checkout (kodePesanan ada), karena
     setelah itu data resmi disimpan lewat saveSession() di payNow(). */
  useEffect(() => {
    if (restoring) return;
    if (kodePesanan) return;
    saveDraft(nomorMeja, { custName, custPhone, globalNote, metode });
  }, [custName, custPhone, globalNote, metode, kodePesanan, nomorMeja, restoring]);

  const currentStatusIndex = statusData
    ? STATUS_STEPS.findIndex((s) => s.key === statusData.status)
    : 0;

  const cartCount = totalCount;
  const cartTotal = totalPrice;

  /* ── BARU: KARTU MENU (diekstrak jadi fungsi supaya bisa dipakai ulang
     per grup kategori di displayGroups, tanpa duplikasi kode). ── */
  function renderMenuCard(m: MenuTampil) {
    const q = qtyOfMenu(m.id);
    return (
      <div
        key={m.id}
        className={`mcard${q > 0 ? " sel" : ""}`}
        id={`mc-${m.id}`}
        onClick={() => openVariantAdd(m)}
      >
        {m.jenis === "bundling" ? (
          <div className="badge-club" style={{ background: "#1A1A2E", color: "#E8C878" }}>
            🎁 Bundling
          </div>
        ) : m.badge === "hidden" ? (
          <div className="badge-hid">🔒 Hidden</div>
        ) : m.badge === "club" ? (
          <div className="badge-club">10k Club</div>
        ) : null}

        <div className="mcard-img-wrap">
          {m.jenis === "bundling" ? (
            <div className="mcard-img-ph">🎁</div>
          ) : m.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mcard-img" src={m.foto} alt={m.nama} />
          ) : (
            <div className="mcard-img-ph">{m.kategori === "Makanan" ? "🍽️" : "☕"}</div>
          )}
        </div>
        <div className="mcard-body">
          <div className="mcard-cat">{m.kategori}</div>
          <div className="mcard-name">{m.nama}</div>
          <div className="mcard-desc">
            {m.jenis === "bundling" ? `Isi: ${m.bundleItems.join(", ")}` : m.deskripsi}
          </div>
          <div className="mcard-foot">
            {m.sedangDiskon ? (
              <div>
                <div className="mcard-disc-row">
                  <span className="mcard-disc-chip">Diskon {m.persentaseDiskon}%</span>
                  <span className="mcard-strike">{formatRupiah(m.hargaAsli)}</span>
                </div>
                <div className="mcard-price-lg">{formatRupiah(m.harga)}</div>
              </div>
            ) : (
              <div className="mcard-price">{formatRupiah(m.harga)}</div>
            )}
            <div className="qctrl" onClick={(e) => e.stopPropagation()}>
              {q > 0 && (
                <button className="qbtn" onClick={() => menuMinus(m.id)}>
                  −
                </button>
              )}
              {q > 0 && (
                <span
                  className="qnum"
                  onClick={() => {
                    const first = firstLineOfMenu(m.id);
                    if (first) openVariantEdit(first);
                  }}
                  title="Ubah varian / catatan"
                >
                  {q}
                </span>
              )}
              <button className="qbtn add" onClick={() => openVariantAdd(m)}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (restoring) {
    return (
      <>
        <AutoRedirectToBrowser />
        <div className="order-shell">
          <div
            style={{
              minHeight: "100dvh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 10,
              color: "var(--tm)",
            }}
          >
            <div className="waiting-spinner" />
            <div style={{ fontSize: 12 }}>Memuat pesanan Anda...</div>
          </div>
        </div>
      </>
    );
  }

return (
  <>
    <AutoRedirectToBrowser />
    <div className="order-shell">
      {/* BEGIN: MainHeader */}
      <div className="hdr" id="main-hdr">
        <div className="hdr-logo">Coffeebox_Jkt</div>
        <div className="hdr-sub">Specialty Coffee · Jakarta</div>
        <div className="tbl-badge" id="tbl-badge">
          Meja No. {nomorMeja}
        </div>
      </div>

      {/* BEGIN: PageMenu */}
      <div className={`pg${page === "pg-menu" ? " on" : ""}`} id="pg-menu">
        <div className="hero">
          <h1>
            Pilih Kopi Anda,
            <br />
            Nikmati Momennya
          </h1>
          <p>Setiap cangkir punya cerita — temukan yang cocok untuk hari Anda</p>
          <div className="steps">
            <div className="stp on">
              <div className="stp-d">1</div>
              <span>Menu</span>
            </div>
            <div className="stp-line" />
            <div className="stp">
              <div className="stp-d">2</div>
              <span>Pesan</span>
            </div>
            <div className="stp-line" />
            <div className="stp">
              <div className="stp-d">3</div>
              <span>Bayar</span>
            </div>
          </div>
        </div>
        <div className="sec-lbl">Kategori</div>
        <div className="filter-bar" id="filter-bar" style={{ display: page === "pg-menu" ? "flex" : "none" }}>
          <div className="tabs-scroll">
            {categoryTabs.map((c) => (
              <div
                key={c.slug}
                className={`tab${curFilt === c.slug ? " on" : ""}`}
                onClick={() => handleFilt(c.slug)}
              >
                {c.label}
              </div>
            ))}
          </div>
          <div className="filter-actions">
            <div
              className={`search-wrap${searchOpen ? " open" : ""}`}
              onClick={() => {
                setSearchOpen(true);
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                id="search-inp"
                value={searchQ}
                onBlur={() => !searchQ && setSearchOpen(false)}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Cari..."
                type="text"
              />
            </div>
            <button className="cart-icon-btn" onClick={goDetail} title="Lihat Keranjang">
              <span className="material-symbols-outlined" style={{ color: "var(--tm)", fontSize: 20 }}>
                shopping_cart
              </span>
              <div className={`cart-badge${cartCount > 0 ? " vis" : ""}`} id="cart-badge">
                {cartCount}
              </div>
            </button>
          </div>
        </div>
        <div className="mgrid" id="mgrid" style={{ paddingTop: 16 }}>
          {filteredMenus.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 20px", color: "var(--tm)" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "var(--br)" }}>
                Tidak ditemukan
              </div>
              <div style={{ fontSize: 12, marginTop: 5 }}>Coba kata kunci lain.</div>
            </div>
          ) : (
            displayGroups.map((grp) => (
              <Fragment key={grp.slug}>
                <div className="mcat-section">
                  <span className="mcat-section-name">{grp.label}</span>
                  <span className="mcat-section-cnt">{grp.items.length} item</span>
                </div>
                {grp.items.map((m) => renderMenuCard(m))}
              </Fragment>
            ))
          )}
        </div>
        <div className="pb-safe" />
      </div>
      {/* END: PageMenu */}

      {/* Floating Cart Button */}
      <button
        className={`float-cart${cartCount > 0 && page === "pg-menu" ? " vis" : ""}`}
        id="float-cart"
        onClick={goDetail}
      >
        <div className="float-cart-left">
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="float-cart-count" id="fc-count">
            {cartCount}
          </span>
          <span className="float-cart-txt">Item</span>
        </div>
        <span className="float-cart-price" id="fc-price">
          {formatRupiah(cartTotal)}
        </span>
      </button>

      {/* BEGIN: PageDetail */}
      <div className={`pg${page === "pg-detail" ? " on" : ""}`} id="pg-detail">
        <div className="back-btn" onClick={() => goto("pg-menu")}>
          <span className="arr">←</span> Kembali
        </div>
        <div className="owrap">
          <div className="ocard">
            <h3>Detail Pesanan</h3>
            <div id="ditems">
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--tm)", fontSize: 13 }}>
                  Keranjang masih kosong.
                </div>
              ) : (
                cart.map((l) => {
                  const showTemp = itemNeedsVarian(l); // ⬅️ BARU: sembunyikan badge Iced/Hot utk item tanpa varian
                  const tempCls = l.varian === "Iced" ? "ice" : "hot";
                  const tempIc = l.varian === "Iced" ? "🧊" : "🔥";
                  return (
                    <div className="ditem" key={l.lineId}>
                      <div className="ditem-ic">{l.jenis === "bundling" ? "🎁" : l.kategori === "Makanan" ? "🍽️" : "☕"}</div>
                      <div className="ditem-mid">
                        <div className="ditem-nm">{l.nama}</div>
                        {l.jenis === "bundling" && (
                          <div style={{ fontSize: 9, color: "var(--tm)", marginTop: 2 }}>
                            {l.bundleItems.join(", ")}
                          </div>
                        )}
                        {showTemp && (
                          <span className={`ditem-temp ${tempCls}`}>
                            {tempIc} {l.varian}
                          </span>
                        )}
                        {l.catatanItem && <div className="ditem-note">📝 &quot;{l.catatanItem}&quot;</div>}
                        <div className="ditem-edit" onClick={() => openVariantEdit(l)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                            edit
                          </span>{" "}
                          Ubah
                        </div>
                      </div>
                      <div className="ditem-right">
                        <div className="ditem-price">{formatRupiah(l.harga * l.jumlah)}</div>
                        <div className="qctrl">
                          <button className="qbtn" onClick={() => changeLineQty(l.lineId, -1)}>
                            −
                          </button>
                          <span className="qnum">{l.jumlah}</span>
                          <button className="qbtn add" onClick={() => changeLineQty(l.lineId, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="ocard">
            <h3>Catatan Tambahan</h3>
            <label className="inp-lbl">Berlaku untuk keseluruhan pesanan (opsional)</label>
            <textarea
              className="inp-f"
              id="notes-global"
              placeholder="Contoh: tolong antar semua bersamaan"
              rows={3}
              value={globalNote}
              onChange={(e) => setGlobalNote(e.target.value)}
            />
          </div>
          <div className="ocard">
            <h3>Rincian Pembayaran</h3>
            <div id="detail-pm-lines">
              {cart.map((l) => (
                <div className="pm-line" key={l.lineId}>
                  <div style={{ flex: 1 }}>
                    <div className="pm-line-name">{l.nama}</div>
                    <div className="pm-line-meta">
                      {l.varian} · {formatRupiah(l.harga)} × {l.jumlah}
                    </div>
                  </div>
                  <div className="pm-line-sub">{formatRupiah(l.harga * l.jumlah)}</div>
                </div>
              ))}
            </div>
            <div className="pay-summary-row" style={{ marginTop: 6, borderTop: "1px solid var(--bd)", paddingTop: 10 }}>
              <span>Total Item</span>
              <span className="v">{cartCount} item</span>
            </div>
            <div className="pay-summary-row">
              <span>Subtotal</span>
              <span className="v">{formatRupiah(cartTotal)}</span>
            </div>
            <div className="pay-summary-row">
              <span>Pembulatan</span>
              <span className="v">{formatRupiah(roundingAmount(cartTotal))}</span>
            </div>
            <div className="ototal">
              <span className="ototal-l">Total Pembayaran</span>
              <span className="ototal-v">{formatRupiah(roundedTotal(cartTotal))}</span>
            </div>
          </div>
          <button className="act-btn btn-pri" onClick={goPayMethod}>
            Lanjut Pembayaran
          </button>
          <button className="act-btn btn-sec" onClick={() => goto("pg-menu")}>
            Tambah Menu Lain
          </button>
        </div>
      </div>
      {/* END: PageDetail */}

      {/* BEGIN: PagePayMethod */}
      <div className={`pg${page === "pg-paymethod" ? " on" : ""}`} id="pg-paymethod">
        <div className="back-btn" onClick={() => goto("pg-detail")}>
          <span className="arr">←</span> Kembali
        </div>
        <div className="owrap">
          <div className="ocard">
            <h3>Metode Pembayaran</h3>
            <div className="pay-opts">
              <div className={`pay-opt${metode === "qris" ? " sel" : ""}`} onClick={() => setMetode("qris")}>
                <div className="pay-ic">▦</div>
                <div className="pay-inf">
                  <div className="pay-nm">QRIS</div>
                  <div className="pay-nt">Scan &amp; bayar sekarang</div>
                </div>
                <div className="pay-radio">
                  <div className="pay-rdot" />
                </div>
              </div>
              <div className={`pay-opt${metode === "cash" ? " sel" : ""}`} onClick={() => setMetode("cash")}>
                <div className="pay-ic">💵</div>
                <div className="pay-inf">
                  <div className="pay-nm">Cash</div>
                  <div className="pay-nt">Bayar langsung ke kasir</div>
                </div>
                <div className="pay-radio">
                  <div className="pay-rdot" />
                </div>
              </div>
            </div>
          </div>
          <div className="ocard">
            <h3>Data Diri</h3>
            <div className="field-group">
              <label className="inp-lbl">
                Nama Lengkap <span className="required-mark">*</span>
              </label>
              <input
                className="inp-f"
                maxLength={50}
                placeholder="Masukkan nama lengkap"
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="inp-lbl">
                Nomor Telepon <span className="required-mark">*</span>
              </label>
                <input
                  className="inp-f"
                  maxLength={13}
                  placeholder="Contoh: 081234567890"
                  type="tel"
                  inputMode="numeric"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                />
              </div>
            <div>
              <label className="inp-lbl">Nomor Meja</label>
              <div className="ro-field">
                <span>Meja No. {nomorMeja}</span>
                <span className="lock material-symbols-outlined">lock</span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 7, lineHeight: 1.6 }}>
              📋 Nomor meja berasal dari sistem dan tidak dapat diubah.
            </div>
          </div>
          <div className="ocard">
            <h3>Rincian Pembayaran</h3>
            <div id="pm-lines">
              {cart.map((l) => (
                <div className="pm-line" key={l.lineId}>
                  <div style={{ flex: 1 }}>
                    <div className="pm-line-name">{l.nama}</div>
                    <div className="pm-line-meta">
                      {l.varian} · {formatRupiah(l.harga)} × {l.jumlah}
                    </div>
                  </div>
                  <div className="pm-line-sub">{formatRupiah(l.harga * l.jumlah)}</div>
                </div>
              ))}
            </div>
            <div className="pay-summary-row" style={{ marginTop: 6, borderTop: "1px solid var(--bd)", paddingTop: 10 }}>
              <span>Total Item</span>
              <span className="v">{cartCount} item</span>
            </div>
            <div className="pay-summary-row">
              <span>Subtotal</span>
              <span className="v">{formatRupiah(cartTotal)}</span>
            </div>
            <div className="pay-summary-row">
              <span>Pembulatan</span>
              <span className="v">{formatRupiah(roundingAmount(cartTotal))}</span>
            </div>
            <div className="ototal">
              <span className="ototal-l">Total Pembayaran</span>
              <span className="ototal-v">{formatRupiah(roundedTotal(cartTotal))}</span>
            </div>
          </div>
          <button className="act-btn btn-pri" onClick={payNow} disabled={isSubmittingOrder}>
            {isSubmittingOrder ? "Memproses..." : "Bayar Sekarang"}
          </button>
        </div>
      </div>
      {/* END: PagePayMethod */}

      {/* BEGIN: PageQrisPayment */}
      <div className={`pg${page === "pg-qris" ? " on" : ""}`} id="pg-qris">
        <div className="qris-wrap">
          <div className="qris-header">
            <div className="qris-header-ic">📲</div>
            <div className="qris-header-ttl">Selesaikan Pembayaran</div>
            <div className="qris-header-sub">
              Scan QR di bawah menggunakan
              <br />
              m-banking atau e-wallet Anda
            </div>
          </div>
          <div className="cust-info-bar">
            <div className="cust-info-ic">👤</div>
            <div>
              <div className="cust-info-name">{custName || "—"}</div>
              <div className="cust-info-phone">{custPhone || "—"}</div>
            </div>
          </div>
          <div className="qris-card">
            <div className="qris-ord-num">#{kodePesanan}</div>
            <div className="qris-img-wrap">
              {qrisToko ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrisToko} alt="QRIS Merchant" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ textAlign: "center", padding: "10px 6px" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
                  <div style={{ fontSize: 11, color: "#C62828", fontWeight: 500, lineHeight: 1.5 }}>
                    QRIS belum tersedia
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, lineHeight: 1.5 }}>
                    Silakan hubungi kasir untuk pembayaran
                  </div>
                </div>
              )}
            </div>
            <div className="qris-amt-lbl">Total Pembayaran</div>
            <div className="qris-amt-val">{formatRupiah(roundedTotal(cartTotal))}</div>
          </div>
          <div className="info-note-yellow">
            📸 <strong>Penting:</strong> Setelah pembayaran berhasil, ambil tangkapan layar bukti pembayaran Anda (bukti transfer atau struk e-wallet). Anda akan diminta mengunggah bukti tersebut pada langkah berikutnya.
          </div>
            <button className="act-btn btn-pri" disabled={!qrisToko} onClick={() => goto("pg-upload")}>
              Saya Sudah Bayar
            </button>
            {!qrisToko && (
              <div style={{ fontSize: 11, color: "#C62828", textAlign: "center" }}>
                Pembayaran QRIS belum diatur oleh admin. Silakan pilih metode Cash atau hubungi kasir.
              </div>
            )}
        </div>
      </div>
      {/* END: PageQrisPayment */}

      {/* BEGIN: PageUploadProof */}
      <div className={`pg${page === "pg-upload" ? " on" : ""}`} id="pg-upload">
        <div className="upload-pg-banner" style={{ position: "relative" }}>
          <div
            className="back-btn"
            onClick={() => goto("pg-qris")}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              margin: 0,
              background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.3)",
              color: "#fff",
            }}
          >
            <span className="arr" style={{ color: "#fff" }}>←</span> Kembali
          </div>
          <div style={{ fontSize: 40, marginBottom: 6 }}>📤</div>
          <div className="upload-pg-ttl">Unggah Bukti Pembayaran</div>
          <div style={{ fontSize: 12, color: "#C8E6C9", marginTop: 8, lineHeight: 1.6 }}>
            Unggah tangkapan layar bukti transfer atau e-wallet Anda
            <br />
            agar pesanan dapat segera diproses
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="cust-info-bar">
            <div className="cust-info-ic">👤</div>
            <div>
              <div className="cust-info-name">{custName}</div>
              <div className="cust-info-phone">{custPhone}</div>
            </div>
          </div>
          <div className="ocard" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--tm)", marginBottom: 10 }}>Nomor Pesanan</div>
            <div className="qris-ord-num" style={{ marginBottom: 0 }}>
              #{kodePesanan}
            </div>
          </div>
          <div className="ocard">
            <h3>Bukti Pembayaran</h3>
            <div
              className={`upload-big-area${uploadPreview ? " has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {!uploadPreview ? (
                <div>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🖼️</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--br)" }}>
                    Ketuk untuk memilih tangkapan layar bukti pembayaran
                  </div>
                  <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 4 }}>Format JPG/PNG, maks 5MB</div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Pratinjau bukti pembayaran"
                  src={uploadPreview}
                  style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, margin: "0 auto", display: "block" }}
                />
              )}
              <input
                ref={fileInputRef}
                accept="image/*"
                style={{ display: "none" }}
                type="file"
                onChange={handleProofChange}
              />
            </div>
          </div>
          <button
            className="btn-send-proof"
            disabled={!uploadFile || uploading}
            style={{ opacity: !uploadFile || uploading ? 0.5 : 1 }}
            onClick={submitProof}
          >
            {uploading ? "Mengirim..." : "Kirim Bukti Pembayaran"}
          </button>
          <div style={{ fontSize: 10, color: "var(--tm)", textAlign: "center", lineHeight: 1.6 }}>
            📋 Pastikan bukti pembayaran terlihat jelas sebelum dikirim.
          </div>
        </div>
      </div>
      {/* END: PageUploadProof */}

      {/* BEGIN: PageCashInfo */}
      <div className={`pg${page === "pg-cash" ? " on" : ""}`} id="pg-cash">
        <div className="done-banner">
          <div className="done-checkmark">💵</div>
          <div className="done-ttl">Pesanan Masuk!</div>
          <div style={{ fontSize: 13, color: "var(--gl)", marginTop: 8, opacity: 0.85, lineHeight: 1.6 }}>
            Silakan menuju kasir untuk
            <br />
            melakukan pembayaran
          </div>
          <div className="done-ord-badge">#{kodePesanan}</div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="cust-info-bar">
            <div className="cust-info-ic">👤</div>
            <div>
              <div className="cust-info-name">{custName}</div>
              <div className="cust-info-phone">{custPhone}</div>
            </div>
          </div>
          <div className="ocard">
            <div className="ocard-icon-title">📋 Langkah Selanjutnya</div>
            <div className="done-step">
              <div className="done-step-num">1</div>
              <div>
                <div className="done-step-t">Menuju kasir</div>
                <div className="done-step-s">Sebutkan nomor pesanan di atas kepada kasir</div>
              </div>
            </div>
            <div className="done-step">
              <div className="done-step-num">2</div>
              <div>
                <div className="done-step-t">Lakukan pembayaran Cash</div>
                <div className="done-step-s">Bayar sesuai total yang tertera</div>
              </div>
            </div>
            <div className="done-step">
              <div className="done-step-num">3</div>
              <div>
                <div className="done-step-t">Kasir mengonfirmasi</div>
                <div className="done-step-s">Setelah dikonfirmasi, Anda akan diarahkan ke halaman status pesanan</div>
              </div>
            </div>
          </div>
          <div className="ocard" style={{ textAlign: "center" }}>
            <div className="waiting-spinner" />
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--br)" }}>
              Menunggu konfirmasi kasir<span className="pulse-dot" style={{ marginLeft: 4 }} />
            </div>
          </div>
        </div>
      </div>
      {/* END: PageCashInfo */}

      {/* BEGIN: PageOrderStatus */}
      <div className={`pg${page === "pg-status" ? " on" : ""}`} id="pg-status">
        <div className="status-banner">
          <div style={{ fontSize: 40, marginBottom: 6 }}>☕</div>
          <div className="status-ttl">Status Pesanan</div>
          <div className="status-info-vert">
            <div className="status-badge-now">
              {STATUS_STEPS[Math.max(currentStatusIndex, 0)]?.t || "Menunggu Konfirmasi"}
            </div>
            <div className="done-ord-badge" style={{ fontSize: 18, marginTop: 0 }}>
              #{kodePesanan}
            </div>
          </div>
        </div>
        <div className="owrap">
          <div className="cust-info-bar">
            <div className="cust-info-ic">👤</div>
            <div>
              <div className="cust-info-name">{custName}</div>
              <div className="cust-info-phone">{custPhone}</div>
            </div>
          </div>
          <div className="ocard">
            <h3>Tahapan Pesanan</h3>
            <div className="st-track" id="st-track">
              {STATUS_STEPS.map((st, i) => {
                const isDone = i < currentStatusIndex;
                const isActive = i === currentStatusIndex;
                const dotCls = isDone ? "done" : isActive ? "active" : "";
                const nodeCls = !isDone && !isActive ? "pending" : "";
                return (
                  <div className={`st-node ${nodeCls}`} key={st.key}>
                    <div className="st-dot-wrap">
                      <div className={`st-dot ${dotCls}`}>{isDone ? "✓" : i + 1}</div>
                      {i < STATUS_STEPS.length - 1 && <div className={`st-line${i < currentStatusIndex ? " done" : ""}`} />}
                    </div>
                    <div className="st-body">
                      <div className="st-body-t">{st.t}</div>
                      <div className="st-body-s">{st.s}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ocard ocard-yellow">
            <div className="note-text-yellow">
              💡 <strong>Informasi:</strong>
              <br />
              Estimasi pesanan siap dalam <strong>10 – 15 menit</strong>. Jika lebih dari 20 menit belum datang, tunjukkan nomor pesanan <strong>#{kodePesanan}</strong> ke kasir.
            </div>
          </div>
        </div>
      </div>
      {/* END: PageOrderStatus */}

{/* BEGIN: PageSuccess */}
      <div className={`pg${page === "pg-success" ? " on" : ""}`} id="pg-success">
        <div className="done-banner success">
          <div className="done-checkmark success">
            ✅
          </div>
          <div className="done-ttl">Pesanan Selesai!</div>
          <div style={{ fontSize: 13, color: "#E8F5E9", marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>
            Terima kasih sudah memesan di
            <br />
            Coffeebox_Jkt, selamat menikmati! 🎉
          </div>
          <div className="done-ord-badge on-dark">
            #{kodePesanan}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="cust-info-bar">
            <div className="cust-info-ic">👤</div>
            <div>
              <div className="cust-info-name">{custName}</div>
              <div className="cust-info-phone">{custPhone}</div>
            </div>
          </div>
          <div style={{ background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 14, padding: 18, marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>☕✨</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#2E7D32", marginBottom: 6 }}>
              Selamat Menikmati!
            </div>
            <div style={{ fontSize: 13, color: "#388E3C", lineHeight: 1.7 }}>
              Setiap tegukan adalah cerita — semoga secangkir kopi kami menemani hari Anda dengan hangat.
            </div>
          </div>
          <div className="dashed-footer-card">
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "var(--br)", marginBottom: 4 }}>
              Coffeebox_Jkt
            </div>
            <div style={{ fontSize: 11, color: "var(--tm)" }}>Specialty Coffee · Jakarta</div>
          </div>
        </div>
      </div>
      {/* END: PageSuccess */}

      {/* BEGIN: PageRejected */}
      <div className={`pg${page === "pg-rejected" ? " on" : ""}`} id="pg-rejected">
        <div className="done-banner rejected">
          <div className="done-checkmark rejected">
            ❌
          </div>
          <div className="done-ttl">Pesanan Dibatalkan</div>
          <div style={{ fontSize: 13, color: "#FFCDD2", marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>
            Mohon maaf, pesanan Anda telah
            <br />
            dibatalkan oleh kasir
          </div>
          <div className="done-ord-badge on-dark">
            #{kodePesanan}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ background: "#FFEBEE", border: "1px solid #EF9A9A", borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#B71C1C", marginBottom: 7 }}>
              📋 Alasan Pembatalan
            </div>
            <div style={{ fontSize: 13, color: "#C62828", lineHeight: 1.7 }}>
              {statusData?.alasanPembatalan || "Pesanan dibatalkan oleh kasir."}
            </div>
          </div>
          <div className="ocard">
            <div className="ocard-icon-title">📋 Yang Perlu Anda Lakukan</div>
            <div className="done-step">
              <div className="done-step-num">1</div>
              <div>
                <div className="done-step-t">Tunggu di meja</div>
                <div className="done-step-s">Petugas kami akan mendatangi meja Anda</div>
              </div>
            </div>
            <div className="done-step">
              <div className="done-step-num">2</div>
              <div>
                <div className="done-step-t">Pengembalian dana</div>
                <div className="done-step-s">Dana akan dikembalikan jika sudah membayar</div>
              </div>
            </div>
            <div className="done-step">
              <div className="done-step-num">3</div>
              <div>
                <div className="done-step-t">Pesan ulang</div>
                <div className="done-step-s">Anda dapat memesan kembali menu lainnya</div>
              </div>
            </div>
          </div>
          <div className="dashed-footer-card">
            <div style={{ fontSize: 22, marginBottom: 6 }}>☕</div>
            <div style={{ fontSize: 12, color: "var(--tm)", lineHeight: 1.7 }}>
              💡 Jangan khawatir, petugas kami akan segera mendatangi meja Anda untuk membantu pemesanan selanjutnya.
            </div>
          </div>
        </div>
      </div>
      {/* END: PageRejected */}

      <VariantModal
        show={modalOpen}
        title={
          modalMode === "add"
            ? menus.find((m) => m.id === modalMenuId)?.nama || ""
            : cart.find((l) => l.lineId === modalLineId)?.nama || ""
        }
        subtitle={
          modalShowVarian
            ? modalMode === "add"
              ? "Pilih varian dan tambahkan catatan"
              : "Ubah varian atau catatan"
            : "Tambahkan catatan (opsional)"
        }
        initialVarian={modalVarian}
        initialNote={modalNote}
        showVarian={modalShowVarian}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveVariant}
      />
    </div>
  </>
);
}