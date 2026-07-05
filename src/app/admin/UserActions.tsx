"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { genererLienReset, supprimerUtilisateur } from "./actions-users";

export default function UserActions({
  userId,
  email,
  label,
}: {
  userId: string;
  email: string;
  label: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setErr(null);
    setLink(null);
    const r = await genererLienReset(email);
    setBusy(false);
    if (r.link) setLink(r.link);
    else setErr(r.error ?? "Erreur");
  }

  async function del() {
    if (!confirm(`Supprimer définitivement « ${label} » (${email}) et toutes ses données ? Action irréversible.`))
      return;
    setBusy(true);
    setErr(null);
    const r = await supprimerUtilisateur(userId);
    setBusy(false);
    if (r.ok) router.refresh();
    else setErr(r.error ?? "Erreur");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button onClick={reset} disabled={busy}
          className="rounded-full border border-encre/20 px-3 py-1 font-corps text-xs text-encre hover:bg-creme disabled:opacity-50">
          Lien MDP
        </button>
        <button onClick={del} disabled={busy}
          className="rounded-full border border-red-300 px-3 py-1 font-corps text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
          Supprimer
        </button>
      </div>
      {err && <span className="font-corps text-xs text-red-600">{err}</span>}
      {link && (
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
          title="Copiez ce lien et transmettez-le à la personne"
          className="mt-1 w-72 rounded border border-ligne bg-white px-2 py-1 font-corps text-[11px] text-encreDoux" />
      )}
    </div>
  );
}
