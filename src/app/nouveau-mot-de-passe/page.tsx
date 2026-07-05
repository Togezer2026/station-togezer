"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NouveauMotDePasse() {
  const supabase = createClient();
  const [pret, setPret] = useState(false);
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Le lien de récupération établit une session ; on attend qu'elle soit là.
    supabase.auth.getSession().then(({ data }) => setPret(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPret(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (password.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErreur("Lien expiré ou invalide. Demandez-en un nouveau.");
      return;
    }
    setOk(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-titre text-4xl font-600 text-encre">Nouveau mot de passe</h1>
      {ok ? (
        <div className="mt-4">
          <p className="font-corps text-encreDoux">
            ✓ Mot de passe mis à jour. Vous pouvez vous connecter.
          </p>
          <Link href="/connexion" className="mt-4 inline-block font-corps text-brique underline">
            Se connecter
          </Link>
        </div>
      ) : !pret ? (
        <p className="mt-4 font-corps text-encreDoux">
          Ouvrez cette page depuis le lien de réinitialisation reçu. Si vous y êtes
          déjà, patientez une seconde…
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">
              Choisissez un mot de passe (8 caractères min.)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps outline-none focus:border-brique"
            />
          </label>
          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brique px-6 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
    </main>
  );
}
