// src/app/kasir/dashboard/DashboardKasirClient.tsx

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatRupiah } from "@/lib/utils";

import type { getDashboardKasir } from "@/services/pesananService";

type DashboardKasirData = Awaited<ReturnType<typeof getDashboardKasir>>;

const POLL_INTERVAL_MS = 5000;

// Label & warna badge status pesanan — DISAMAKAN dengan nama class status
// global di order.css (s-new / s-done / s-proc / s-deliver / s-paid / s-cancel),
// supaya konsisten dengan OrdersClient.tsx & HistoryClient.tsx.
const STATUS_META: Record<string, { label: string; className: string }> = {
  menunggu_konfirmasi: { label: "Menunggu Konfirmasi", className: "spill s-new" },
  diproses: { label: "Diproses", className: "spill s-done" },
  sedang_disiapkan: { label: "Sedang Disiapkan", className: "spill s-proc" },
  sedang_diantar: { label: "Sedang Diantar", className: "spill s-deliver" },
  selesai: { label: "Selesai", className: "spill s-paid" },
  dibatalkan: { label: "Dibatalkan", className: "spill s-cancel" },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, className: "spill s-new" };
}

export default function DashboardKasirClient({ initialData }: { initialData: DashboardKasirData }) {
  const [dbk, setDbk] = useState<DashboardKasirData>(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const hasNotifiedError = useRef(false);
  const isFetchingRef = useRef(false);

  // Ditandai true begitu sesi terdeteksi habis, supaya polling berhenti
  // total dan tidak spam toast/redirect selama proses navigasi berlangsung.
  const isSessionExpiredRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isFetchingRef.current || isSessionExpiredRef.current) return;
    isFetchingRef.current = true;

    try {
      setIsSyncing(true);
      const res = await fetch("/api/kasir/dashboard", { cache: "no-store" });

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

      if (res.status === 403) {
        if (!hasNotifiedError.current) {
          showToast({
            type: "error",
            title: "Akses ditolak",
            detail: "Anda tidak memiliki izin untuk melihat dashboard ini.",
          });
          hasNotifiedError.current = true;
        }
        return;
      }

      if (!res.ok) {
        if (!hasNotifiedError.current) {
          showToast({
            type: "error",
            title: "Gagal memuat data terbaru",
            detail: "Data yang ditampilkan mungkin belum menampilkan versi terbaru.",
          });
          hasNotifiedError.current = true;
        }
        return;
      }

      const data = await res.json();
      setDbk(data);
      hasNotifiedError.current = false;
    } catch {
      if (!hasNotifiedError.current) {
        showToast({
          type: "error",
          title: "Koneksi terputus",
          detail: "Sedang mencoba tersambung kembali secara otomatis...",
        });
        hasNotifiedError.current = true;
      }
    } finally {
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  }, [showToast, router]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRef.current();
    }, POLL_INTERVAL_MS);

    function onFocus() {
      refreshRef.current();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refreshRef.current();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <div
        style={{ fontSize: 10, color: "var(--tm)", marginBottom: 6, height: 12 }}
        aria-live="polite"
      >
        {isSyncing ? "Menyinkronkan..." : ""}
      </div>

      <div className="db-kpi-grid">
        <div className="db-kpi">
          <div className="slbl">Menunggu Konfirmasi</div>
          <div className="db-kpi-val">{dbk.menungguKonfirmasi}</div>
          <div className="ssub">
            <span className="sdot" style={{ background: "#81C784" }} />
            Butuh konfirmasi
          </div>
        </div>
        <div className="db-kpi">
          <div className="slbl">Diproses</div>
          <div className="db-kpi-val">{dbk.diproses}</div>
          <div className="ssub">
            <span className="sdot" style={{ background: "#64B5F6" }} />
            Dikonfirmasi kasir
          </div>
        </div>
        <div className="db-kpi">
          <div className="slbl">Sedang Disiapkan</div>
          <div className="db-kpi-val">{dbk.sedangDisiapkan}</div>
          <div className="ssub">
            <span className="sdot" style={{ background: "#FFB74D" }} />
            Di dapur sekarang
          </div>
        </div>
        <div className="db-kpi">
          <div className="slbl">Sedang Diantar</div>
          <div className="db-kpi-val">{dbk.sedangDiantar}</div>
          <div className="ssub">
            <span className="sdot" style={{ background: "#BA68C8" }} />
            Menuju meja
          </div>
        </div>
        <div className="db-kpi">
          <div className="slbl">Selesai Hari Ini</div>
          <div className="db-kpi-val">{dbk.selesaiHariIni}</div>
          <div className="ssub">
            <span className="sdot" style={{ background: "#AED581" }} />
            Transaksi selesai
          </div>
        </div>
      </div>

      <div className="db-row2">
        <div className="db-panel">
          <div className="db-panel-ttl">💵 Pemasukan Hari Ini</div>
          <div className="db-rev-big">{formatRupiah(dbk.totalPendapatan)}</div>
          <div className="db-rev-row">
            <div className="db-rev-item">
              <div className="db-rev-label">
                <span className="ptag p-qris">QRIS</span>
              </div>
              <div className="db-rev-val">{formatRupiah(dbk.pendapatanQris)}</div>
              <div className="db-rev-count">{dbk.jumlahQris} transaksi</div>
            </div>
            <div className="db-rev-item">
              <div className="db-rev-label">
                <span className="ptag p-cash">Cash</span>
              </div>
              <div className="db-rev-val">{formatRupiah(dbk.pendapatanCash)}</div>
              <div className="db-rev-count">{dbk.jumlahCash} transaksi</div>
            </div>
          </div>
        </div>
        <div className="db-panel">
          <div className="db-panel-ttl">🕐 Pesanan Terakhir</div>
          <div className="db-recent-list">
            {dbk.terbaru.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--tm)", fontSize: 12 }}>
                Belum ada pesanan
              </div>
            ) : (
              dbk.terbaru.map((o) => {
                const meta = getStatusMeta(o.status);
                return (
                  <div className="db-recent-item" key={o.id}>
                    <div>
                      <div className="db-recent-id">#{o.kodePesanan}</div>
                      <div className="db-recent-meta">{formatRupiah(Number(o.totalHarga))}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className={meta.className}>{meta.label}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}