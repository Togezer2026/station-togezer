"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage() {
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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      setErreur("E-mail ou mot de passe incorrect.");
      return;
    }
    // On oriente selon le rôle
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Accueil
      </Link>
      <h1 className="mt-4 font-titre text-4xl font-600 text-encre">Connexion</h1>
      <p className="mt-2 font-corps text-encreDoux">Accédez à votre espace.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block font-corps text-sm font-500 text-encre/70">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps outline-none focus:border-brique"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-corps text-sm font-500 text-encre/70">Mot de passe</span>
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
          disabled={loading}
          className="w-full rounded-full bg-brique px-6 py-3 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
