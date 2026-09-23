"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatRupiah } from "@/lib/utils";
import { Search } from "lucide-react";

interface Trx {
  id: number;
  kodePesanan: string;
  namaPelanggan: string;
  teleponPelanggan: string;
  metodePembayaran: "cash" | "qris";
  totalHarga: number;
  createdAt: string;
  meja: { nomorMeja: string };
  kasir: { namaLengkap: string } | null;
  detailPesanan: { namaItem: string; jumlah: number }[];
}
interface TrxData { data: Trx[]; total: number; totalRevenue: number; avg: number }

const BULAN_LABEL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const POLL_INTERVAL_MS = 5000;
const SEARCH_DEBOUNCE_MS = 400;

// NOTE: createdAt dari server disimpan sebagai "jam WIB berlabel UTC"
// (lihat catatan di pesananService.ts / HistoryClient.tsx / OrdersClient.tsx).
// Karena itu WAJIB pakai getUTC*() langsung, JANGAN toLocaleTimeString/
// toLocaleDateString tanpa timeZone: "UTC" — kalau tidak, hasilnya ikut
// timezone browser admin dan bisa geser jam.
function formatTanggalJam(dateStr: string) {
  const d = new Date(dateStr);
  const tanggal = String(d.getUTCDate()).padStart(2, "0");
  const bulan = String(d.getUTCMonth() + 1).padStart(2, "0");
  const tahun = d.getUTCFullYear();
  const jam = String(d.getUTCHours()).padStart(2, "0");
  const menit = String(d.getUTCMinutes()).padStart(2, "0");
  return `${tanggal}/${bulan}/${tahun} ${jam}:${menit}`;
}

// Menghasilkan daftar nomor halaman dengan "..." untuk halaman yang banyak
// Contoh: current=1, total=5 -> [1,2,3,4,5]
// Contoh: current=7, total=20 -> [1, "...", 6,7,8, "...", 20]
function getPageNumbers(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: number[] = [];
  const withDots: (number | "...")[] = [];
  let last: number | undefined;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  range.forEach((i) => {
    if (last !== undefined) {
      if (i - last === 2) withDots.push(last + 1);
      else if (i - last !== 1) withDots.push("...");
    }
    withDots.push(i);
    last = i;
  });

  return withDots;
}

