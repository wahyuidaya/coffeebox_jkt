"use client";

import { useEffect, useRef, type ElementType } from "react";
import { Trash2, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "success" | "info";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface VariantStyle {
  iconBg: string;
  iconColor: string;
  icon: ElementType;
  confirmBtn: string;
}

// Warna semantik disamakan dengan yang sudah dipakai di badge admin.css
// (.b-del/.b-off = #C62828, .b-on = #1B5E20, .b-cash = #E65100, .b-qris = #0D47A1)
// supaya danger/success/warning/info di seluruh app konsisten, bukan pakai
// merah-hijau-biru generic bawaan Tailwind.
const variantStyles: Record<ConfirmVariant, VariantStyle> = {
  danger: {
    iconBg: "bg-[#FFEBEE]",
    iconColor: "text-[#C62828]",
    icon: Trash2,
    confirmBtn: "bg-[#C62828] hover:bg-[#B71C1C] focus:ring-[#C62828]",
  },
  warning: {
    iconBg: "bg-[#FFF8E1]",
    iconColor: "text-[#E65100]",
    icon: AlertTriangle,
    confirmBtn: "bg-[#E65100] hover:bg-[#D84315] focus:ring-[#E65100]",
  },
  success: {
    iconBg: "bg-[#E8F5E9]",
    iconColor: "text-[#1B5E20]",
    icon: CheckCircle2,
    confirmBtn: "bg-[#2E7D32] hover:bg-[#1B5E20] focus:ring-[#2E7D32]",
  },
  info: {
    iconBg: "bg-[#E3F2FD]",
    iconColor: "text-[#0D47A1]",
    icon: Info,
    confirmBtn: "bg-[#0D47A1] hover:bg-[#08306B] focus:ring-[#0D47A1]",
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  variant = "danger",
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const style = variantStyles[variant];
  const Icon = style.icon;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* backdrop disamakan dengan .mo di admin.css: rgba(26,15,7,.5) = var(--br) di 50% */}
      <div
        className="absolute inset-0 bg-[#1A0F07]/50"
        onClick={() => !isLoading && onCancel()}
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-sm rounded-2xl bg-cbx-cb border border-cbx-bd p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 font-dmsans"
      >
        <button
          type="button"
          onClick={() => !isLoading && onCancel()}
          className="absolute right-4 top-4 text-cbx-tm hover:text-cbx-br hover:bg-cbx-cream rounded-full p-1 transition disabled:opacity-40"
          disabled={isLoading}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${style.iconBg}`}>
            <Icon className={style.iconColor} size={26} />
          </div>

          <h2 id="confirm-dialog-title" className="font-playfair text-lg font-bold text-cbx-br">
            {title}
          </h2>
          <p className="mt-2 text-sm text-cbx-tm leading-relaxed">{description}</p>

          <div className="mt-6 flex w-full gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-cbx-bd bg-white py-2.5 text-sm font-medium text-cbx-tm transition hover:bg-cbx-cream disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${style.confirmBtn}`}
            >
              {isLoading ? "Memproses..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}