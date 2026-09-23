"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Search } from "lucide-react";

type FilterStatus = "menunggu_konfirmasi" | "diproses" | "sedang_disiapkan" | "sedang_diantar" | "selesai" | "dibatalkan";

const STATUS_LABEL: Record<string, string> = {
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  diproses: "Diproses",
  sedang_disiapkan: "Sedang Disiapkan",
  sedang_diantar: "Sedang Diantar",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};
const STATUS_CLASS: Record<string, string> = {
  menunggu_konfirmasi: "s-new",
  diproses: "s-done",
  sedang_disiapkan: "s-proc",
  sedang_diantar: "s-deliver",
  selesai: "s-paid",
  dibatalkan: "s-cancel",
};

const MAX_ALASAN_LENGTH = 500;

const TZ = "Asia/Jakarta";

interface DetailItem {
  namaItem: string;
  jumlah: number;
  harga: number;
  catatanItem: string | null;
}
interface PesananItem {
  id: number;
  kodePesanan: string;
  metodePembayaran: "cash" | "qris";
  status: FilterStatus;
  namaPelanggan: string;
  teleponPelanggan: string;
  catatan: string | null;
  totalHarga: number;
  buktiPembayaran: string | null;
  alasanPembatalan: string | null;
  createdAt: string;
  meja: { nomorMeja: string };
  idKasir: number | null;
  kasir: { namaLengkap: string } | null;
  detailPesanan: DetailItem[];
}

function formatMeja(nomor: string) {
  return /meja/i.test(nomor) ? nomor : `Meja ${nomor}`;
}

// Label tampilan metode pembayaran — menyamakan istilah "Cash" menjadi
// "Cash" agar konsisten dengan seluruh aplikasi, tanpa mengubah nilai
// data metodePembayaran ("cash" / "qris") itu sendiri.
function formatMetodeLabel(m: string) {
  return m === "qris" ? "QRIS" : "Cash";
}

function formatJamMenit(d: Date) {
  // Gunakan getUTCHours dan getUTCMinutes karena nilai Date di Prisma 
  // sudah kita pangkas/paksa sebagai nilai lokal WIB.
  const jam = String(d.getUTCHours()).padStart(2, '0');
  const menit = String(d.getUTCMinutes()).padStart(2, '0');
  return `${jam}:${menit}`;
}

