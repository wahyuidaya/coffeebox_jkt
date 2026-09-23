"use client";

import { useState, useCallback, useEffect } from "react";
import { CartItem, VarianTampil } from "@/types/pesanan";
import { MenuTampil } from "@/types/menu";

function loadInitialCart(storageKey?: string): CartItem[] {
  if (!storageKey || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInitialLineSeq(initialCart: CartItem[]): number {
  if (initialCart.length === 0) return 1;
  return Math.max(...initialCart.map((l) => l.lineId)) + 1;
}

// storageKey opsional: kalau diisi (mis. "cb_cart_A1"), cart akan otomatis
// disimpan & dipulihkan dari localStorage per nomor meja. Kalau tidak diisi,
// perilaku persis seperti sebelumnya (hanya di memori, hilang saat refresh).
export function useCart(storageKey?: string) {
  const [cart, setCart] = useState<CartItem[]>(() => loadInitialCart(storageKey));
  const [lineSeq, setLineSeq] = useState(() => loadInitialLineSeq(loadInitialCart(storageKey)));

  // Simpan otomatis ke localStorage setiap kali cart berubah.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // localStorage bisa gagal (mode private/incognito dsb), abaikan saja
    }
  }, [cart, storageKey]);

  const qtyOfMenu = useCallback(
    (idMenu: number) =>
      cart.filter((l) => l.idMenu === idMenu).reduce((s, l) => s + l.jumlah, 0),
    [cart]
  );

  const firstLineOfMenu = useCallback(
    (idMenu: number) => cart.find((l) => l.idMenu === idMenu) || null,
    [cart]
  );

  const totalCount = cart.reduce((s, l) => s + l.jumlah, 0);
  const totalPrice = cart.reduce((s, l) => s + l.harga * l.jumlah, 0);

  const addItem = useCallback(
    (menu: MenuTampil, varian: VarianTampil, catatanItem: string) => {
      setCart((prev) => {
        const existing = prev.find(
          (l) =>
            l.idMenu === menu.id &&
            l.varian === varian &&
            (l.catatanItem || "") === catatanItem
        );
        if (existing) {
          return prev.map((l) =>
            l.lineId === existing.lineId ? { ...l, jumlah: l.jumlah + 1 } : l
          );
        }
        const newLine: CartItem = {
          lineId: lineSeq,
          idMenu: menu.id,
          nama: menu.nama,
          harga: menu.harga,
          kategori: menu.kategori,
          jenis: menu.jenis,
          bundleItems: menu.bundleItems,
          varian,
          catatanItem,
          jumlah: 1,
        };
        setLineSeq((s) => s + 1);
        return [...prev, newLine];
      });
    },
    [lineSeq]
  );

  const updateLine = useCallback(
    (lineId: number, varian: VarianTampil, catatanItem: string) => {
      setCart((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, varian, catatanItem } : l))
      );
    },
    []
  );

  const changeLineQty = useCallback((lineId: number, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((l) => (l.lineId === lineId ? { ...l, jumlah: l.jumlah + delta } : l))
        .filter((l) => l.jumlah > 0);
      return updated;
    });
  }, []);

  const menuMinus = useCallback(
    (idMenu: number) => {
      const first = firstLineOfMenu(idMenu);
      if (!first) return;
      changeLineQty(first.lineId, -1);
    },
    [firstLineOfMenu, changeLineQty]
  );

  const resetCart = useCallback(() => {
    setCart([]);
    setLineSeq(1);
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // no-op
      }
    }
  }, [storageKey]);

  return {
    cart,
    qtyOfMenu,
    firstLineOfMenu,
    totalCount,
    totalPrice,
    addItem,
    updateLine,
    changeLineQty,
    menuMinus,
    resetCart,
  };
}