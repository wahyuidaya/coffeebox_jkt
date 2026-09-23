import { getSession } from "@/lib/session";
import KasirShell from "@/components/kasir/KasirShell";

export default async function KasirAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.peran !== "kasir") {
    return <>{children}</>;
  }

  return <KasirShell namaKasir={session.namaLengkap}>{children}</KasirShell>;
}