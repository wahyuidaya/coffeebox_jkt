"use client";

import { useEffect, useState } from "react";

function formatJamMenit(d: Date) {
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${jam}:${menit}`;
}

export default function Topbar({
  namaKasir,
  onMenuClick,
}: {
  namaKasir: string;
  onMenuClick?: () => void;
}) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(formatJamMenit(new Date()));
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Buka menu"
          onClick={onMenuClick}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--gold)", letterSpacing: 0.5 }}>
            Coffeebox_Jkt
          </div>
          <div style={{ fontSize: 9, color: "var(--gl)", opacity: 0.5, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>
            Dashboard Kasir
          </div>
        </div>
      </div>
      <div className="tr">
        <span className="tu">
          Halo, <strong>{namaKasir}</strong>
        </span>
        <span className="tbdg">Kasir</span>
        <span className="tclk">{clock}</span>
      </div>
    </header>
  );
}
