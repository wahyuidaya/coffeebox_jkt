import { getDashboardKasir } from "@/services/pesananService";
import { getSession } from "@/lib/session";
import { getSessionUserDetail } from "@/services/penggunaService";
import { DashboardNotice } from "@/components/DashboardNotice";
import DashboardKasirClient from "./DashboardKasirClient";

export default async function DashboardPage() {
  const session = await getSession();
  const userDetail = await getSessionUserDetail(session!.id);
  const dbk = await getDashboardKasir();
  const tanggal = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <section className="pg on">
      <div className="db-welcome">
        <div>
          <div className="stlbl" style={{ padding: 0, margin: 0 }}>Dashboard Utama</div>
          <div className="db-sub">Ini ringkasan aktivitas kasir hari ini</div>
        </div>
        <div className="db-date">{tanggal}</div>
      </div>

    <DashboardNotice
      wajibGantiPassword={userDetail?.wajibGantiPassword ?? false}
      peran={session!.peran}
      email={userDetail?.email ?? null}
    />

      {/* Data ini di-poll berkala (setiap 5 detik) + auto-refresh saat tab
          kembali fokus/terlihat, jadi dipindah ke Client Component
          supaya bisa update otomatis tanpa reload halaman. */}
      <DashboardKasirClient initialData={JSON.parse(JSON.stringify(dbk))} />
    </section>
  );
}