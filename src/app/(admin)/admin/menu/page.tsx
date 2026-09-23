// page.tsx
import { getAllMenuAdmin, getKategoriList } from "@/services/menuService";
import MenuClient from "./MenuClient";

export default async function MenuPage() {
  const [menu, kategori] = await Promise.all([getAllMenuAdmin(), getKategoriList()]);
  return <MenuClient initialMenu={JSON.parse(JSON.stringify(menu))} kategoriList={kategori} />;
}