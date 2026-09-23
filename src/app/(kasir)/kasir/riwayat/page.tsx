// page.tsx
import { getRiwayatTransaksi } from "@/services/pesananService";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const data = await getRiwayatTransaksi({ filter: "today" });
  return <HistoryClient initialData={JSON.parse(JSON.stringify(data))} />;
}