import { getSession } from "@/lib/session";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Halaman publik (login, forgot-password, reset-password) sudah
  // dijaga oleh middleware — di sini cukup render children polos
  // kalau belum ada session admin yang valid.
  if (!session || session.peran !== "admin") {
    return <>{children}</>;
  }

  return <AdminShell session={session}>{children}</AdminShell>;
}