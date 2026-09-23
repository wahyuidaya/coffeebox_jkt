// page.tsx
import { getAllMejaAdmin, generateQrDataUrl } from "@/services/mejaService";
import MejaClient from "./MejaClient";

export default async function MejaPage() {
  const mejaList = await getAllMejaAdmin();
  const withQr = await Promise.all(mejaList.map(async (m) => ({ ...m, qr: await generateQrDataUrl(m.nomorMeja) })));
  return <MejaClient initialMeja={JSON.parse(JSON.stringify(withQr))} />;
}