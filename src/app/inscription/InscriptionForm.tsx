"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function InscriptionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    agence: "",
    ville: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    password: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (form.password.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/mon-espace`,
        data: {
          agence: form.agence.trim(),
          ville: form.ville.trim(),
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          telephone: form.telephone.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      setErreur(messageErreurFr(error.message));
      return;
    }
    if (data.session) {
      router.push("/mon-espace");
      router.refresh();
    } else {
      setMessage(
        `Un e-mail de confirmation vient d'être envoyé à ${form.email.trim()}. Cliquez sur le lien qu'il contient pour valider votre compte et accéder à vos réservations.`,
      );
    }
  }

  if (message) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-titre text-2xl text-encre">Vérifiez votre boîte mail</h1>
        <p className="mt-3 text-encre/70">{message}</p>
        <Link href="/" className="mt-6 text-brique underline">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-encre/50 hover:text-encre">
        ← Accueil
      </Link>
      <h1 className="mt-3 font-titre text-3xl text-encre">Inscription</h1>
      <p className="mt-2 text-encre/70">
        Créez votre accès en une minute — c'est gratuit. Vous choisirez vos jours
        et vos rendez-vous juste après.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Champ name="agence" label="Nom de l'agence" value={form.agence} onChange={set("agence")} required />
        <Champ name="ville" label="Ville de l'agence" value={form.ville} onChange={set("ville")} required />
        <div className="grid grid-cols-2 gap-4">
          <Champ name="prenom" label="Prénom" value={form.prenom} onChange={set("prenom")} required />
          <Champ name="nom" label="Nom" value={form.nom} onChange={set("nom")} required />
        </div>
        <Champ name="email" label="E-mail professionnel" type="email" value={form.email} onChange={set("email")} required />
        <Champ name="telephone" label="Téléphone (facultatif)" value={form.telephone} onChange={set("telephone")} />
        <Champ
          name="password"
          label="Mot de passe (8 caractères min.)"
          type="password"
          value={form.password}
          onChange={set("password")}
          required
        />

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-encre px-6 py-3 font-medium text-creme transition hover:brightness-125 disabled:opacity-50"
        >
          {loading ? "Validation…" : "Je valide mon inscription"}
        </button>
      </form>
    </main>
  );
}

// Traduit les messages d'erreur Supabase Auth (anglais) en français.
function messageErreurFr(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cette adresse e-mail.";
  if (m.includes("invalid") && m.includes("email"))
    return "Cette adresse e-mail n'est pas valide.";
  if (m.includes("password") && m.includes("least"))
    return "Le mot de passe est trop court.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("for security purposes"))
    return "Trop de tentatives. Merci de réessayer dans quelques minutes.";
  if (m.includes("unable to validate email") || m.includes("email address") && m.includes("invalid"))
    return "Cette adresse e-mail n'est pas valide.";
  return "Une erreur est survenue. Vérifiez vos informations et réessayez.";
}

function Champ({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-encre/70">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-encre/20 px-3 py-2 outline-none focus:border-brique"
      />
    </label>
  );
}
