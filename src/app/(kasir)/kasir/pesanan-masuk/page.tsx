// page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getPesananAktif, getPesananDibatalkanBaru } from "@/services/pesananService";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const session = await requireAuth(["kasir"]);
  if (!session) redirect("/kasir/login"); // sesuaikan path login kamu

  const [aktif, dibatalkan] = await Promise.all([getPesananAktif(), getPesananDibatalkanBaru()]);
  const pesanan = [...aktif, ...dibatalkan];

  return (
    <OrdersClient
      initialPesanan={JSON.parse(JSON.stringify(pesanan))}
      currentKasirId={session.id}
    />
  );
}