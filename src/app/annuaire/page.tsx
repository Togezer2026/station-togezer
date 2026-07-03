import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AnnuaireClient, { type ExposantAnnuaire } from "./AnnuaireClient";

export const dynamic = "force-dynamic";

export default async function AnnuairePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exposants")
    .select(
      "id, slug, nom, pays_principal, continent_principal, description, logo_path, groupe_id, exposant_destinations(pays, continent), presences(jour, formule, tient_presentation, theme)",
    )
    .order("nom");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-titre text-2xl text-encre">Annuaire indisponible</h1>
        <p className="mt-3 text-sm text-red-600">{error.message}</p>
        <Link href="/" className="mt-6 inline-block text-brique underline">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  const exposants = (data ?? []) as unknown as ExposantAnnuaire[];

  return (
    <main className="min-h-screen">
      <header className="border-b border-ligne">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <Link
            href="/"
            className="font-corps text-sm text-encreDoux hover:text-encre"
          >
            ← Accueil
          </Link>
          <h1 className="mt-4 font-titre text-5xl font-600 text-encre">
            Nos réceptifs partenaires
          </h1>
          <p className="mt-3 max-w-2xl font-corps text-encreDoux">
            Parcourez les exposants présents. Filtrez par continent, pays ou jour.
            La liste est consultable en entier ; vous réservez avec ceux présents
            sur vos jours d'inscription.
          </p>
        </div>
      </header>
      <AnnuaireClient exposants={exposants} />
    </main>
  );
}
