"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierAgent } from "../actions-users";

type Infos = { agence: string; ville: string; prenom: string; nom: string; telephone: string };

export default function EditAgent({
  userId,
  email,
  initial,
}: {
  userId: string;
  email: string;
  initial: Infos;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Infos>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof Infos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    const res = await modifierAgent(userId, form);
    setBusy(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => { setForm(initial); setErreur(null); setOpen(true); }}
        className="rounded-full border border-encre/20 px-3 py-1 font-corps text-xs text-encre transition hover:border-brique hover:text-brique"
      >
        Éditer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-carte p-6 shadow-carte"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-titre text-xl font-600 text-encre">Modifier l'agent</h3>
            <p className="mt-1 font-corps text-xs text-encreDoux">
              {email} (identifiant de connexion — non modifiable)
            </p>
            <div className="mt-4 space-y-3">
              <Champ label="Agence" value={form.agence} onChange={set("agence")} />
              <Champ label="Ville" value={form.ville} onChange={set("ville")} />
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Prénom" value={form.prenom} onChange={set("prenom")} />
                <Champ label="Nom" value={form.nom} onChange={set("nom")} />
              </div>
              <Champ label="Téléphone" value={form.telephone} onChange={set("telephone")} />
            </div>
            {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setOpen(false)}
                className="rounded-full border border-encre/20 px-5 py-2 font-corps text-sm text-encre">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={busy}
                className="rounded-full bg-brique px-5 py-2 font-corps font-600 text-creme disabled:opacity-50">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Champ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
        {label}
      </span>
      <input value={value} onChange={onChange}
        className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm" />
    </label>
  );
}
