export default function GuidePage() {
  return (
    <section className="pg on">
      <div style={{ marginBottom: 18 }}>
        <div className="stlbl" style={{ padding: 0, margin: 0 }}>Panduan Alur Kasir</div>
        <div className="db-sub">Panduan lengkap alur kerja dan verifikasi pembayaran untuk kasir</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "var(--cb)", border: "1px solid var(--bd)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--br)", marginBottom: 12 }}>🔄 Alur Status Pesanan</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { bg: "var(--sn)", bd: "var(--snb)", c: "var(--snt)", ic: "🔔", t: "1. MENUNGGU KONFIRMASI", d: `Periksa pesanan terlebih dahulu — verifikasi bukti transfer QRIS atau terima pembayaran Cash dari pelanggan, lalu klik "Konfirmasi Bayar".` },
              { bg: "var(--sd)", bd: "var(--sdb)", c: "var(--sdt)", ic: "🧾", t: "2. DIPROSES", d: `Pembayaran sudah dikonfirmasi kasir. Klik "Kirim ke Dapur" agar pesanan mulai dibuat oleh barista.` },
              { bg: "var(--sp)", bd: "var(--spb)", c: "var(--spt)", ic: "☕", t: "3. SEDANG DISIAPKAN", d: `Barista sedang membuat pesanan. Tunggu hingga selesai dibuat, lalu klik "Antar ke Meja".` },
              { bg: "var(--sv)", bd: "var(--svb)", c: "var(--svt)", ic: "🚶", t: "4. SEDANG DIANTAR KE MEJA", d: `Pesanan sedang diantar pelayan ke meja pelanggan. Setelah sampai, klik "Tandai Selesai".` },
              { bg: "var(--sk)", bd: "var(--skb)", c: "var(--skt)", ic: "🎉", t: "5. SELESAI", d: `Pesanan sudah sampai ke pelanggan dan transaksi tuntas. Klik "Struk" untuk melihat detail, lalu klik "Cetak" untuk mencetaknya.` },
            ].map((s, i, arr) => (
              <div key={s.t}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 9, background: s.bg, borderRadius: 9, border: `1px solid ${s.bd}` }}>
                  <span>{s.ic}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: s.c }}>{s.t}</div>
                    <div style={{ fontSize: 10, color: s.c, opacity: 0.8 }}>{s.d}</div>
                  </div>
                </div>
                {i < arr.length - 1 && <div style={{ textAlign: "center", color: "var(--tm)" }}>↓</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--cb)", border: "1px solid var(--bd)", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--br)", marginBottom: 10 }}>💳 Verifikasi Pembayaran</div>
            <div style={{ fontSize: 12, color: "var(--tm)", lineHeight: 1.8 }}>
              <strong style={{ color: "var(--br)" }}>QRIS:</strong> Pelanggan mengunggah bukti transfer. Klik &quot;Lihat Bukti&quot; pada pesanan berstatus Menunggu Konfirmasi. Pastikan nominal dan nama sudah sesuai, lalu klik &quot;Konfirmasi Bayar&quot;.
              <br /><br />
              <strong style={{ color: "var(--br)" }}>Cash:</strong> Terima uang Cash langsung dari pelanggan yang datang ke kasir dengan menyebutkan nomor pesanan. Klik &quot;Konfirmasi Bayar&quot; setelah uang diterima.
            </div>
          </div>
          <div style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#5D4037", marginBottom: 7 }}>⚠️ Penting</div>
            <ul style={{ fontSize: 11, color: "#6D4C41", lineHeight: 1.9, paddingLeft: 14 }}>
              <li>Untuk pembayaran QRIS, wajib periksa bukti transfer sebelum mengklik &quot;Konfirmasi Bayar&quot;.</li>
              <li>Jangan lewati tahap apa pun — perbarui status secara berurutan agar informasi yang diterima pelanggan tetap akurat.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}