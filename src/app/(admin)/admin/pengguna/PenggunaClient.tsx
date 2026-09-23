"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { formatRupiahSingkat, formatBulanTahun } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface UserItem {
  id: number; namaLengkap: string; username: string; noTelepon: string | null;
  peran: "admin" | "kasir"; levelAdmin: number | null; email: string | null;
  wajibGantiPassword: boolean; statusAktif: boolean;
  createdAt: string;
  transaksiCount: number;
  totalPendapatan: number;
}

interface CurrentUser { id: number; peran: "admin" | "kasir"; levelAdmin: number | null; }

const POLL_INTERVAL_MS = 5000;

// sinkron dengan schema.prisma (model Pengguna)
const NAMA_MAX_LEN = 50;
const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 25;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const NO_TELEPON_MAX_LEN = 16;
const EMAIL_MAX_LEN = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateNoTelepon(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > NO_TELEPON_MAX_LEN) return `Nomor telepon maksimal ${NO_TELEPON_MAX_LEN} karakter.`;
  if (!trimmed.startsWith("08") && !trimmed.startsWith("+62")) return 'Nomor telepon harus diawali "08" atau "+62".';
  const digitPart = trimmed.replace("+", "");
  if (!/^[0-9]+$/.test(digitPart)) return "Nomor telepon hanya boleh berisi angka.";
  if (digitPart.length < 10 || digitPart.length > 13) return "Nomor telepon harus terdiri dari 10-13 digit.";
  return null;
}

function validateNamaUsername(nama: string, username: string): string | null {
  const namaTrim = nama.trim();
  if (!namaTrim) return "Nama lengkap wajib diisi.";
  if (namaTrim.length > NAMA_MAX_LEN) return `Nama lengkap maksimal ${NAMA_MAX_LEN} karakter.`;

  const usernameTrim = username.trim();
  if (!usernameTrim) return "Username wajib diisi.";
  if (usernameTrim.length < USERNAME_MIN_LEN) return `Username minimal ${USERNAME_MIN_LEN} karakter.`;
  if (usernameTrim.length > USERNAME_MAX_LEN) return `Username maksimal ${USERNAME_MAX_LEN} karakter.`;
  if (!USERNAME_PATTERN.test(usernameTrim)) return "Username hanya boleh berisi huruf, angka, titik, dan garis bawah, tanpa spasi.";
  return null;
}

function validateEmailField(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (trimmed.length > EMAIL_MAX_LEN) return `Email maksimal ${EMAIL_MAX_LEN} karakter.`;
  if (!EMAIL_PATTERN.test(trimmed)) return "Format email tidak valid.";
  return null;
}

