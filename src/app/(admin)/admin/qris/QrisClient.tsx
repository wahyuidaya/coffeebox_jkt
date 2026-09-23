"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface QrisClientProps { initialGambarQris: string | null; updatedAt: string | null; }

const MAX_QRIS_SIZE_BYTES = 2 * 1024 * 1024;

export default function QrisClient({ initialGambarQris, updatedAt }: QrisClientProps) {
  const [gambar, setGambar] = useState<string | null>(initialGambarQris);
  const [lastUpdated, setLastUpdated] = useState<string | null>(updatedAt);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmHapus, setConfirmHapus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  async function uploadDanSimpan(file: File) {
    if (!file.type.startsWith("image/")) {
      showToast({ type: "error", title: "File tidak valid", detail: "File harus berupa gambar dengan format JPG atau PNG." });
      return;
    }
    if (file.size > MAX_QRIS_SIZE_BYTES) {
      showToast({ type: "error", title: "Ukuran file terlalu besar", detail: "Ukuran gambar QRIS maksimal 2MB." });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "qris");
      const uploadRes = await fetch("/api/admin/upload-image", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        showToast({ type: "error", title: "Gagal mengunggah gambar", detail: err?.message || "Silakan coba lagi atau gunakan file lain." });
        return;
      }
      const { url } = await uploadRes.json();

      const saveRes = await fetch("/api/admin/qris", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gambarQris: url }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => null);
        showToast({ type: "error", title: "Gambar berhasil diunggah, tetapi gagal disimpan", detail: err?.message || "Silakan unggah ulang." });
        return;
      }
      const saved = await saveRes.json();
      setGambar(saved.gambarQris);
      setLastUpdated(saved.updatedAt);
      showToast({
        type: "success",
        title: initialGambarQris ? "Kode QR diperbarui" : "QRIS diaktifkan",
        detail: "Kode QR pembayaran QRIS berhasil diperbarui dan langsung ditampilkan kepada pelanggan.",
      });
    } catch {
      showToast({ type: "error", title: "Gagal mengunggah gambar", detail: "Periksa koneksi internet Anda." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function requestHapus() { setConfirmHapus(true); }

  async function confirmHapusQris() {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/qris", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gambarQris: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast({ type: "error", title: "Gagal menghapus QRIS", detail: err?.message || "Coba lagi dalam beberapa saat." });
        return;
      }
      setGambar(null);
      setLastUpdated(null);
      showToast({ type: "success", title: "QRIS dihapus", detail: "Metode pembayaran QRIS tidak lagi ditampilkan di halaman pelanggan." });
      setConfirmHapus(false);
    } catch {
      showToast({ type: "error", title: "Gagal menghapus QRIS", detail: "Periksa koneksi internet Anda." });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadDanSimpan(file);
  }

  function handleGantiChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadDanSimpan(file);
  }

  return (
    <div className="pg on">
      <div className="pgtitle">Pembayaran QRIS</div>
      <div className="pgsub">Kelola kode QR yang ditampilkan kepada pelanggan saat melakukan pembayaran QRIS.</div>

      <div className="qris-card qris-card-sm">
        <div className="qris-card-hdr">
          <div className="qris-card-title">Kode QR</div>
          <span className={`status-pill ${gambar ? "status-pill-on" : "status-pill-off"}`}>
            {gambar ? "● Aktif" : "○ Belum diatur"}
          </span>
        </div>

        {gambar ? (
          <>
          <label className="qris-preview-box" style={{ cursor: "pointer", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gambar} alt="Kode QR QRIS" className="qris-preview-img" />

            <div className="qris-ganti-btn">
              {uploading ? (
                "Mengunggah..."
              ) : (
                <>
                  <span className="qris-ganti-icon">🔄</span> Klik untuk Ganti QR Code
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={handleGantiChange}
            />
          </label>

            <button className="qris-hapus-btn" onClick={requestHapus} disabled={uploading || isDeleting}>
              🗑 Hapus
            </button>
          </>
        ) : (
          <label
            className={`qris-upload-area${dragOver ? " drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="qris-upload-icon">📤</div>
            <div className="qris-upload-title">{uploading ? "Mengunggah..." : "Klik atau seret gambar kode QR ke sini"}</div>
            <div className="qris-upload-hint">PNG / JPG · Maksimal 2MB</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && uploadDanSimpan(e.target.files[0])}
            />
          </label>
        )}

        {lastUpdated && (
          <div className="qris-updated-at">
            Terakhir diperbarui: {new Date(lastUpdated).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmHapus}
        variant="danger"
        title="Hapus Kode QR QRIS?"
        description="Metode pembayaran QRIS akan hilang dari halaman pelanggan sampai kode QR baru diunggah."
        confirmLabel="Ya, Hapus"
        isLoading={isDeleting}
        onConfirm={confirmHapusQris}
        onCancel={() => !isDeleting && setConfirmHapus(false)}
      />
    </div>
  );
}