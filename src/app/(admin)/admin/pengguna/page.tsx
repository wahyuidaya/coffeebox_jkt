// page.tsx
import { getSession } from "@/lib/session";
import { getAllPenggunaForAdmin } from "@/services/penggunaService";
import PenggunaClient from "./PenggunaClient";

export default async function PenggunaPage() {
  const session = await getSession();
  const list = await getAllPenggunaForAdmin(session!);
  const cleaned = list.map(({ password, ...rest }) => rest);

  return (
    <PenggunaClient
      initialData={JSON.parse(JSON.stringify(cleaned))}
      currentUser={{
        id: session!.id,
        peran: session!.peran,
        levelAdmin: session!.levelAdmin ?? null,
      }}
    />
  );
}