export default function TransaksiClient({ initialData, defaultBulan, defaultTahun }: { initialData: TrxData; defaultBulan: number; defaultTahun: number }) {
  const [data, setData] = useState(initialData);
  const [bulan, setBulan] = useState(defaultBulan);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);

  const { showToast } = useToast();
  const router = useRouter();
  const hasNotifiedError = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const params = new URLSearchParams({ bulan: String(bulan), tahun: String(defaultTahun), q: search, page: String(page) });
      const res = await fetch(`/api/admin/transaksi?${params.toString()}`, { cache: "no-store" });

      if (res.status === 401) {
        showToast({ type: "warning", title: "Sesi berakhir", detail: "Silakan masuk kembali untuk melanjutkan." });
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        if (!hasNotifiedError.current) {
          showToast({ type: "error", title: "Akses ditolak", detail: "Anda tidak memiliki izin untuk melihat data ini." });
          hasNotifiedError.current = true;
        }
        return;
      }
      if (!res.ok) {
        if (!hasNotifiedError.current) {
          showToast({ type: "error", title: "Gagal memuat data", detail: "Data yang ditampilkan mungkin belum yang terbaru." });
          hasNotifiedError.current = true;
        }
        return;
      }

      setData(await res.json());
      hasNotifiedError.current = false;
    } catch {
      if (!hasNotifiedError.current) {
        showToast({ type: "error", title: "Koneksi terputus", detail: "Mencoba menghubungkan kembali secara otomatis..." });
        hasNotifiedError.current = true;
      }
    } finally {
      setIsSyncing(false);
    }
  }, [bulan, defaultTahun, search, page, showToast, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => { fetchDataRef.current(); }, POLL_INTERVAL_MS);
    function onFocus() { fetchDataRef.current(); }
    function onVisibility() { if (document.visibilityState === "visible") fetchDataRef.current(); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function exportCsv() {
    window.open(`/api/admin/transaksi/export?bulan=${bulan}&tahun=${defaultTahun}`, "_blank");
  }

  const totalPages = Math.max(1, Math.ceil(data.total / 10));

  return (
    <div className="pg on">
      <div className="pghead" style={{ marginBottom: 6 }}>
        <div className="pghead-titlewrap">
          <div className="pgtitle">Data Transaksi</div>
          <div className="pgsub" style={{ marginBottom: 0 }}>Kelola dan pantau seluruh riwayat transaksi pelanggan.</div>
        </div>
        <div className="pghead-acts">
          <span className="sync-indicator">{isSyncing ? "Menyinkronkan data..." : ""}</span>
          <select className="form-inp form-sel" style={{ width: "auto" }} value={bulan} onChange={(e) => { setBulan(Number(e.target.value)); setPage(1); }}>
            {BULAN_LABEL.slice(1).map((b, i) => (
              <option key={i + 1} value={i + 1}>{b} {defaultTahun}</option>
            ))}
          </select>
          <button className="btn btn-exp" onClick={exportCsv}>⬇ Ekspor CSV</button>
        </div>
      </div>

      <div className="srow srow-3">
        <div className="sc">
          <div className="slbl">Total Pendapatan</div>
          <div className="sval">{formatRupiah(data.totalRevenue)}</div>
          <div className="sctxt">Periode {BULAN_LABEL[bulan]} {defaultTahun}</div>
        </div>
        <div className="sc">
          <div className="slbl">Total Transaksi</div>
          <div className="sval">{data.total}</div>
          <div className="sctxt">Periode {BULAN_LABEL[bulan]} {defaultTahun}</div>
        </div>
        <div className="sc">
          <div className="slbl">Rata-rata Nilai Transaksi</div>
          <div className="sval">{formatRupiah(data.avg)}</div>
          <div className="sctxt">Per transaksi</div>
        </div>
      </div>

      <div className="fbar flex items-center">
        <div className="relative flex-1 ml-auto max-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tm)] pointer-events-none z-10"
          />
          <input
            type="text"
            className="w-full py-2 px-3 pl-9 text-xs font-['DM_Sans',sans-serif] bg-[var(--cb)] text-[var(--br)] border border-[var(--bd)] rounded-full outline-none focus:border-[var(--bl)] transition-all"
            placeholder="Cari transaksi..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      <div className="twrap">
        <table className="atbl">
          <thead>
            <tr>
              <th>Kode Pesanan</th>
              <th>Tanggal</th>
              <th>Pelanggan</th>
              <th>Meja</th>
              <th>Jumlah Item</th>
              <th>Kasir</th>
              <th>Metode Pembayaran</th>
              <th>Total Harga</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr><td colSpan={8} className="atbl-empty">Belum ada transaksi untuk periode ini</td></tr>
            ) : (
              data.data.map((t) => (
                <tr key={t.id}>
                  <td><strong>#{t.kodePesanan}</strong></td>
                  <td>{formatTanggalJam(t.createdAt)}</td>
                  <td>
                    <div className="atbl-cust-name">{t.namaPelanggan}</div>
                    <div className="atbl-cust-phone">{t.teleponPelanggan}</div>
                  </td>
                  <td>{t.meja.nomorMeja}</td>
                  <td>{t.detailPesanan.reduce((s, d) => s + d.jumlah, 0)} item</td>
                  <td>{t.kasir?.namaLengkap || "-"}</td>
                  <td><span className={`badge ${t.metodePembayaran === "qris" ? "b-qris" : "b-cash"}`}>{t.metodePembayaran.toUpperCase()}</span></td>
                  <td><strong>{formatRupiah(t.totalHarga)}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.total > 0 && (
        <div className="pagination pagination-v2">
          <span className="pagination-info">
            Menampilkan {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} dari {data.total} transaksi
          </span>
            {totalPages > 1 && (
              <div className="pagination-btns">
                <button className="pg-btn pg-btn-nav" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Sebelumnya
                </button>
                <button className="pg-btn pg-num active">{page}</button>
                <button className="pg-btn pg-btn-nav" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  Selanjutnya
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}