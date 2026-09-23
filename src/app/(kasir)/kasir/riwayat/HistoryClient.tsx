// src/app/kasir/riwayat/HistoryClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Search } from "lucide-react";

const PER_PAGE = 10;
const POLL_INTERVAL_MS = 5000;

type FilterMode = "today" | "bulan" | "all";

interface RiwayatItem {
  id: number;
  kodePesanan: string;
  namaPelanggan: string;
  teleponPelanggan: string;
  metodePembayaran: "cash" | "qris";
  totalHarga: number;
  buktiPembayaran: string | null;
  createdAt: string;
  meja: { nomorMeja: string };
  kasir: { namaLengkap: string } | null;
  detailPesanan: { namaItem: string; jumlah: number; harga: number; catatanItem?: string | null }[];
}

function formatMeja(nomor: string) {
  return /meja/i.test(nomor) ? nomor : `Meja ${nomor}`;
}

// NOTE: createdAt dari server disimpan sebagai "jam WIB berlabel UTC"
// (lihat komentar di buatPesanan() / getAwalHariWIB() di pesananService.ts).
// Karena itu SEMUA fungsi format tanggal/jam di file ini WAJIB pakai
// getUTC*() langsung, TANPA timeZone/konversi tambahan apapun — kalau
// dikonversi lagi ke Asia/Jakarta, jamnya akan geser 7 jam (double shift).
function formatJamMenit(d: Date) {
  const jam = String(d.getUTCHours()).padStart(2, '0');
  const menit = String(d.getUTCMinutes()).padStart(2, '0');
  return `${jam}:${menit}`;
}

function formatWaktuStruk(dateStr: string) {
  const d = new Date(dateStr);
  const tanggal = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC", // WAJIB "UTC" di sini, karena field-nya sudah "WIB berlabel UTC"
  });
  const jam = formatJamMenit(d);
  return `${tanggal}, ${jam}`;
}

function formatJamSingkat(dateStr: string) {
  return formatJamMenit(new Date(dateStr));
}

function formatTanggalSingkat(dateStr: string) {
  const d = new Date(dateStr);
  const tanggal = String(d.getUTCDate()).padStart(2, "0");
  const bulan = String(d.getUTCMonth() + 1).padStart(2, "0");
  const tahun = d.getUTCFullYear();
  return `${tanggal}/${bulan}/${tahun}`;
}

function getBulanIniStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBukti(h: RiwayatItem) {
  if (!h.buktiPembayaran) return;
  const a = document.createElement("a");
  a.href = h.buktiPembayaran;
  a.download = `bukti-bayar-${h.kodePesanan}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── CETAK STRUK VIA WINDOW BARU ──
// Blok <style> di sini WAJIB tetap inline: window.open() membuka window
// kosong yang TIDAK ikut membaca order.css sama sekali.
function printStruk(receiptView: RiwayatItem, notifyError: (msg: string) => void) {
  const itemCount = receiptView.detailPesanan.reduce((s, d) => s + d.jumlah, 0);
  const subtotal = receiptView.detailPesanan.reduce((sum, d) => sum + d.harga * d.jumlah, 0);
  const pembulatan = receiptView.totalHarga - subtotal;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    notifyError("Pop-up diblokir oleh browser. Aktifkan izin pop-up untuk mencetak struk.");
    return;
  }

  const itemsHtml = receiptView.detailPesanan
    .map(
      (d) => `
      <div class="line">
        <div class="line-top">
          <span class="name">${escapeHtml(d.namaItem)}</span>
          <span class="sub">${formatRupiah(d.harga * d.jumlah)}</span>
        </div>
        <div class="meta">${formatRupiah(d.harga)} × ${d.jumlah}${d.catatanItem ? ` · ${escapeHtml(d.catatanItem)}` : ""}</div>
      </div>`
    )
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Struk #${escapeHtml(receiptView.kodePesanan)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
        .receipt { width: 72mm; margin: 0 auto; padding: 6mm 4mm; }
        .brand { text-align: center; font-size: 15pt; font-weight: 700; }
        .subtitle { text-align: center; font-size: 8pt; letter-spacing: 1.5px; color: #444; margin-top: 2px; }
        .kode { text-align: center; font-size: 8pt; color: #444; margin-top: 2px; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; font-size: 9pt; padding: 1.5px 0; }
        .row .lbl { color: #444; }
        .section-title { font-size: 8.5pt; color: #444; letter-spacing: 0.5px; margin-bottom: 6px; }
        .line { margin-bottom: 5px; }
        .line-top { display: flex; justify-content: space-between; font-size: 9pt; }
        .line .meta { font-size: 8pt; color: #555; }
        .summary-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 2px 0; }
        .summary-row.first { border-top: 1px solid #ccc; padding-top: 6px; margin-top: 4px; }
        .total { display: flex; justify-content: space-between; font-size: 12pt; font-weight: 700; padding: 8px 0 4px; border-top: 2px solid #111; margin-top: 6px; }
        .payment-method { display: flex; justify-content: space-between; font-size: 9pt; margin-top: 6px; }
        .footer { text-align: center; font-size: 8pt; color: #444; margin-top: 14px; padding-top: 8px; border-top: 1px dashed #999; }
        @page { size: 80mm auto; margin: 0; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="brand">Coffeebox_Jkt</div>
        <div class="subtitle">STRUK PEMBAYARAN</div>
        <div class="kode">#${escapeHtml(receiptView.kodePesanan)}</div>

        <hr />

        <div class="row"><span class="lbl">Meja</span><span>${escapeHtml(formatMeja(receiptView.meja.nomorMeja))}</span></div>
        <div class="row"><span class="lbl">Tanggal & Waktu</span><span>${formatWaktuStruk(receiptView.createdAt)}</span></div>
        <div class="row"><span class="lbl">Pelanggan</span><span>${escapeHtml(receiptView.namaPelanggan)}</span></div>
        <div class="row"><span class="lbl">Kasir</span><span>${escapeHtml(receiptView.kasir?.namaLengkap || "-")}</span></div>

        <hr />

        <div class="section-title">Rincian Pembayaran</div>
        ${itemsHtml}

        <div class="summary-row first"><span>Total Item</span><span>${itemCount} item</span></div>
        <div class="summary-row"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
        <div class="summary-row"><span>Pembulatan</span><span>${formatRupiah(pembulatan)}</span></div>

        <div class="total"><span>Total Pembayaran</span><span>${formatRupiah(receiptView.totalHarga)}</span></div>

        <div class="payment-method"><span>Metode Pembayaran</span><span>${receiptView.metodePembayaran.toUpperCase()}</span></div>

        <div class="footer">Terima kasih atas kunjungan Anda ☕</div>
      </div>
    </body>
    </html>
  `);
  win.document.close();

  win.onload = () => {
    win.focus();
    win.print();
  };
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="modal-header">
      <div>
        <div className="modal-header-title">{title}</div>
        {subtitle && <div className="modal-header-sub">{subtitle}</div>}
      </div>
      <button className="modal-close-btn" onClick={onClose} aria-label="Tutup">
        ✕
      </button>
    </div>
  );
}

