// MejaClient.tsx
"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface MejaItem { id: number; nomorMeja: string; statusAktif: boolean; qr: string }

const NOMOR_MEJA_MAX_LEN = 5; // sinkron dengan @db.VarChar(5) di schema Prisma
const NOMOR_MEJA_PATTERN = /^[A-Za-z0-9]+$/;

export default function MejaClient({ initialMeja }: { initialMeja: MejaItem[] }) {
  const [mejaList, setMejaList] = useState(initialMeja);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nomor, setNomor] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [printTarget, setPrintTarget] = useState<MejaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MejaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  async function refresh() {
    try {
      const res = await fetch("/api/admin/meja", { cache: "no-store" });
      if (res.ok) setMejaList((await res.json()).meja);
    } catch {
      showToast({ type: "error", title: "Gagal memuat ulang data meja", detail: "Silakan periksa koneksi internet Anda dan coba lagi." });
    }
  }

  function openAdd() { setEditId(null); setNomor(""); setError(""); setModalOpen(true); }
  function openEdit(m: MejaItem) { setEditId(m.id); setNomor(m.nomorMeja); setError(""); setModalOpen(true); }

  function validateNomorMeja(nilai: string): string | null {
    const trimmed = nilai.trim();
    if (!trimmed) return "Nomor meja wajib diisi.";
    if (trimmed.length > NOMOR_MEJA_MAX_LEN) return `Nomor meja maksimal ${NOMOR_MEJA_MAX_LEN} karakter.`;
    if (!NOMOR_MEJA_PATTERN.test(trimmed)) return "Nomor meja hanya boleh berisi huruf dan angka, tanpa spasi atau simbol.";
    return null;
  }

  async function save() {
    const validationError = validateNomorMeja(nomor);
    if (validationError) { setError(validationError); return; }

    setError("");
    setIsSaving(true);
    try {
      const nomorTrim = nomor.trim();
      const url = editId ? `/api/admin/meja/${editId}` : "/api/admin/meja";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorMeja: nomorTrim }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Gagal menyimpan data meja. Silakan coba lagi.");
        return;
      }
      setModalOpen(false);
      await refresh();
      showToast({ type: "success", title: editId ? "Meja diperbarui" : "Meja ditambahkan", detail: `Meja "${nomorTrim}" berhasil disimpan beserta QR Code-nya.` });
    } catch {
      setError("Gagal terhubung ke server. Silakan periksa koneksi internet Anda.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestHapus(m: MejaItem) { setDeleteTarget(m); }

  async function confirmHapus() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/meja/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast({ type: "error", title: "Gagal menghapus meja", detail: data?.message || "Silakan coba lagi dalam beberapa saat." });
        return;
      }
      await refresh();
      showToast({ type: "success", title: "Meja dihapus", detail: `Meja "${deleteTarget.nomorMeja}" beserta QR Code-nya telah dihapus dari sistem.` });
      setDeleteTarget(null);
    } catch {
      showToast({ type: "error", title: "Gagal menghapus meja", detail: "Silakan periksa koneksi internet Anda." });
    } finally {
      setIsDeleting(false);
    }
  }

  // ── PRINT VIA WINDOW BARU — TIDAK DIUBAH sesuai keputusan sebelumnya ──
  function printQr(m: MejaItem) {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) {
      showToast({ type: "warning", title: "Popup diblokir", detail: "Silakan izinkan popup untuk situs ini agar dapat mencetak QR Code." });
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Cetak QR Meja ${m.nomorMeja}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { width: 100%; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
          .card { width: 80mm; margin: 0 auto; padding: 10mm 6mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
          .header { font-size: 16pt; font-weight: 700; margin-bottom: 2mm; }
          .sub { font-size: 10pt; margin-bottom: 6mm; }
          .qr { width: 45mm; height: 45mm; border: 1px solid #000; display: block; }
          .table { font-size: 14pt; font-weight: 700; margin-top: 5mm; }
          .hint { font-size: 9pt; color: #333; margin-top: 3mm; line-height: 1.4; }
          .footer { font-size: 9pt; margin-top: 6mm; border-top: 1px dashed #999; padding-top: 3mm; width: 100%; }
          @page { size: 80mm auto; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">Coffeebox_Jkt</div>
          <div class="sub">☕ Pindai untuk memesan</div>
          <img class="qr" src="${m.qr}" alt="QR" />
          <div class="table">Meja ${m.nomorMeja}</div>
          <div class="hint">Pindai QR Code ini untuk melihat menu<br/>dan melakukan pemesanan</div>
          <div class="footer">Coffeebox_Jkt</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();

    win.onload = () => { win.focus(); win.print(); };
  }

  return (
    <div className="pg on">
      <div className="pghead">
        <div className="pghead-titlewrap">
          <div className="pgtitle">Kelola Meja</div>
          <div className="pgsub">Tambahkan meja baru lengkap dengan QR Code otomatis untuk pemesanan</div>
        </div>
        <button className="btn btn-pri" onClick={openAdd}>+ Tambah Meja</button>
      </div>

      <div className="info-box info-box-lg info-cream" style={{ marginBottom: 20 }}>
        <span className="info-box-icon">ℹ️</span>
        <span className="info-box-text">Setiap QR Code meja berisi tautan unik yang akan membuka halaman pemesanan pelanggan. Klik 🖨️ Cetak untuk mencetak ulang jika QR Code meja rusak atau hilang.</span>
      </div>

      <div className="mejagrid">
        {mejaList.map((m) => (
          <div className="mejacard" key={m.id}>
            <div className="mejacard-head">
              <div>
                <div className="mejacard-label">Meja</div>
                <div className="mejacard-num">{m.nomorMeja}</div>
              </div>
            </div>
            <div className="mejacard-qr" onClick={() => setPrintTarget(m)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.qr} alt={`QR Meja ${m.nomorMeja}`} />
            </div>
            <div className="mejacard-acts">
              <button className="btn btn-pri btn-flex1" onClick={() => printQr(m)}>🖨️ Cetak QR</button>
              <button className="btn btn-edit" onClick={() => openEdit(m)}>✏️</button>
              <button className="btn btn-del" onClick={() => requestHapus(m)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      <div className={`mo${modalOpen ? " open" : ""}`}>
        <div className="mbox">
          <button className="mclose" onClick={() => !isSaving && setModalOpen(false)} disabled={isSaving}>✕</button>
          <div className="mttl">{editId ? "Edit Meja" : "Tambah Meja Baru"}</div>
          <div className="form-g">
            <label className="form-lbl">Nomor Meja</label>
            <input
              className="form-inp"
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              maxLength={NOMOR_MEJA_MAX_LEN}
              disabled={isSaving}
              placeholder="Contoh: 1"
            />
          </div>
          <div className="info-box info-green">
            <span className="info-box-text">QR Code unik akan dibuat otomatis. Pelanggan cukup memindai untuk membuka menu dan memesan.</span>
          </div>
          {error && <div className="login-err" style={{ marginTop: 11, marginBottom: 0 }}>{error}</div>}
          <div className="mbtns">
            <button className="mbtn mbtn-pri" onClick={save} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : editId ? "Simpan" : "Tambahkan Meja"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setModalOpen(false)} disabled={isSaving}>Batal</button>
          </div>
        </div>
      </div>

      <div className={`qr-print-preview${printTarget ? " open" : ""}`}>
        <div className="qr-print-box">
          <button className="mclose" onClick={() => setPrintTarget(null)}>✕</button>
          <div className="qr-print-header">Coffeebox_Jkt</div>
          <div className="qr-print-sub">☕ Pindai untuk memesan</div>
          {printTarget && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={printTarget.qr} alt="QR" className="qr-print-img" />
          )}
          <div className="qr-print-table">Meja {printTarget?.nomorMeja}</div>
          <div className="qr-print-hint">Pindai QR Code ini untuk melihat menu<br />dan melakukan pemesanan</div>
          <div className="qr-print-footer">Coffeebox_Jkt</div>
          <div className="qr-print-btns">
            <button className="mbtn mbtn-pri" onClick={() => printTarget && printQr(printTarget)}>🖨️ Cetak Sekarang</button>
            <button className="mbtn mbtn-sec" onClick={() => setPrintTarget(null)}>Tutup</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title="Hapus meja ini?"
        description={deleteTarget ? `Meja "${deleteTarget.nomorMeja}" beserta QR Code-nya akan dihapus permanen dan tidak dapat dikembalikan.` : ""}
        confirmLabel="Ya, Hapus"
        isLoading={isDeleting}
        onConfirm={confirmHapus}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
      />
    </div>
  );
}