import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import Deconnexion from "./Deconnexion";

export const dynamic = "force-dynamic";

export default async function MonEspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/inscription");

  const { data: agent } = await supabase
    .from("agents")
    .select("agence, prenom, nom, email, telephone")
    .eq("id", user.id)
    .single();

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");

  const jours = (joursRows ?? []).map((r) => r.jour as string);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-titre text-3xl text-encre">
            Bonjour {agent?.prenom ?? ""}
          </h1>
          <p className="mt-1 text-encre/60">{agent?.agence}</p>
        </div>
        <Deconnexion />
      </div>

      <section className="mt-8 rounded-xl border border-encre/10 bg-carte p-6 shadow-carte">
        <h2 className="font-titre text-xl text-encre">Votre inscription</h2>
        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-encre/50">Agence</dt>
          <dd className="text-encre">{agent?.agence}</dd>
          <dt className="text-encre/50">Nom</dt>
          <dd className="text-encre">
            {agent?.prenom} {agent?.nom}
          </dd>
          <dt className="text-encre/50">E-mail</dt>
          <dd className="text-encre">{agent?.email}</dd>
          {agent?.telephone && (
            <>
              <dt className="text-encre/50">Téléphone</dt>
              <dd className="text-encre">{agent.telephone}</dd>
            </>
          )}
          <dt className="text-encre/50">Jours de venue</dt>
          <dd className="text-encre">
            {jours.length
              ? jours.map(labelJour).join(", ")
              : "À choisir lors de la prise de rendez-vous"}
          </dd>
        </dl>
      </section>

      <div className="mt-6 flex gap-4">
        <Link
          href="/annuaire"
          className="rounded-lg bg-brique px-5 py-2.5 font-medium text-white hover:brightness-110"
        >
          Voir les exposants
        </Link>
        <span className="self-center text-sm text-encre/40">
          Le choix des jours et la prise de rendez-vous arrivent à l'étape suivante.
        </span>
      </div>
    </main>
  );
}