function formatWaktuStruk(dateStr: string) {
  const d = new Date(dateStr);
  
  // Ambil komponen tanggal secara UTC agar tidak tergeser oleh zona waktu browser client
  const tahun = d.getUTCFullYear();
  const bulan = d.getUTCMonth();
  const tanggalNum = d.getUTCDate();

  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const tanggalStr = `${tanggalNum} ${namaBulan[bulan]} ${tahun}`;
  const jamStr = formatJamMenit(d);

  return `${tanggalStr}, ${jamStr}`;
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

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function isDalam24Jam(createdAt: string) {
  const batas = Date.now() + WIB_OFFSET_MS - 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() >= batas;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBukti(o: PesananItem) {
  if (!o.buktiPembayaran) return;
  const a = document.createElement("a");
  a.href = o.buktiPembayaran;
  a.download = `bukti-bayar-${o.kodePesanan}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── CETAK STRUK VIA WINDOW BARU ──
function printStruk(receiptView: PesananItem, notifyError: (msg: string) => void) {
  const itemCount = receiptView.detailPesanan.reduce((s, d) => s + d.jumlah, 0);
  const subtotal = receiptView.detailPesanan.reduce((sum, d) => sum + d.harga * d.jumlah, 0);
  const pembulatan = receiptView.totalHarga - subtotal;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    notifyError("Jendela pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak struk.");
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
        <div class="row"><span class="lbl">Tanggal</span><span>${formatWaktuStruk(receiptView.createdAt)}</span></div>
        <div class="row"><span class="lbl">Pelanggan</span><span>${escapeHtml(receiptView.namaPelanggan)}</span></div>
        <div class="row"><span class="lbl">Kasir</span><span>${escapeHtml(receiptView.kasir?.namaLengkap || "-")}</span></div>

        <hr />

        <div class="section-title">Rincian Pembayaran</div>
        ${itemsHtml}

        <div class="summary-row first"><span>Total Item</span><span>${itemCount} item</span></div>
        <div class="summary-row"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
        <div class="summary-row"><span>Pembulatan</span><span>${formatRupiah(pembulatan)}</span></div>

        <div class="total"><span>Total Pembayaran</span><span>${formatRupiah(receiptView.totalHarga)}</span></div>

        <div class="payment-method"><span>Metode Pembayaran</span><span>${formatMetodeLabel(receiptView.metodePembayaran)}</span></div>

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

export default function OrdersClient({
  initialPesanan,
  currentKasirId,
}: {
  initialPesanan: PesananItem[];
  currentKasirId: number;
}) {
  const [pesanan, setPesanan] = useState(initialPesanan);
  const [filt, setFilt] = useState<FilterStatus>("menunggu_konfirmasi");
  const [search, setSearch] = useState("");
  const { showToast } = useToast();
  const router = useRouter();

  const [tolakId, setTolakId] = useState<number | null>(null);
  const [tolakAlasan, setTolakAlasan] = useState("");
  const [tolakError, setTolakError] = useState("");
  const [payId, setPayId] = useState<number | null>(null);
  const [proofViewId, setProofViewId] = useState<number | null>(null);
  const [receiptView, setReceiptView] = useState<PesananItem | null>(null);

  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const isProcessing = (id: number) => processingIds.has(id);
  const startProcessing = (id: number) =>
    setProcessingIds((prev) => new Set(prev).add(id));
  const stopProcessing = (id: number) =>
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const isSessionExpiredRef = useRef(false);

  const pesananAktif = useMemo(
    () => pesanan.filter((o) => isDalam24Jam(o.createdAt)),
    [pesanan]
  );

  async function refresh() {
    if (isSessionExpiredRef.current) return;
    try {
      const res = await fetch("/api/kasir/pesanan", { cache: "no-store" });

      if (res.status === 401) {
        if (!isSessionExpiredRef.current) {
          isSessionExpiredRef.current = true;
          showToast({
            type: "warning",
            title: "Sesi berakhir",
            detail: "Silakan login kembali untuk melanjutkan.",
          });
          router.push("/kasir/login");
        }
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setPesanan(data.pesanan);
      }
    } catch {
      // gagal jaringan saat polling — diamkan, dicoba lagi di interval berikutnya.
    }
  }

  useEffect(() => {
    const interval = proofViewId !== null ? 3000 : 15000;
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
  }, [proofViewId]);

  useEffect(() => {
    const anyModalOpen =
      payId !== null || tolakId !== null || proofViewId !== null || receiptView !== null;
    document.body.classList.toggle("modal-open", anyModalOpen);
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [payId, tolakId, proofViewId, receiptView]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pesananAktif.filter((o) => {
      const matchFilt = o.status === filt;
      const matchSearch =
        o.kodePesanan.toLowerCase().includes(q) ||
        o.meja.nomorMeja.toLowerCase().includes(q) ||
        o.namaPelanggan.toLowerCase().includes(q) ||
        o.teleponPelanggan.toLowerCase().includes(q) ||
        o.detailPesanan.some((d) => d.namaItem.toLowerCase().includes(q));
      return matchFilt && matchSearch;
    });
  }, [pesananAktif, filt, search]);

  const stats = {
    new: pesananAktif.filter((o) => o.status === "menunggu_konfirmasi").length,
    confirm: pesananAktif.filter((o) => o.status === "diproses").length,
    proc: pesananAktif.filter((o) => o.status === "sedang_disiapkan").length,
    deliver: pesananAktif.filter((o) => o.status === "sedang_diantar").length,
    paid: pesananAktif.filter((o) => o.status === "selesai").length,
  };

  async function doAction(id: number, action: string, alasan?: string) {
    if (isProcessing(id)) return false;

    startProcessing(id);
    try {
      const res = await fetch(`/api/kasir/pesanan/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, alasan }),
      });

      if (res.status === 401) {
        if (!isSessionExpiredRef.current) {
          isSessionExpiredRef.current = true;
          showToast({
            type: "warning",
            title: "Sesi berakhir",
            detail: "Silakan login kembali untuk melanjutkan.",
          });
          router.push("/kasir/login");
        }
        return false;
      }

      let data: { message?: string } = {};
      try {
        data = await res.json();
      } catch {
        // respons bukan JSON valid
      }

      if (!res.ok) {
        showToast({
          type: "error",
          title: "Gagal memproses pesanan",
          detail: data.message || "Terjadi kesalahan. Silakan coba lagi.",
        });
        return false;
      }

      await refresh();
      return true;
    } catch {
      showToast({
        type: "error",
        title: "Koneksi terputus",
        detail: "Tidak dapat menghubungi server. Periksa koneksi internet Anda.",
      });
      return false;
    } finally {
      stopProcessing(id);
    }
  }

  async function konfirmasiBayar(id: number) {
    if (await doAction(id, "konfirmasi_bayar")) {
      setPayId(null);
      setFilt("diproses");
      showToast({ type: "success", title: "Pembayaran dikonfirmasi", detail: "Pesanan masuk ke antrean diproses." });
    }
  }
  async function kirimDapur(id: number, kode: string) {
    if (await doAction(id, "kirim_dapur")) {
      setFilt("sedang_disiapkan");
      showToast({ type: "success", title: "Dikirim ke dapur", detail: `Pesanan #${kode} sedang disiapkan.` });
    }
  }
  async function antarMeja(id: number, kode: string) {
    if (await doAction(id, "antar_meja")) {
      setFilt("sedang_diantar");
      showToast({ type: "success", title: "Sedang diantar", detail: `Pesanan #${kode} menuju meja pelanggan.` });
    }
  }
  async function selesai(id: number, kode: string) {
    if (await doAction(id, "selesai")) {
      setFilt("selesai");
      showToast({ type: "success", title: "Pesanan selesai", detail: `Pesanan #${kode} telah tuntas.` });
    }
  }

  async function submitTolak() {
    const trimmed = tolakAlasan.trim();
    if (!trimmed) {
      setTolakError("Alasan pembatalan wajib diisi.");
      return;
    }
    if (trimmed.length > MAX_ALASAN_LENGTH) {
      setTolakError(`Alasan pembatalan maksimal ${MAX_ALASAN_LENGTH} karakter.`);
      return;
    }
    setTolakError("");

    if (tolakId !== null && (await doAction(tolakId, "batalkan", trimmed))) {
      showToast({ type: "success", title: "Pesanan dibatalkan", detail: "Alasan telah dikirimkan ke pelanggan." });
      setTolakId(null);
      setTolakAlasan("");
    }
  }

  function closeTolakModal() {
    setTolakId(null);
    setTolakAlasan("");
    setTolakError("");
  }

  const payTarget = pesananAktif.find((o) => o.id === payId);
  const tolakTarget = pesananAktif.find((o) => o.id === tolakId);
  const proofView = pesananAktif.find((o) => o.id === proofViewId) ?? null;

  return (
    <section className="pg on">
      <div style={{ marginBottom: 18 }}>
        <div className="stlbl" style={{ padding: 0, margin: 0 }}>Pesanan Masuk</div>
        <div className="db-sub">Kelola dan pantau semua pesanan yang masuk dari pelanggan</div>
      </div>
          <div className="stats-row">
            <div className="sc2">
              <div className="slbl">Menunggu Konfirmasi</div>
              <div className="sval">{stats.new}</div>
              <div className="ssub">
                <span className="sdot" style={{ background: "#81C784" }} />
                Butuh konfirmasi
              </div>
            </div>
            <div className="sc2">
              <div className="slbl">Diproses</div>
              <div className="sval">{stats.confirm}</div>
              <div className="ssub">
                <span className="sdot" style={{ background: "#64B5F6" }} />
                Dikonfirmasi kasir
              </div>
            </div>
            <div className="sc2">
              <div className="slbl">Sedang Disiapkan</div>
              <div className="sval">{stats.proc}</div>
              <div className="ssub">
                <span className="sdot" style={{ background: "#FFB74D" }} />
                Di dapur sekarang
              </div>
            </div>
            <div className="sc2">
              <div className="slbl">Sedang Diantar</div>
              <div className="sval">{stats.deliver}</div>
              <div className="ssub">
                <span className="sdot" style={{ background: "#BA68C8" }} />
                Menuju meja
              </div>
            </div>
          </div>
      <div className="fbar">
        {(Object.keys(STATUS_LABEL) as FilterStatus[]).map((s) => (
          <button key={s} className={`fbtn${filt === s ? " on" : ""}`} onClick={() => setFilt(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
        <div className="relative flex-1 ml-auto max-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tm)] pointer-events-none z-10"
          />
          <input
            type="text"
            className="w-full py-2 px-3 pl-9 text-xs font-['DM_Sans',sans-serif] bg-[var(--cb)] text-[var(--br)] border border-[var(--bd)] rounded-full outline-none focus:border-[var(--bl)] transition-all"
            placeholder="Cari pesanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="ogrid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 50, color: "var(--tm)", fontSize: 13 }}>Tidak ada pesanan</div>
        ) : (
          filtered.map((o) => {
            const isPemilik = o.idKasir === currentKasirId;
            const busy = isProcessing(o.id);

            return (
              <div className="ocard" key={o.id}>
                <div className="oh">
                  <div>
                    <div className="onum">#{o.kodePesanan}</div>
                    <div className="ometa">{formatMeja(o.meja.nomorMeja)} · {formatJamSingkat(o.createdAt)}</div>
                    <div className="ometa" style={{ marginTop: 1 }}>{formatTanggalSingkat(o.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={`spill ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`ptag ${o.metodePembayaran === "qris" ? "p-qris" : "p-cash"}`}>{formatMetodeLabel(o.metodePembayaran)}</span>
                    </div>
                  </div>
                </div>
                <div className="ob">
                  {o.detailPesanan.map((d, i) => (
                    <div className="oir" key={i}>
                      <div>
                        <div className="oin">{d.namaItem}</div>
                        <div className="oiq">x{d.jumlah}</div>
                        {d.catatanItem && <div style={{ fontSize: 9, color: "var(--tm)", fontStyle: "italic", marginTop: 2 }}>📝 {d.catatanItem}</div>}
                      </div>
                      <div className="oip">{formatRupiah(d.harga * d.jumlah)}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, padding: "7px 9px", background: "var(--cream)", borderRadius: 8, border: "1px solid var(--bd)" }}>
                    <span style={{ fontSize: 13 }}>👤</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--br)" }}>{o.namaPelanggan}</div>
                      <div style={{ fontSize: 10, color: "var(--tm)" }}>{o.teleponPelanggan}</div>
                    </div>
                  </div>
                  {o.catatan && <div className="onote">📝 {o.catatan}</div>}
                  {o.status === "dibatalkan" && o.alasanPembatalan && (
                    <div className="onote" style={{ borderColor: "var(--scb)", background: "var(--sc)", color: "var(--sct)" }}>
                      ❌ Alasan: {o.alasanPembatalan}
                    </div>
                  )}
                  {o.kasir && <div className="ocby">Dikonfirmasi oleh: <strong>{o.kasir.namaLengkap}</strong></div>}
                  {o.status === "sedang_disiapkan" && (
                    <div className="pulse-wrap"><div className="pulse" />Sedang dibuat...</div>
                  )}
                  {o.status === "sedang_diantar" && (
                    <div className="pulse-wrap" style={{ color: "var(--svt)" }}><div className="pulse" style={{ background: "var(--svt)" }} />Sedang diantar ke meja...</div>
                  )}
                </div>
                <div className="of">
                  <div className="otot">{formatRupiah(o.totalHarga)}</div>
                  <div className="arow">
                    {o.status === "menunggu_konfirmasi" && o.metodePembayaran === "qris" && (
                      <>
                        <button className="btn btn-proof" onClick={() => setProofViewId(o.id)} disabled={busy}>
                          <span className={o.buktiPembayaran ? "proof-dot" : "proof-dot none"} />Lihat Bukti QRIS
                        </button>
                        <button className="btn btn-cancel" onClick={() => setTolakId(o.id)} disabled={busy}>✕ Batalkan</button>
                      </>
                    )}
                    {o.status === "menunggu_konfirmasi" && o.metodePembayaran === "cash" && (
                      <>
                        <button className="btn btn-paid" onClick={() => setPayId(o.id)} disabled={busy}>💰 Konfirmasi Bayar Cash</button>
                        <button className="btn btn-cancel" onClick={() => setTolakId(o.id)} disabled={busy}>✕ Batalkan</button>
                      </>
                    )}

                    {o.status === "diproses" && (
                      <>
                        <button className="btn btn-receipt" onClick={() => setReceiptView(o)}>🧾 Lihat Struk</button>
                        {isPemilik ? (
                          <button className="btn btn-confirm" onClick={() => kirimDapur(o.id, o.kodePesanan)} disabled={busy}>
                            {busy ? "Memproses..." : "👨‍🍳 Kirim ke Dapur"}
                          </button>
                        ) : (
                          <span className="btn-locked-info">🔒 Ditangani {o.kasir?.namaLengkap || "kasir lain"}</span>
                        )}
                      </>
                    )}
                    {o.status === "sedang_disiapkan" && (
                      isPemilik ? (
                        <button className="btn btn-deliver" onClick={() => antarMeja(o.id, o.kodePesanan)} disabled={busy}>
                          {busy ? "Memproses..." : "🚶 Antar ke Meja"}
                        </button>
                      ) : (
                        <span className="btn-locked-info">🔒 Ditangani {o.kasir?.namaLengkap || "kasir lain"}</span>
                      )
                    )}
                    {o.status === "sedang_diantar" && (
                      isPemilik ? (
                        <button className="btn btn-finish" onClick={() => selesai(o.id, o.kodePesanan)} disabled={busy}>
                          {busy ? "Memproses..." : "✓ Tandai Selesai"}
                        </button>
                      ) : (
                        <span className="btn-locked-info">🔒 Ditangani {o.kasir?.namaLengkap || "kasir lain"}</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL KONFIRMASI BAYAR (CASH) */}
      <div className={`mo${payId !== null ? " open" : ""}`}>
        <div className="mbox">
          <ModalHeader
            title="Konfirmasi Pembayaran"
            subtitle={payTarget ? `#${payTarget.kodePesanan}` : undefined}
            onClose={() => setPayId(null)}
          />
          <div>
            {payTarget?.detailPesanan.map((d, i) => (
              <div className="mir" key={i}><span>{d.namaItem} x{d.jumlah}</span><span>{formatRupiah(d.harga * d.jumlah)}</span></div>
            ))}
          </div>
          <div className="mtot"><span>Total</span><span>{payTarget ? formatRupiah(payTarget.totalHarga) : "Rp 0"}</span></div>
          <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 12, marginBottom: 6 }}>Metode Pembayaran</div>
          <div className="mpopt sel" style={{ cursor: "default" }}>
            <div className="ic">{payTarget?.metodePembayaran === "qris" ? "▦" : "💵"}</div>
            <div className="lbl">{payTarget ? formatMetodeLabel(payTarget.metodePembayaran) : ""}</div>
          </div>
          <div className="mbtns">
            <button
              className="mbtn mbtn-pri"
              onClick={() => payId !== null && konfirmasiBayar(payId)}
              disabled={payId !== null && isProcessing(payId)}
            >
              {payId !== null && isProcessing(payId) ? "Memproses..." : "Konfirmasi"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setPayId(null)} disabled={payId !== null && isProcessing(payId)}>
              Batal
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TOLAK */}
      <div className={`mo${tolakId !== null ? " open" : ""}`}>
        <div className="mbox" style={{ maxWidth: 400 }}>
          <ModalHeader
            title="Batalkan Pesanan"
            subtitle={tolakTarget ? `#${tolakTarget.kodePesanan} · ${formatMeja(tolakTarget.meja.nomorMeja)} · ${formatRupiah(tolakTarget.totalHarga)}` : undefined}
            onClose={closeTolakModal}
          />
          <div style={{ marginBottom: 13 }}>
            <label style={{ fontSize: 11, color: "var(--tm)", display: "block", marginBottom: 5 }}>
              Alasan Pembatalan <span style={{ color: "#C62828" }}>*</span>
            </label>
            <textarea
              placeholder="Contoh: Menu habis, bahan tidak tersedia..."
              style={{
                width: "100%",
                padding: "9px 12px",
                border: `1px solid ${tolakError ? "#C62828" : "var(--bd)"}`,
                borderRadius: 9,
                fontSize: 12,
                minHeight: 80,
              }}
              maxLength={MAX_ALASAN_LENGTH}
              value={tolakAlasan}
              onChange={(e) => {
                setTolakAlasan(e.target.value);
                if (tolakError) setTolakError("");
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {tolakError ? (
                <span style={{ fontSize: 10.5, color: "#C62828" }}>{tolakError}</span>
              ) : <span />}
              <span style={{ fontSize: 10.5, color: "var(--tm)" }}>{tolakAlasan.length}/{MAX_ALASAN_LENGTH}</span>
            </div>
          </div>
          <div style={{ background: "#FFEBEE", border: "1px solid #EF9A9A", borderRadius: 8, padding: "9px 12px", fontSize: 11, color: "#C62828" }}>
            ⚠️ Alasan ini akan dikirimkan ke pelanggan agar mereka tahu mengapa pesanannya dibatalkan.
          </div>
          <div className="mbtns">
            <button
              className="mbtn"
              style={{ background: "#C62828", color: "#fff" }}
              onClick={submitTolak}
              disabled={tolakId !== null && isProcessing(tolakId)}
            >
              {tolakId !== null && isProcessing(tolakId) ? "Memproses..." : "Batalkan Pesanan"}
            </button>
            <button className="mbtn mbtn-sec" onClick={closeTolakModal} disabled={tolakId !== null && isProcessing(tolakId)}>
              Batal
            </button>
          </div>
        </div>
      </div>

      {/* MODAL BUKTI QRIS */}
      <div className={`mo${proofView ? " open" : ""}`}>
        <div className="mbox">
          <ModalHeader
            title="Bukti Pembayaran QRIS"
            subtitle={proofView ? `#${proofView.kodePesanan} · ${formatMeja(proofView.meja.nomorMeja)} · ${formatRupiah(proofView.totalHarga)}` : undefined}
            onClose={() => setProofViewId(null)}
          />
          {proofView?.buktiPembayaran ? (
            <div className="proof-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofView.buktiPembayaran} alt="Bukti bayar" />
              <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 6 }}>📱 Tangkapan layar dikirim oleh pelanggan</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24, background: "var(--cream)", borderRadius: 10, color: "var(--tm)", fontSize: 13 }}>
              ⏳ Bukti belum dikirim oleh pelanggan.
            </div>
          )}
          <div className="mbtns" style={{ flexWrap: "wrap" }}>
            {proofView?.buktiPembayaran && (
              <button className="mbtn mbtn-sec" onClick={() => downloadBukti(proofView)}>⬇️ Unduh Bukti</button>
            )}
            <button
              className="mbtn mbtn-pri"
              onClick={() => {
                const id = proofView?.id;
                setProofViewId(null);
                if (id) setPayId(id);
              }}
            >
              Lanjut Konfirmasi Bayar
            </button>
          </div>
        </div>
      </div>

{/* MODAL STRUK */}
      <div className={`mo${receiptView ? " open" : ""}`}>
      <div className="mbox flex flex-col max-h-[85vh]" style={{ maxWidth: 380, overflowY: "hidden" }}>          
    
          {/* 1. Header (Sticky di atas, tidak ikut scroll) */}
          <div className="sticky top-0 bg-[var(--cb)] z-20 pb-2">
            <ModalHeader
              title="Struk Pembayaran"
              subtitle={receiptView ? `#${receiptView.kodePesanan}` : undefined}
              onClose={() => setReceiptView(null)}
            />
          </div>

          {/* 2. Konten Struk (Area yang bisa di-scroll sendiri) */}
            <div className="overflow-y-auto flex-1 min-h-0 pr-1">
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
                  <div className="receipt-row"><span className="lbl">Tanggal</span><span>{formatWaktuStruk(receiptView.createdAt)}</span></div>
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
                    <span>{formatMetodeLabel(receiptView.metodePembayaran)}</span>
                  </div>

                  <div className="receipt-footer">Terima kasih atas kunjungan Anda ☕</div>
                </div>
              );
            })()}
          </div>

          {/* 3. Footer / Tombol Aksi (Sticky di bawah, tidak ikut scroll) */}
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