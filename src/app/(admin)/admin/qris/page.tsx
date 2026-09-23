import { getQris } from "@/services/qrisServices";
import QrisClient from "./QrisClient";

export default async function QrisPage() {
  const qris = await getQris();
  return (
    <QrisClient
      initialGambarQris={qris?.gambarQris ?? null}
      updatedAt={qris?.updatedAt ? qris.updatedAt.toISOString() : null}
    />
  );
}