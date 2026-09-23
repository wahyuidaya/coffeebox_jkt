import { getAnalisis } from "@/services/transaksiService";
import AnalisisClient from "./AnalisisClient";

export default async function AnalisisPage() {
  const tahun = new Date().getFullYear();
  const d = await getAnalisis(tahun);

  return (
    <div className="pg on">
      <div>
        <div className="pgtitle">Analisis & Grafik</div>
        <div className="pgsub">
          Grafik pendapatan, jam tersibuk, dan performa kasir.
        </div>
      </div>

      <AnalisisClient initialData={d} tahun={tahun} />
    </div>
  );
}