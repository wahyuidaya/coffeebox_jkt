"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
}

interface ToastTypeStyle {
  border: string;
  iconColor: string;
  icon: ElementType;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Sama seperti ConfirmDialog: warna semantik disamakan dengan badge di admin.css
// supaya toast tidak terasa "asing" dari palet coffee-brown/gold utama.
const typeStyles: Record<ToastType, ToastTypeStyle> = {
  success: { border: "border-l-[#2E7D32]", iconColor: "text-[#2E7D32]", icon: CheckCircle2 },
  error: { border: "border-l-[#C62828]", iconColor: "text-[#C62828]", icon: XCircle },
  warning: { border: "border-l-[#E65100]", iconColor: "text-[#E65100]", icon: AlertTriangle },
  info: { border: "border-l-[#0D47A1]", iconColor: "text-[#0D47A1]", icon: Info },
};

// FIX: crypto.randomUUID() HANYA tersedia di "secure context" (HTTPS, atau
// origin "localhost"). Kalau situs diakses lewat HTTP biasa memakai alamat
// IP LAN (mis. dari HP saat testing di jaringan yang sama: http://192.168.x.x:3000),
// browser (terutama Safari/iOS) menganggapnya insecure context dan
// `crypto.randomUUID` jadi undefined — memanggilnya langsung melempar
// "TypeError: crypto.randomUUID is not a function" dan bikin seluruh
// komponen yang memanggilnya (di sini: showToast) crash total, bukan cuma
// gagal menampilkan toast.
//
// Fungsi ini generate ID unik yang cukup untuk keperluan key/identifier
// toast (BUKAN untuk keperluan kriptografis) tanpa bergantung ke Web
// Crypto API, sehingga tetap jalan di HTTP/insecure context maupun di
// browser lama yang belum mendukung crypto.randomUUID sama sekali.
function generateToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Beberapa browser mendefinisikan crypto.randomUUID tapi tetap
      // melempar error di insecure context — jatuhkan ke fallback di bawah.
    }
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    ({ type, title, detail }: Omit<ToastItem, "id">) => {
      const id = generateToastId();
      setToasts((prev) => [...prev, { id, type, title, detail }]);
      timers.current[id] = setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="pointer-events-none fixed top-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col gap-3">
        {toasts.map((t) => {
          const style = typeStyles[t.type];
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-80 items-start gap-3 rounded-xl border-l-4 bg-cbx-cb border-t border-r border-b border-cbx-bd p-4 shadow-xl animate-in slide-in-from-top-2 fade-in duration-200 font-dmsans ${style.border}`}
            >
              <Icon className={`mt-0.5 shrink-0 ${style.iconColor}`} size={22} />
              <div className="flex-1">
                <p className="text-sm font-bold text-cbx-br">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-xs text-cbx-tm">{t.detail}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-cbx-bd hover:text-cbx-tm transition"
                aria-label="Tutup notifikasi"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  return ctx;
}
