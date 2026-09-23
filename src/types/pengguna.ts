export type Peran = "admin" | "kasir";

export interface Pengguna {
  id: number;
  namaLengkap: string;
  username: string;
  noTelepon: string | null;
  email: string | null;
  peran: Peran;
  levelAdmin: number | null;
  wajibGantiPassword: boolean;
  statusAktif: boolean;
}

export interface SessionUser {
  id: number;
  username: string;
  namaLengkap: string;
  peran: Peran;
  levelAdmin: number | null;
}