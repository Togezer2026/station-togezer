"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Infos = {
  agence: string;
  ville: string;
  prenom: string;
  nom: string;
  telephone: string;
};

export default function ModifierInfos({
  initial,
  email,
  joursLabel,
}: {
  initial: Infos;
  email: string;
  joursLabel: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Infos>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: keyof Infos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enregistrer() {
    if (!form.agence.trim() || !form.prenom.trim() || !form.nom.trim()) {
      setErreur("Agence, prénom et nom sont obligatoires.");
      return;
    }
    setBusy(true);
    setErreur(null);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("agents")
      .update({
        agence: form.agence.trim(),
        ville: form.ville.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
      })
      .eq("id", u.user?.id ?? "");
    setBusy(false);
    if (error) {
      setErreur("Enregistrement impossible. Réessayez.");
      return;
    }
    setEdit(false);
    setOk(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <div className="flex items-center justify-between">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Votre inscription
        </p>
        {!edit && (
          <button
            onClick={() => { setEdit(true); setOk(false); }}
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Modifier
          </button>
        )}
      </div>

      {!edit ? (
        <dl className="mt-3 space-y-2 font-corps text-sm">
          <Ligne k="Agence" v={form.agence} />
          <Ligne k="Ville" v={form.ville} />
          <Ligne k="Contact" v={`${form.prenom} ${form.nom}`} />
          <Ligne k="E-mail" v={email} />
          {form.telephone && <Ligne k="Téléphone" v={form.telephone} />}
          <Ligne k="Jours" v={joursLabel} />
          {ok && <p className="pt-1 font-corps text-xs text-green-700">Infos mises à jour ✓</p>}
        </dl>
      ) : (
        <div className="mt-4 space-y-3">
          <Champ label="Agence" value={form.agence} onChange={set("agence")} />
          <Champ label="Ville" value={form.ville} onChange={set("ville")} />
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Prénom" value={form.prenom} onChange={set("prenom")} />
            <Champ label="Nom" value={form.nom} onChange={set("nom")} />
          </div>
          <Champ label="Téléphone" value={form.telephone} onChange={set("telephone")} />
          <div>
            <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
              E-mail (identifiant de connexion)
            </span>
            <input
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-ligne bg-creme px-3 py-2 font-corps text-sm text-encreDoux"
            />
            <p className="mt-1 font-corps text-[11px] text-encreDoux">
              L'e-mail sert d'identifiant et ne peut pas être modifié ici.
            </p>
          </div>

          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => { setEdit(false); setForm(initial); setErreur(null); }}
              className="rounded-full border border-encre/20 px-5 py-2 font-corps text-sm text-encre"
            >
              Annuler
            </button>
            <button
              onClick={enregistrer}
              disabled={busy}
              className="rounded-full bg-brique px-5 py-2 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Ligne({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-encreDoux">{k}</dt>
      <dd className="text-right font-500 text-encre">{v || "—"}</dd>
    </div>
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
      <input
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
      />
    </label>
  );
}
