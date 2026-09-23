import { getDashboardAdmin } from "@/services/transaksiService";
import { getSession } from "@/lib/session";
import { getSessionUserDetail } from "@/services/penggunaService";
import { DashboardNotice } from "@/components/DashboardNotice";
import DashboardClient from "./DashboardClient";

export default async function AdminDashboardPage() {
  const session = await getSession();
  const userDetail = await getSessionUserDetail(session!.id);
  const d = await getDashboardAdmin();

  return (
    <div className="pg on">
      <div className="pgtitle">Dashboard Utama</div>
      <div className="pgsub">Ringkasan performa operasional Coffeebox_Jkt hari ini</div>

      <DashboardNotice
        wajibGantiPassword={userDetail?.wajibGantiPassword ?? false}
        peran={session!.peran}
        email={userDetail?.email ?? null}
      />

      <DashboardClient initialData={d} />
    </div>
  );
}