export default function PenggunaClient({ initialData, currentUser }: { initialData: UserItem[]; currentUser: CurrentUser }) {
  const [users, setUsers] = useState(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const isSuperAdmin = currentUser.peran === "admin" && currentUser.levelAdmin === 1;
  const isLevel2Admin = currentUser.peran === "admin" && currentUser.levelAdmin === 2;

  function canEditUser(target: UserItem): boolean {
    if (target.peran !== "admin") return true;
    const targetIsSuperAdmin = target.levelAdmin === 1;
    if (targetIsSuperAdmin) return target.id === currentUser.id;
    if (isSuperAdmin) return true;
    if (isLevel2Admin) return currentUser.id === target.id;
    return false;
  }

  function canDeleteUser(target: UserItem): boolean {
    if (target.id === currentUser.id) return false;
    const targetIsSuperAdmin = target.peran === "admin" && target.levelAdmin === 1;
    if (targetIsSuperAdmin) return false;
    if (target.peran === "admin" && isLevel2Admin) return false;
    return true;
  }

  function canResetPassword(target: UserItem): boolean {
    if (target.id === currentUser.id) return false;
    const targetIsSuperAdmin = target.peran === "admin" && target.levelAdmin === 1;
    if (targetIsSuperAdmin) return false;
    if (target.peran === "admin" && !isSuperAdmin) return false;
    return true;
  }

  const [addOpen, setAddOpen] = useState(false);
  const [aNama, setANama] = useState(""); const [aPhone, setAPhone] = useState("");
  const [aUname, setAUname] = useState(""); const [aRole, setARole] = useState<"kasir" | "admin">("kasir");
  const [aLevel, setALevel] = useState("2");
  const [aErr, setAErr] = useState("");
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [eNama, setENama] = useState(""); const [ePhone, setEPhone] = useState("");
  const [eUname, setEUname] = useState(""); const [eRole, setERole] = useState<"kasir" | "admin">("kasir");
  const [eLevel, setELevel] = useState("2"); const [eEmail, setEEmail] = useState("");
  const [eErr, setEErr] = useState(""); const [resetResult, setResetResult] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const editTargetIsSuperAdmin = editTarget?.peran === "admin" && editTarget?.levelAdmin === 1;
  const isEditingSelf = editTarget?.id === currentUser.id;

  const editTargetIdRef = useRef<number | null>(null);
  useEffect(() => { editTargetIdRef.current = editTarget ? editTarget.id : null; }, [editTarget]);

  const refresh = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/admin/pengguna", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()).pengguna as UserItem[];
        setUsers(data);

        if (editTargetIdRef.current !== null) {
          const updated = data.find((u) => u.id === editTargetIdRef.current);
          if (updated) setEditTarget((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      }
    } catch {
      // silent fail — polling background
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    function onFocus() { refresh(); }
    function onVisibility() { if (document.visibilityState === "visible") refresh(); }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  function openAdd() {
    setANama(""); setAPhone(""); setAUname(""); setARole("kasir"); setALevel("2"); setAErr("");
    setAddOpen(true);
  }

  async function saveAdd() {
    const namaUnameErr = validateNamaUsername(aNama, aUname);
    if (namaUnameErr) { setAErr(namaUnameErr); return; }
    const phoneErr = validateNoTelepon(aPhone);
    if (phoneErr) { setAErr(phoneErr); return; }

    setAErr("");
    setIsSavingAdd(true);
    try {
      const res = await fetch("/api/admin/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaLengkap: aNama.trim(), noTelepon: aPhone.trim(), username: aUname.trim(),
          peran: aRole, levelAdmin: aRole === "admin" ? Number(aLevel) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAErr(data?.message || "Gagal menambahkan pengguna. Silakan coba lagi.");
        return;
      }
      setAddOpen(false);
      await refresh();
      showToast({
        type: "success",
        title: "Pengguna ditambahkan",
        detail: aRole === "admin"
          ? "Password default: admin123. Minta admin tersebut melengkapi email melalui menu Edit untuk mengaktifkan fitur Lupa Password."
          : "Password default: kasir123. Pengguna wajib menggantinya saat pertama kali login.",
      });
    } catch {
      setAErr("Gagal terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setIsSavingAdd(false);
    }
  }

  function openEdit(u: UserItem) {
    if (!canEditUser(u)) {
      showToast({ type: "error", title: "Tidak memiliki akses", detail: "Anda tidak memiliki akses untuk mengedit akun ini." });
      return;
    }
    setEditTarget(u); setENama(u.namaLengkap); setEPhone(u.noTelepon || ""); setEUname(u.username);
    setERole(u.peran); setELevel(String(u.levelAdmin || 2)); setEEmail(u.email || ""); setEErr(""); setResetResult("");
  }

  async function saveEdit() {
    if (!editTarget) return;

    const namaUnameErr = validateNamaUsername(eNama, eUname);
    if (namaUnameErr) { setEErr(namaUnameErr); return; }
    const phoneErr = validateNoTelepon(ePhone);
    if (phoneErr) { setEErr(phoneErr); return; }
    if (eRole === "admin" && isEditingSelf) {
      const emailErr = validateEmailField(eEmail);
      if (emailErr) { setEErr(emailErr); return; }
    }

    setEErr("");
    setIsSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        namaLengkap: eNama.trim(),
        noTelepon: ePhone.trim(),
        username: eUname.trim(),
        peran: eRole,
        levelAdmin: eRole === "admin" ? Number(eLevel) : null,
      };
      if (eRole === "admin" && isEditingSelf) body.email = eEmail.trim();

      const res = await fetch(`/api/admin/pengguna/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEErr(data?.message || "Gagal memperbarui pengguna. Silakan coba lagi.");
        return;
      }

      const data = await res.json();
      const namaTerbaru = eNama.trim();
      setEditTarget(null);
      await refresh();

      if (data.pengguna?.passwordDefaultBaru) {
        showToast({
          type: "warning",
          title: "Pengguna diperbarui",
          detail: `Karena peran diubah, password otomatis direset menjadi ${data.pengguna.passwordDefaultBaru}. Pengguna wajib menggantinya saat login berikutnya.`,
        });
      } else {
        showToast({ type: "success", title: "Pengguna diperbarui", detail: `Data akun "${namaTerbaru}" berhasil disimpan.` });
      }
    } catch {
      setEErr("Gagal terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function requestResetPass() {
    if (!editTarget) return;
    if (!canResetPassword(editTarget)) {
      showToast({
        type: "error",
        title: "Tidak memiliki akses",
        detail: editTarget.id === currentUser.id
          ? "Anda tidak dapat mereset password akun sendiri. Gunakan fitur Ubah Password."
          : "Anda tidak memiliki akses untuk mereset password akun ini.",
      });
      return;
    }
    setResetConfirmOpen(true);
  }

  async function confirmResetPass() {
    if (!editTarget) return;
    setIsResetting(true);
    try {
      const res = await fetch(`/api/admin/pengguna/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResetResult(`Password direset menjadi ${data.defaultPassword}. Pengguna wajib menggantinya saat login berikutnya.`);
        setEditTarget((prev) => (prev ? { ...prev, wajibGantiPassword: true } : prev));
        showToast({ type: "success", title: "Password direset", detail: "Sampaikan password baru ini ke pengguna secara aman." });
      } else {
        const err = await res.json().catch(() => null);
        showToast({ type: "error", title: "Gagal mereset password", detail: err?.message || "Silakan coba lagi." });
      }
    } catch {
      showToast({ type: "error", title: "Gagal mereset password", detail: "Periksa koneksi internet Anda." });
    } finally {
      setIsResetting(false);
      setResetConfirmOpen(false);
    }
  }

  function requestHapus(id: number) {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (!canDeleteUser(target)) {
      showToast({ type: "error", title: "Tidak memiliki akses", detail: "Anda tidak memiliki akses untuk menghapus akun ini." });
      return;
    }
    setDeleteTarget(target);
  }

  async function confirmHapus() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pengguna/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast({ type: "error", title: "Gagal menghapus pengguna", detail: err?.message || "Silakan coba lagi." });
        return;
      }
      await refresh();
      showToast({ type: "success", title: "Pengguna dihapus", detail: `Akun "${deleteTarget.namaLengkap}" telah dihapus dari sistem.` });
      setDeleteTarget(null);
    } catch {
      showToast({ type: "error", title: "Gagal menghapus pengguna", detail: "Periksa koneksi internet Anda." });
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("edit") === "me") {
      const self = users.find((u) => u.id === currentUser.id);
      if (self) openEdit(self);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pg on">
      <div className="pghead">
        <div className="pghead-titlewrap">
          <div className="pgtitle">Kelola Pengguna</div>
          <div className="pgsub">
            {isSuperAdmin ? "Kelola seluruh akun Admin (Level 2) dan Kasir" : "Kelola akun Kasir dan akun Anda sendiri"}
          </div>
        </div>
        <div className="pghead-acts">
          <span className="sync-indicator">{isSyncing ? "Menyinkronkan..." : ""}</span>
          <button className="btn btn-pri" onClick={openAdd}>+ Tambah Pengguna</button>
        </div>
      </div>

      <div className="kgrid">
        {users.map((u) => {
          const editable = canEditUser(u);
          const deletable = canDeleteUser(u);
          const isTargetSuperAdmin = u.peran === "admin" && u.levelAdmin === 1;
          return (
            <div className="kcard" key={u.id}>
              <div className="b-stack">
                <span className={`badge ${u.peran === "admin" ? "b-admin" : "b-kasir"}`}>
                  {u.peran === "admin" ? "Admin" : "Kasir"}{u.peran === "admin" ? ` L${u.levelAdmin ?? 2}` : ""}
                </span>
                {u.wajibGantiPassword && <span className="badge b-warn">⚠ Wajib ganti password</span>}
                {u.peran === "admin" && !u.email && <span className="badge b-danger">✉️ Email belum diisi</span>}
              </div>
              <div className="kname">{u.namaLengkap}</div>
              <div className="krole">@{u.username}</div>
              {u.noTelepon && <div className="kcontact">📞 {u.noTelepon}</div>}
              {u.email && <div className="kcontact">✉️ {u.email}</div>}

              {u.peran === "admin" ? (
                <div className="kdesc">
                  {isTargetSuperAdmin ? "Akses penuh ke seluruh fitur (Super Admin)" : "Akses penuh fitur, kecuali data dan akun Super Admin"}
                </div>
              ) : (
                <div className="kstats">
                  <div className="kstat">
                    <div className="kstatv">{u.transaksiCount}</div>
                    <div className="kstatl">Transaksi</div>
                  </div>
                  <div className="kstat">
                    <div className="kstatv">{formatRupiahSingkat(u.totalPendapatan, false)}</div>
                    <div className="kstatl">Pendapatan</div>
                  </div>
                </div>
              )}

              <div className="kjoined">Sejak {formatBulanTahun(u.createdAt)}</div>

              <div className="btn-row">
                {editable ? (
                  <button className="btn btn-edit btn-flex1" onClick={() => openEdit(u)}>✏️ Edit</button>
                ) : (
                  <button className="btn btn-edit btn-flex1 btn-disabled-look" disabled title="Anda tidak memiliki akses untuk mengedit akun ini">
                    ✏️ Edit
                  </button>
                )}
                {deletable && <button className="btn btn-del" title="Hapus Pengguna" onClick={() => requestHapus(u.id)}>🗑️</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL TAMBAH */}
      <div className={`mo${addOpen ? " open" : ""}`}>
        <div className="mbox">
          <button className="mclose" onClick={() => !isSavingAdd && setAddOpen(false)} disabled={isSavingAdd}>✕</button>
          <div className="mttl">Tambah Pengguna Baru</div>
          <div className="form-g">
            <label className="form-lbl">Nama Lengkap</label>
            <input className="form-inp" autoComplete="off" value={aNama} onChange={(e) => setANama(e.target.value)} maxLength={NAMA_MAX_LEN} disabled={isSavingAdd} />
          </div>
          <div className="form-g">
            <label className="form-lbl">Nomor Telepon</label>
            <input className="form-inp" autoComplete="off" value={aPhone} onChange={(e) => setAPhone(e.target.value)} maxLength={NO_TELEPON_MAX_LEN} disabled={isSavingAdd} placeholder="08xxxxxxxxxx atau +62xxxxxxxxxx" />
          </div>
          <div className="form-row">
            <div className="form-g">
              <label className="form-lbl">Username</label>
              <input className="form-inp" autoComplete="off" value={aUname} onChange={(e) => setAUname(e.target.value)} maxLength={USERNAME_MAX_LEN} disabled={isSavingAdd} />
            </div>
            <div className="form-g">
              <label className="form-lbl">Peran</label>
              <select className="form-inp form-sel" value={aRole} onChange={(e) => setARole(e.target.value as "kasir" | "admin")} disabled={!isSuperAdmin || isSavingAdd}>
                <option value="kasir">Kasir</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
          </div>
          {aRole === "admin" && (
            <div className="form-g">
              <label className="form-lbl">Level Admin</label>
              <select className="form-inp form-sel" value={aLevel} onChange={(e) => setALevel(e.target.value)} disabled={isSavingAdd}>
                <option value="2">Level 2</option>
              </select>
              <div className="form-hint">Email tidak perlu diisi di sini. Akun Admin dapat melengkapi emailnya sendiri melalui menu Edit untuk mengaktifkan fitur Lupa Password.</div>
            </div>
          )}
          <div className="form-g info-box info-cream">
            <span className="info-box-text">🔑 Password otomatis diatur menjadi <b>{aRole === "kasir" ? "kasir123" : "admin123"}</b>. Pengguna wajib menggantinya saat pertama kali login.</span>
          </div>
          {aErr && <div className="login-err">{aErr}</div>}
          <div className="mbtns">
            <button className="mbtn mbtn-pri" onClick={saveAdd} disabled={isSavingAdd}>
              {isSavingAdd ? "Menyimpan..." : "Tambah Pengguna"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setAddOpen(false)} disabled={isSavingAdd}>Batal</button>
          </div>
        </div>
      </div>

      {/* MODAL EDIT */}
      <div className={`mo${editTarget ? " open" : ""}`}>
        <div className="mbox">
          <button className="mclose" onClick={() => !isSavingEdit && setEditTarget(null)} disabled={isSavingEdit}>✕</button>
          <div className="mttl">Edit Pengguna</div>

          <div className="modal-profile-card">
            <div>
              <div className="modal-profile-name">{editTarget?.namaLengkap}</div>
              <div className="modal-profile-sub">Bergabung sejak {editTarget ? formatBulanTahun(editTarget.createdAt) : "—"}</div>
              <div className="modal-profile-chips">
                {editTarget?.wajibGantiPassword ? (
                  <span className="badge b-warn">⚠ Wajib ganti password</span>
                ) : (
                  <span className="badge b-on">✅ Password sudah diganti</span>
                )}
                {editTarget?.peran === "admin" && !editTarget?.email && (
                  <span className="badge b-danger">✉️ Email belum diisi</span>
                )}
              </div>
            </div>
          </div>

          <div className="form-g">
            <label className="form-lbl">Nama Lengkap</label>
            <input className="form-inp" autoComplete="off" value={eNama} onChange={(e) => setENama(e.target.value)} maxLength={NAMA_MAX_LEN} disabled={isSavingEdit} />
          </div>
          <div className="form-g">
            <label className="form-lbl">Nomor Telepon</label>
            <input className="form-inp" autoComplete="off" value={ePhone} onChange={(e) => setEPhone(e.target.value)} maxLength={NO_TELEPON_MAX_LEN} disabled={isSavingEdit} placeholder="08xxxxxxxxxx atau +62xxxxxxxxxx" />
          </div>
          <div className="form-row">
            <div className="form-g">
              <label className="form-lbl">Username</label>
              <input className="form-inp" autoComplete="off" value={eUname} onChange={(e) => setEUname(e.target.value)} maxLength={USERNAME_MAX_LEN} disabled={isSavingEdit} />
            </div>
            <div className="form-g">
              <label className="form-lbl">Peran</label>
              <select
                className="form-inp form-sel"
                value={eRole}
                onChange={(e) => setERole(e.target.value as "kasir" | "admin")}
                disabled={!isSuperAdmin || editTargetIsSuperAdmin || isSavingEdit}
              >
                <option value="kasir">Kasir</option>
                {(isSuperAdmin || eRole === "admin") && <option value="admin">Admin</option>}
              </select>
            </div>
          </div>
          {eRole === "admin" && (
            <>
              <div className="form-g">
                <label className="form-lbl">Level Admin</label>
                <select
                  className="form-inp form-sel"
                  value={eLevel}
                  onChange={(e) => setELevel(e.target.value)}
                  disabled={!isSuperAdmin || editTargetIsSuperAdmin || isSavingEdit}
                >
                  {editTargetIsSuperAdmin && <option value="1">Level 1 (Super Admin)</option>}
                  <option value="2">Level 2</option>
                </select>
              </div>

              {isEditingSelf && (
                <div className="form-g">
                  <label className="form-lbl">Email Admin</label>
                  <input className="form-inp" type="email" autoComplete="off" value={eEmail} onChange={(e) => setEEmail(e.target.value)} maxLength={EMAIL_MAX_LEN} disabled={isSavingEdit} />
                  <div className="form-hint">Opsional, dapat diisi kemudian. Digunakan untuk verifikasi saat menggunakan fitur Lupa Password.</div>
                </div>
              )}
            </>
          )}

          {editTarget && canResetPassword(editTarget) && (
            <div className="reset-pass-box">
              <div className="reset-pass-title">Reset Password</div>
              <div className="reset-pass-desc">
                Password akan direset menjadi password default ({editTarget?.peran === "kasir" ? "kasir123" : "admin123"}) dan pengguna wajib menggantinya saat login berikutnya.
              </div>
                <button className="mbtn mbtn-warn mbtn-full" onClick={requestResetPass} disabled={isSavingEdit}>🔑 Reset Password</button>            </div>
          )}

          {eErr && <div className="login-err">{eErr}</div>}
          <div className="mbtns">
            <button className="mbtn mbtn-pri" onClick={saveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Menyimpan..." : "💾 Simpan Perubahan"}
            </button>
            <button className="mbtn mbtn-sec" onClick={() => setEditTarget(null)} disabled={isSavingEdit}>Batal</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title="Hapus pengguna ini?"
        description={deleteTarget ? `Akun "${deleteTarget.namaLengkap}" (@${deleteTarget.username}) akan dihapus permanen dan tidak bisa dikembalikan.` : ""}
        confirmLabel="Ya, Hapus"
        isLoading={isDeleting}
        onConfirm={confirmHapus}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        variant="warning"
        title="Reset password pengguna ini?"
        description={
          editTarget
            ? `Password akun "${editTarget.namaLengkap}" akan direset menjadi password default (${editTarget.peran === "kasir" ? "kasir123" : "admin123"}) dan pengguna wajib menggantinya saat login berikutnya.`
            : ""
        }
        confirmLabel="Ya, Reset"
        isLoading={isResetting}
        onConfirm={confirmResetPass}
        onCancel={() => !isResetting && setResetConfirmOpen(false)}
      />
    </div>
  );
}