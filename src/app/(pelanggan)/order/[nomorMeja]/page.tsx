import { notFound } from "next/navigation";
import { getMejaAktifByNomor } from "@/services/mejaService";
import { getMenuUntukPelanggan } from "@/services/menuService";
import { getQris } from "@/services/qrisServices";
import OrderClient from "./OrderClient";

interface PageProps {
  params: { nomorMeja: string };
}

export default async function OrderPage({ params }: PageProps) {
  const meja = await getMejaAktifByNomor(params.nomorMeja);
  if (!meja) notFound();

  const [menus, qris] = await Promise.all([
    getMenuUntukPelanggan(),
    getQris(),
  ]);

  return (
    <OrderClient
      nomorMeja={meja.nomorMeja}
      menus={menus}
      qrisToko={qris?.gambarQris || null}
    />
  );
}