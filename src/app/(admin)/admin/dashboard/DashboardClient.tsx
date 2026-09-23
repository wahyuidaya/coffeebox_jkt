"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatRupiah, formatRupiahSingkat } from "@/lib/utils";
import type { getDashboardAdmin } from "@/services/transaksiService";

type DashboardData = Awaited<ReturnType<typeof getDashboardAdmin>>;

const POLL_INTERVAL_MS = 5000;

export default function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [d, setD] = useState<DashboardData>(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();
  const hasNotifiedError = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });

      if (res.status === 401) {
        showToast({ type: "warning", title: "Sesi berakhir", detail: "Silakan masuk kembali untuk melanjutkan." });
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        if (!hasNotifiedError.current) {
          showToast({ type: "error", title: "Akses ditolak", detail: "Anda tidak memiliki izin untuk mengakses dashboard ini." });
          hasNotifiedError.current = true;
        }
        return;
      }
      if (!res.ok) {
        if (!hasNotifiedError.current) {
          showToast({ type: "error", title: "Gagal memuat data terbaru", detail: "Data yang ditampilkan mungkin belum diperbarui." });
          hasNotifiedError.current = true;
        }
        return;
      }

      const data = await res.json();
      setD(data);
      hasNotifiedError.current = false;
    } catch {
      if (!hasNotifiedError.current) {
        showToast({ type: "error", title: "Koneksi terputus", detail: "Mencoba menghubungkan kembali secara otomatis..." });
        hasNotifiedError.current = true;
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, router]);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    function onFocus() { refresh(); }
    function onVisibility() { if (document.visibilityState === "visible") refresh(); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const maxRev = Math.max(...d.pendapatan7Hari.map((x) => x.total), 1);
  const R = 40;
  const CIRC = 2 * Math.PI * R;
  const qrisDash = (d.qrisPercent / 100) * CIRC;

  const totalTransaksiBayar = d.qrisCount + d.cashCount;
  const belumAdaTransaksi = totalTransaksiBayar === 0;

  return (
    <>
      <div className="sync-indicator-block">{isSyncing ? "Menyinkronkan..." : ""}</div>

      {/* ===== STAT CARDS ===== */}
      <div className="srow">
        <div className="sc">
          <div className="slbl">Pendapatan Hari Ini</div>
          <div className="sval">{formatRupiahSingkat(d.pendapatanHariIni)}</div>
          <div className={`strnd ${d.trendPendapatan > 0 ? "tup" : d.trendPendapatan < 0 ? "tdn" : ""}`}>
            {d.trendPendapatan > 0 ? "↑ " : d.trendPendapatan < 0 ? "↓ " : ""}
            {d.trendPendapatanLabel}
          </div>
        </div>

        <div className="sc">
          <div className="slbl">Total Transaksi</div>
          <div className="sval">{d.totalTransaksi}</div>
            <div className={`strnd ${d.trendTransaksi > 0 ? "tup" : d.trendTransaksi < 0 ? "tdn" : ""}`}>
              {d.totalTransaksi === 0 && d.totalTransaksiKemarin === 0
                ? "Belum ada transaksi"
                : d.trendTransaksi === 0
                  ? "Sama dengan kemarin"
                  : `${d.trendTransaksi > 0 ? "↑" : "↓"} ${Math.abs(d.trendTransaksi)} transaksi ${
                      d.trendTransaksi > 0
                        ? ""
                        : ""
                    } dibanding kemarin`}
            </div>
        </div>

        <div className="sc">
          <div className="slbl">Total Item Terjual</div>
          <div className="sval">{d.itemTerjual}</div>
          <div className="sctxt">Berdasarkan transaksi hari ini</div>
        </div>

        <div className="sc">
          <div className="slbl">Rata-rata Nilai Transaksi</div>
          <div className="sval">{formatRupiahSingkat(d.rataRataPesanan)}</div>
            <div className={`strnd ${d.trendRataRata > 0 ? "tup" : d.trendRataRata < 0 ? "tdn" : ""}`}>
              {d.rataRataPesanan === 0 && d.rataRataPesananKemarin === 0
                ? "Belum ada transaksi"
                : d.trendRataRata === 0
                  ? "Sama dengan kemarin"
                  : `${d.trendRataRata > 0 ? "↑" : "↓"} ${formatRupiahSingkat(
                      Math.abs(d.trendRataRata)
                    )} dibanding kemarin`}
            </div>
        </div>
      </div>

      <div className="twocol">
        {/* ===== BAR CHART 7 HARI ===== */}
        <div className="cw cw-flat">
          <div className="cwtitle">Grafik Pendapatan 7 Hari Terakhir</div>
          <div className="cw-chart-wrap">
            <div className="barchart" id="bc-week">
              {d.pendapatan7Hari.map((day, i) => (
                <div className="bwrap" key={i}>
                  <div className="bwrap-fill">
                    <div
                      className="bar"
                      data-tip={formatRupiahSingkat(day.total)}
                      style={{
                        background: day.total === maxRev ? "#5C2E1A" : "#B87040",
                        height: `${Math.max((day.total / maxRev) * 130, 4)}px`,
                        width: "100%",
                      }}
                    />
                  </div>
                  <span className="blbl">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== DONUT CHART METODE PEMBAYARAN ===== */}
        <div className="cw cw-flat">
          <div className="cwtitle">Metode Pembayaran</div>
          <div className="donut-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={R} fill="none" stroke={belumAdaTransaksi ? "#E8EAF6" : "#C8972F"} strokeWidth="18" />
              {!belumAdaTransaksi && (
                <circle
                  cx="55" cy="55" r={R} fill="none" stroke="#5C2E1A" strokeWidth="18"
                  strokeDasharray={`${qrisDash} ${CIRC - qrisDash}`}
                  transform="rotate(-90 55 55)"
                />
              )}
              <text x="55" y="51" textAnchor="middle" fontFamily="Playfair Display,serif" fontSize="13" fontWeight="700" fill="#1A0F07">
                {belumAdaTransaksi ? "-" : `${d.qrisPercent >= 50 ? d.qrisPercent : 100 - d.qrisPercent}%`}
              </text>
              <text x="55" y="63" textAnchor="middle" fontSize="9" fill="#7A5C3A">
                {belumAdaTransaksi ? "Belum ada" : (d.qrisPercent >= 50 ? "QRIS" : "Cash")}
              </text>
            </svg>
            <div className="dlegend">
              <div className="dli">
                <div className="ddot" style={{ background: "#5C2E1A" }} />
                <div>
                  <div className="dli-title">QRIS</div>
                  <div className="dli-sub">{d.qrisCount} transaksi ({belumAdaTransaksi ? 0 : d.qrisPercent}%)</div>
                </div>
              </div>
              <div className="dli">
                <div className="ddot" style={{ background: "#C8972F" }} />
                <div>
                  <div className="dli-title">Cash</div>
                  <div className="dli-sub">{d.cashCount} transaksi ({belumAdaTransaksi ? 0 : 100 - d.qrisPercent}%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABEL MENU TERLARIS ===== */}
      <div className="twrap">
        <div className="twrap-hdr">
          <div className="twrap-ttl">Menu Terlaris Hari Ini</div>
        </div>
        <table className="atbl">
          <thead>
            <tr>
              <th>Nama Menu</th>
              <th>Kategori</th>
              <th>Jumlah Terjual</th>
              <th>Total Pendapatan</th>
              <th>Popularitas</th>
            </tr>
          </thead>
          <tbody>
            {d.menuTerlaris.length === 0 ? (
              <tr>
                <td colSpan={5} className="atbl-empty">Belum ada penjualan hari ini</td>
              </tr>
            ) : (
              d.menuTerlaris.map((m) => (
                <tr key={m.id}>
                  <td>{m.nama}</td>
                  <td>{m.kategori}</td>
                  <td>{m.qty}</td>
                  <td>{formatRupiah(m.revenue)}</td>
                  <td>
                    <div className="atbl-pop">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${m.pct}%`, background: m.kategori === "Black Coffee" ? "var(--gold)" : "var(--bm)" }}
                        />
                      </div>
                      {m.pct}%
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}