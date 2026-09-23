// page.tsx
import { getTransaksi } from "@/services/transaksiService";
import TransaksiClient from "./TransaksiClient";

export default async function TransaksiPage() {
  const now = new Date();
  const data = await getTransaksi({ bulan: now.getMonth() + 1, tahun: now.getFullYear(), page: 1, perPage: 10 });
  return <TransaksiClient initialData={JSON.parse(JSON.stringify(data))} defaultBulan={now.getMonth() + 1} defaultTahun={now.getFullYear()} />;
}

