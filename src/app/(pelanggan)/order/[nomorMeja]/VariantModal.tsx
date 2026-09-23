"use client";

import { useEffect, useState } from "react";
import { VarianTampil } from "@/types/pesanan";

interface VariantModalProps {
  show: boolean;
  title: string;
  subtitle: string;
  initialVarian: VarianTampil;
  initialNote: string;
  showVarian?: boolean;
  onClose: () => void;
  onSave: (varian: VarianTampil, note: string) => void;
}

export default function VariantModal({
  show,
  title,
  subtitle,
  initialVarian,
  initialNote,
  showVarian = true,
  onClose,
  onSave,
}: VariantModalProps) {
  const [temp, setTemp] = useState<VarianTampil>(initialVarian);
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (show) {
      setTemp(initialVarian);
      setNote(initialNote);
    }
  }, [show, initialVarian, initialNote]);

  return (
    <div
      id="variant-modal"
      className={`modal-overlay${show ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet">
        <div className="modal-head">
          <div className="modal-title" id="vm-title">
            {title}
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-sub" id="vm-sub">
          {subtitle}
        </div>
        {showVarian && (
          <>
            <label className="modal-lbl">Pilih Varian</label>
            <div className="temp-opts">
              <div
                className={`temp-opt${temp === "Iced" ? " sel" : ""}`}
                id="vm-ice"
                onClick={() => setTemp("Iced")}
              >
                <div className="temp-opt-ic">🥤</div>
                <div className="temp-opt-nm">Iced</div>
              </div>
              <div
                className={`temp-opt${temp === "Hot" ? " sel" : ""}`}
                id="vm-hot"
                onClick={() => setTemp("Hot")}
              >
                <div className="temp-opt-ic">☕</div>
                <div className="temp-opt-nm">Hot</div>
              </div>
            </div>
          </>
        )}
        <label className="modal-lbl">Catatan (opsional)</label>
        <textarea
          className="inp-f"
          id="vm-note"
          placeholder="Tuliskan catatan tambahan bila perlu"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="act-btn btn-pri"
          style={{ marginTop: 14, marginBottom: 0 }}
          onClick={() => onSave(temp, note.trim())}
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
