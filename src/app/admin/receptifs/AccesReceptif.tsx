"use client";

import { useState } from "react";
import { creerAccesReceptif } from "./actions";

export default function AccesReceptif({
  exposantId,
  defaultEmail,
  hasAccess,
}: {
  exposantId: string;
  defaultEmail: string;
  hasAccess: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await creerAccesReceptif(exposantId, email, password);
    setBusy(false);
    if (res.error) setMsg({ ok: false, text: res.error });
    else setMsg({ ok: true, text: "Accès créé. Communiquez ces identifiants au réceptif." });
  }

  const champ = "w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm outline-none focus:border-brique";

  return (
    <div className="max-w-3xl rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <h2 className="font-titre text-lg font-600 text-encre">Compte d'accès réceptif</h2>
      <p className="mt-1 font-corps text-sm text-encreDoux">
        {hasAccess
          ? "Un accès est déjà lié à cette fiche. Vous pouvez en créer un nouveau (autre e-mail)."
          : "Créez l'accès de ce réceptif à son espace personnel."}
        {" "}En phase de test, utilisez un e-mail distinct par compte.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">E-mail de connexion</span>
          <input className={champ} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">Mot de passe (8+)</span>
          <input className={champ} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}
          className="rounded-full bg-brique px-6 py-2.5 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50">
          {busy ? "Création…" : "Créer l'accès"}
        </button>
      </form>
      {msg && (
        <p className={`mt-3 font-corps text-sm ${msg.ok ? "text-brique" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
