import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import AppHeader from "@/components/AppHeader";
import { GlobeGrid } from "@/components/Ornaments";

export const dynamic = "force-dynamic";

export default async function MonEspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inscription");

  const { data: agent } = await supabase
    .from("agents")
    .select("agence, ville, prenom, nom, email, telephone")
    .eq("id", user.id)
    .single();

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  const { count: nbRdv } = await supabase
    .from("engagements")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .eq("statut", "confirme");

  return (
    <div className="min-h-screen">
      <AppHeader />

      {/* Bienvenue */}
      <section className="relative overflow-hidden border-b border-ligne">
        <GlobeGrid className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 text-ligne/50" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.28em] text-brique">
            Votre espace agent
          </p>
          <h1 className="mt-2 font-titre text-5xl font-600 text-encre">
            Bonjour {agent?.prenom ?? ""} 👋
          </h1>
          <p className="mt-3 max-w-xl font-corps text-lg text-encreDoux">
            Ravis de vous accueillir à La Station TogeZer. Composez votre
            programme de rendez-vous avec nos réceptifs partenaires — vous pouvez
            revenir l'ajuster autant de fois que vous le souhaitez.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/reservation"
              className="rounded-full bg-brique px-7 py-3 font-corps font-600 text-creme shadow-carte transition hover:bg-briqueFonce"
            >
              Prendre mes rendez-vous
            </Link>
            <Link
              href="/annuaire"
              className="rounded-full border border-encre/20 px-7 py-3 font-corps font-500 text-encre transition hover:bg-encre/5"
            >
              Voir les réceptifs
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10 md:grid-cols-3">
        {/* Rappel de l'événement (billet) */}
        <div className="rounded-xl border-2 border-double border-brique/50 bg-carte p-6 shadow-carte">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
            Votre rendez-vous
          </p>
          <p className="mt-2 font-titre text-2xl font-600 leading-tight text-encre">
            15, 16 &amp; 17 septembre 2026
          </p>
          <p className="mt-1 font-corps text-sm text-encreDoux">De 9h00 à 18h00</p>
          <hr className="my-4 border-ligne" />
          <p className="font-titre text-lg font-600 text-encre">Voie 15</p>
          <p className="font-corps text-sm text-encreDoux">
            397 bis rue de Vaugirard, 75015 Paris
            <br />
            Porte de Versailles (M12 / T2)
          </p>
        </div>

        {/* Compteur RDV */}
        <div className="flex flex-col justify-center rounded-xl border border-ligne bg-carte p-6 text-center shadow-carte">
          <p className="font-titre text-6xl font-700 text-brique">{nbRdv ?? 0}</p>
          <p className="mt-1 font-corps text-sm text-encreDoux">
            rendez-vous programmé{(nbRdv ?? 0) > 1 ? "s" : ""}
          </p>
          <Link
            href="/reservation"
            className="mt-4 font-corps text-sm text-brique underline underline-offset-2"
          >
            {(nbRdv ?? 0) > 0 ? "Voir / modifier mon programme" : "En prendre un premier"}
          </Link>
        </div>

        {/* Mes informations — résumé + lien vers la page dédiée */}
        <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
          <div className="flex items-center justify-between">
            <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
              Mes informations
            </p>
            <Link href="/mes-informations" className="font-corps text-sm text-brique underline underline-offset-2">
              Modifier
            </Link>
          </div>
          <dl className="mt-3 space-y-2 font-corps text-sm">
            <Ligne k="Agence" v={agent?.agence} />
            <Ligne k="Ville" v={agent?.ville} />
            <Ligne k="Contact" v={`${agent?.prenom ?? ""} ${agent?.nom ?? ""}`} />
            <Ligne k="E-mail" v={agent?.email} />
            {agent?.telephone && <Ligne k="Téléphone" v={agent.telephone} />}
            <Ligne k="Jours" v={jours.length ? jours.map(labelJour).join(", ") : "À choisir"} />
          </dl>
        </div>
      </div>
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