export default function HistoryClient({ initialData }: { initialData: RiwayatItem[] }) {
  const [data, setData] = useState(initialData);
  const [filt, setFilt] = useState<FilterMode>("today");
  const [bulan, setBulan] = useState(getBulanIniStr());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [proofView, setProofView] = useState<RiwayatItem | null>(null);
  const [receiptView, setReceiptView] = useState<RiwayatItem | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  const isFetchingRef = useRef(false);
  const isSessionExpiredRef = useRef(false);

  async function fetchData(f: FilterMode, b: string, q: string, resetPage: boolean) {
    if (isFetchingRef.current || isSessionExpiredRef.current) return;
    isFetchingRef.current = true;
    try {
      const params = new URLSearchParams({ filter: f, q });
      if (f === "bulan") params.set("bulan", b);
      const res = await fetch(`/api/kasir/riwayat?${params.toString()}`, { cache: "no-store" });

      if (res.status === 401) {
        if (!isSessionExpiredRef.current) {
          isSessionExpiredRef.current = true;
          showToast({
            type: "warning",
            title: "Sesi Anda telah berakhir",
            detail: "Silakan login kembali untuk melanjutkan.",
          });
          router.push("/kasir/login");
        }
        return;
      }

      if (res.ok) {
        const json = await res.json();
        setData(json.riwayat);
        if (resetPage) setPage(1);
      } else {
        showToast({
          type: "error",
          title: "Gagal memuat riwayat",
          detail: "Data yang ditampilkan mungkin belum terbaru.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Koneksi terputus",
        detail: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      });
    } finally {
      isFetchingRef.current = false;
    }
  }

  useEffect(() => {
    fetchData(filt, bulan, search, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filt, bulan, search]);

  const filtRef = useRef(filt);
  const bulanRef = useRef(bulan);
  const searchRef = useRef(search);
  useEffect(() => {
    filtRef.current = filt;
    bulanRef.current = bulan;
    searchRef.current = search;
  }, [filt, bulan, search]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(filtRef.current, bulanRef.current, searchRef.current, false);
    }, POLL_INTERVAL_MS);

    function onFocus() {
      fetchData(filtRef.current, bulanRef.current, searchRef.current, false);
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        fetchData(filtRef.current, bulanRef.current, searchRef.current, false);
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));
  const pageList = useMemo(() => data.slice((page - 1) * PER_PAGE, page * PER_PAGE), [data, page]);
  const qrisCount = data.filter((d) => d.metodePembayaran === "qris").length;
  const cashCount = data.filter((d) => d.metodePembayaran === "cash").length;

  return (
    <section className="pg on">
      <div style={{ marginBottom: 18 }}>
        <div className="stlbl" style={{ padding: 0, margin: 0 }}>Riwayat Transaksi</div>
        <div className="db-sub">Semua transaksi yang telah selesai dan terkonfirmasi</div>
      </div>
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="sc2"><div className="slbl">Total Transaksi</div><div className="sval">{data.length}</div></div>
        <div className="sc2"><div className="slbl">QRIS</div><div className="sval">{qrisCount}</div></div>
        <div className="sc2"><div className="slbl">Cash</div><div className="sval">{cashCount}</div></div>
      </div>
          <div className="fbar" style={{ marginBottom: 14 }}>
            <button className={`fbtn${filt === "today" ? " on" : ""}`} onClick={() => setFilt("today")}>Hari Ini</button>
            <div className="fbar-group">
              <button className={`fbtn${filt === "bulan" ? " on" : ""}`} onClick={() => setFilt("bulan")}>Bulan Ini</button>
              {filt === "bulan" && (
                <input
                  type="month"
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="fsrch"
                />
              )}
            </div>
            <button className={`fbtn${filt === "all" ? " on" : ""}`} onClick={() => setFilt("all")}>Semua</button>
            <div className="relative flex-1 ml-auto max-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tm)] pointer-events-none z-10" />
              <input
                type="text"
                className="w-full py-2 px-3 pl-9 text-xs font-['DM_Sans',sans-serif] bg-[var(--cb)] text-[var(--br)] border border-[var(--bd)] rounded-full outline-none focus:border-[var(--bl)] transition-all"
                placeholder="Cari transaksi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

      <div style={{ background: "var(--cb)", border: "1px solid var(--bd)", borderRadius: 14, overflowX: "auto" }}>
        <table className="htbl">
          <thead>
            <tr>
              <th>No. Pesanan</th><th>Pelanggan</th><th>Meja</th><th>Item</th><th>Metode Bayar</th><th>Total</th><th>Tanggal</th><th>Jam</th><th>Kasir</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageList.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "var(--tm)", fontSize: 13 }}>Tidak ada transaksi</td></tr>
            ) : (
              pageList.map((h) => (
                <tr key={h.id}>
                  <td><strong>#{h.kodePesanan}</strong></td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{h.namaPelanggan}</div>
                    <div style={{ fontSize: 10, color: "var(--tm)" }}>{h.teleponPelanggan}</div>
                  </td>
                  <td>{formatMeja(h.meja.nomorMeja)}</td>
                  <td>{h.detailPesanan.map((i) => `${i.namaItem} x${i.jumlah}`).join(", ")}</td>
                  <td><span className={`ptag ${h.metodePembayaran === "qris" ? "p-qris" : "p-cash"}`}>{h.metodePembayaran.toUpperCase()}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}><strong>{formatRupiah(h.totalHarga)}</strong></td>
                  <td>{formatTanggalSingkat(h.createdAt)}</td>
                  <td>{formatJamSingkat(h.createdAt)}</td>
                  <td>{h.kasir?.namaLengkap || "-"}</td>
                  <td>
                    <div className="aksi-actions">
                      {h.metodePembayaran === "qris" ? (
                        <button className="btn btn-proof" style={{ padding: "4px 9px", fontSize: 10 }} onClick={() => setProofView(h)}>
                          <span className={h.buktiPembayaran ? "proof-dot" : "proof-dot none"} />Lihat Bukti
                        </button>
                      ) : (
                        <span
                          className="btn"
                          style={{
                            padding: "4px 9px",
                            fontSize: 10,
                            background: "var(--cream)",
                            color: "var(--tm)",
                            textAlign: "center",
                          }}
                        >
                          Cash
                        </span>
                      )}
                      <button
                        className="btn btn-receipt"
                        style={{ padding: "4px 9px", fontSize: 10 }}
                        onClick={() => setReceiptView(h)}
                        aria-label="Lihat struk"
                      >
                        🧾 Struk
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
              <div style={{ fontSize: 12, color: "var(--tm)" }}>
                {data.length === 0 ? "Tidak ada transaksi" : `Menampilkan ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, data.length)} dari ${data.length} transaksi`}
              </div>
                {totalPages > 1 && (
                  <div className="pagination">
                    <button className="btn btn-receipt" style={{ padding: "5px 10px", fontSize: 11 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                    <button className="btn btn-confirm" style={{ padding: "5px 10px", fontSize: 11, minWidth: 32 }}>{page}</button>
                    <button className="btn btn-receipt" style={{ padding: "5px 10px", fontSize: 11 }} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Selanjutnya</button>
                  </div>
                )}
      </div>

      {/* MODAL BUKTI (read-only) */}
      <div className={`mo${proofView ? " open" : ""}`}>
        <div className="mbox">
          <ModalHeader
            title="Bukti Pembayaran QRIS"
            subtitle={proofView ? `#${proofView.kodePesanan} · ${formatMeja(proofView.meja.nomorMeja)} · ${formatRupiah(proofView.totalHarga)}` : undefined}
            onClose={() => setProofView(null)}
          />
          {proofView?.buktiPembayaran ? (
            <div className="proof-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofView.buktiPembayaran} alt="Bukti bayar" />
              <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 6 }}>📱 Tangkapan layar dikirim oleh pelanggan</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24, background: "var(--cream)", borderRadius: 10, color: "var(--tm)", fontSize: 13 }}>
              Tidak ada bukti pembayaran
            </div>
          )}
          <div className="mbtns" style={{ flexWrap: "wrap" }}>
            {proofView?.buktiPembayaran && (
              <button className="mbtn mbtn-sec" onClick={() => downloadBukti(proofView)}>⬇️ Unduh Bukti</button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL STRUK */}
      <div className={`mo${receiptView ? " open" : ""}`}>
        <div className="mbox flex flex-col max-h-[85vh]" style={{ maxWidth: 380 }}>

          <div className="sticky top-0 bg-[var(--cb)] z-20 pb-2">
            <ModalHeader
              title="Struk Pembayaran"
              subtitle={receiptView ? `#${receiptView.kodePesanan}` : undefined}
              onClose={() => setReceiptView(null)}
            />
          </div>

          <div className="overflow-y-auto flex-1 pr-1">
            {receiptView && (() => {
              const itemCount = receiptView.detailPesanan.reduce((s, d) => s + d.jumlah, 0);
              const subtotal = receiptView.detailPesanan.reduce((sum, d) => sum + d.harga * d.jumlah, 0);
              const pembulatan = receiptView.totalHarga - subtotal;
              return (
                <div className="receipt-print-area receipt-card my-1">
                  <div className="receipt-brand">Coffeebox_Jkt</div>
                  <div className="receipt-subtitle">STRUK PEMBAYARAN</div>
                  <div className="receipt-kode">#{receiptView.kodePesanan}</div>

                  <hr className="receipt-hr" />

                  <div className="receipt-row"><span className="lbl">Meja</span><span>{formatMeja(receiptView.meja.nomorMeja)}</span></div>
                  <div className="receipt-row"><span className="lbl">Tanggal & Waktu</span><span>{formatWaktuStruk(receiptView.createdAt)}</span></div>
                  <div className="receipt-row"><span className="lbl">Pelanggan</span><span>{receiptView.namaPelanggan}</span></div>
                  <div className="receipt-row"><span className="lbl">Kasir</span><span>{receiptView.kasir?.namaLengkap || "-"}</span></div>

                  <hr className="receipt-hr" />

                  <h3 className="receipt-section-title">Rincian Pembayaran</h3>
                  <div id="detail-pm-lines">
                    {receiptView.detailPesanan.map((d, i) => (
                      <div className="pm-line" key={i}>
                        <div style={{ flex: 1 }}>
                          <div className="pm-line-name">{d.namaItem}</div>
                          <div className="pm-line-meta">
                            {formatRupiah(d.harga)} × {d.jumlah}
                            {d.catatanItem ? ` · ${d.catatanItem}` : ""}
                          </div>
                        </div>
                        <div className="pm-line-sub">{formatRupiah(d.harga * d.jumlah)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="pay-summary-row first">
                    <span>Total Item</span>
                    <span className="v">{itemCount} item</span>
                  </div>
                  <div className="pay-summary-row">
                    <span>Subtotal</span>
                    <span className="v">{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="pay-summary-row">
                    <span>Pembulatan</span>
                    <span className="v">{formatRupiah(pembulatan)}</span>
                  </div>
                  <div className="ototal">
                    <span className="ototal-l">Total Pembayaran</span>
                    <span className="ototal-v">{formatRupiah(receiptView.totalHarga)}</span>
                  </div>

                  <div className="receipt-row" style={{ marginTop: 8 }}>
                    <span className="lbl">Metode Pembayaran</span>
                    <span>{receiptView.metodePembayaran.toUpperCase()}</span>
                  </div>

                  <div className="receipt-footer">Terima kasih atas kunjungan Anda ☕</div>
                </div>
              );
            })()}
          </div>

          <div className="sticky bottom-0 bg-[var(--cb)] pt-2 mt-2 border-t border-[var(--bd)] z-20">
            <div className="mbtns" style={{ marginTop: 0 }}>
              <button
                className="mbtn mbtn-pri w-full"
                onClick={() =>
                  receiptView &&
                  printStruk(receiptView, (msg) =>
                    showToast({ type: "error", title: "Gagal mencetak", detail: msg })
                  )
                }
              >
                🖨️ Cetak Struk
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
