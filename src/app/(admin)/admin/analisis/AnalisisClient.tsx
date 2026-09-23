"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatRupiah } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { getAnalisis } from "@/services/transaksiService";

type AnalisisData = Awaited<ReturnType<typeof getAnalisis>>;

const POLL_INTERVAL_MS = 5000;
const MAX_CONSECUTIVE_FAILURES_BEFORE_TOAST = 3;

function isValidAnalisisData(data: unknown): data is AnalisisData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.pendapatanBulanan) &&
    Array.isArray(d.jamTersibuk) &&
    Array.isArray(d.performaKasir) &&
    typeof d.insight === "object" &&
    d.insight !== null
  );
}

export default function AnalisisClient({ initialData, tahun }: { initialData: AnalisisData; tahun: number }) {
  const [d, setD] = useState<AnalisisData>(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  const isFetchingRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const hasWarnedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsSyncing(true);

    try {
      const res = await fetch(`/api/admin/analisis?tahun=${tahun}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Gagal memuat data (status ${res.status})`);

      const data = await res.json();
      if (!isValidAnalisisData(data)) throw new Error("Format data dari server tidak sesuai");

      setD(data);
      consecutiveFailuresRef.current = 0;
      hasWarnedRef.current = false;
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES_BEFORE_TOAST && !hasWarnedRef.current) {
        hasWarnedRef.current = true;
        showToast({ type: "warning", title: "Gagal menyinkronkan data", detail: "Koneksi ke server bermasalah. Data yang ditampilkan mungkin belum terbaru." });
      }
    } finally {
      isFetchingRef.current = false;
      setIsSyncing(false);
    }
  }, [tahun, showToast]);

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

  const maxBulan = Math.max(...d.pendapatanBulanan.map((x) => x.total), 1);
  const maxJam = Math.max(...d.jamTersibuk.map((x) => x.count), 1);

  return (
    <>
      <div className="sync-indicator-block">{isSyncing ? "Menyinkronkan..." : ""}</div>

      {/* ===== ROW 1: Pendapatan Bulanan + Jam Tersibuk ===== */}
      <div className="twocol">
        <div className="cw cw-flat">
          <div className="cwtitle">Pendapatan Bulanan {tahun}</div>
          <div className="cw-chart-wrap">
            <div className="barchart">
              {d.pendapatanBulanan.map((b, i) => (
                <div className="bwrap" key={i}>
                  <div className="bwrap-fill">
                    <div
                      className="bar"
                      data-tip={formatRupiah(b.total)}
                      style={{
                        background: b.total === maxBulan ? "#5C2E1A" : "#B87040",
                        height: `${Math.max((b.total / maxBulan) * 130, 4)}px`,
                        width: "100%",
                      }}
                    />
                  </div>
                  <span className="blbl">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cw cw-flat">
          <div className="cwtitle">Jam Tersibuk (Malam)</div>
          {d.jamTersibuk.length === 0 ? (
            <div className="cw-empty">Data jam tersibuk hanya tersedia untuk tahun ini.</div>
          ) : (
            <div className="cw-chart-wrap">
              <div className="barchart">
                {d.jamTersibuk.map((j, i) => (
                  <div className="bwrap" key={i}>
                    <div className="bwrap-fill">
                      <div
                        className="bar"
                        data-tip={`${j.count}`}
                        style={{
                          background: j.count === maxJam && maxJam > 0 ? "#C8972F" : "#E8C878",
                          height: `${Math.max((j.count / maxJam) * 130, 4)}px`,
                          width: "100%",
                        }}
                      />
                    </div>
                    <span className="blbl">{j.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== ROW 2: Performa Kasir + Insight Bulan Ini ===== */}
      <div className="twocol" style={{ marginTop: 14 }}>
        <div className="cw cw-flat">
          <div className="cwtitle">Performa Kasir (Bulan Ini)</div>
          <table className="atbl atbl-mt">
            <thead>
              <tr>
                <th>Kasir</th>
                <th>Transaksi</th>
                <th>Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {d.performaKasir.length === 0 ? (
                <tr><td colSpan={3} className="atbl-empty">Belum ada data kasir</td></tr>
              ) : (
                d.performaKasir.map((k) => (
                  <tr key={k.nama}>
                    <td><strong>{k.nama}</strong></td>
                    <td>{k.transaksi}</td>
                    <td>{formatRupiah(k.pendapatan)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cw cw-flat">
          <div className="cwtitle">Wawasan Bulan Ini</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 6 }}>
            <div className="info-box info-green">
              <div className="info-box-text">
                <strong>
                  Pendapatan {d.insight.trendPendapatanBulanIni >= 0 ? "naik" : "turun"}{" "}
                  {Math.abs(d.insight.trendPendapatanBulanIni)}%
                </strong>{" "}
                dari bulan lalu.
                {d.insight.bestSeller && (
                  <> Menu {d.insight.bestSeller.nama} menjadi menu terlaris dengan {d.insight.bestSeller.qty} porsi terjual.</>
                )}
              </div>
            </div>

            <div className="info-box info-yellow">
              <div className="info-box-text">
                <strong>Jam tersibuk: {d.insight.peakHourLabel}.</strong> Pertimbangkan menambah kasir pada jam tersebut.
              </div>
            </div>

            <div className="info-box info-blue">
              <div className="info-box-text">
                <strong>QRIS mendominasi {d.insight.qrisPercentBulanIni}%</strong> transaksi. Pastikan QR merchant tetap aktif setiap malam.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}