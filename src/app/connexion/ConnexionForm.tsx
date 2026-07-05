"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";
import { FiletGare } from "@/components/Ornaments";

export default function ConnexionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    const supabase = createClient();
    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !signIn.user) {
      setLoading(false);
      setErreur("E-mail ou mot de passe incorrect.");
      return;
    }
    // On oriente selon le rôle (filtré sur l'utilisateur : un admin voit
    // tous les profils, il faut donc cibler explicitement le sien).
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signIn.user.id)
      .single();
    const dest =
      prof?.role === "admin"
        ? "/admin"
        : prof?.role === "receptif"
          ? "/espace-receptif"
          : "/mon-espace";
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" aria-label="Retour à l'accueil" className="mx-auto">
        <Wordmark className="h-auto w-[210px] transition hover:opacity-80" />
      </Link>

      <div className="mt-8 rounded-xl border-2 border-double border-brique/40 bg-carte p-8 shadow-carte">
        <h1 className="text-center font-titre text-4xl font-600 text-encre">
          Bon retour à bord&nbsp;!
        </h1>
        <p className="mt-2 text-center font-corps text-encreDoux">
          Connectez-vous pour retrouver vos rendez-vous.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2.5 font-corps outline-none focus:border-brique"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2.5 font-corps outline-none focus:border-brique"
            />
          </label>
          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brique px-6 py-3 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>

      <div className="my-2">
        <FiletGare />
      </div>

      <p className="mt-3 text-center font-corps text-sm text-encreDoux">
        Pas encore de compte&nbsp;?{" "}
        <Link href="/inscription" className="font-600 text-brique underline underline-offset-2">
          Je m'inscris en tant qu'agent de voyages
        </Link>
        <span className="mx-2 text-ligne">·</span>
        <Link href="/" className="underline underline-offset-2 hover:text-encre">
          Retour à l'accueil
        </Link>
      </p>
    </main>
  );
}
