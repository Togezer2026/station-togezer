import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import JoursSelector from "./JoursSelector";
import Disponibilites from "./Disponibilites";
import Booking, { type Receptif } from "./Booking";

export const dynamic = "force-dynamic";

export default async function Reservation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: agent } = await supabase
    .from("agents")
    .select("prenom, engagement_at")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/mon-espace");

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  let receptifs: Receptif[] = [];
  let fermes: { jour: string; hhmm: string }[] = [];
  if (jours.length > 0) {
    const { data } = await supabase
      .from("exposants")
      .select(
        "id, nom, logo_path, representant, pays_principal, continent_principal, exposant_destinations(pays, continent), presences(jour, formule)",
      )
      .order("nom");
    receptifs = (data ?? []) as unknown as Receptif[];

    const { data: f } = await supabase
      .from("agent_creneaux_fermes")
      .select("jour, hhmm")
      .eq("agent_id", user.id);
    fermes = (f ?? []) as { jour: string; hhmm: string }[];
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-titre text-4xl font-600 text-encre">
        Prendre mes rendez-vous
      </h1>

      {/* Étape 1 */}
      <section className="mt-8 rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Étape 1
        </p>
        <h2 className="mt-1 font-titre text-2xl font-600 text-encre">
          Quels jours venez-vous&nbsp;?
        </h2>
        <p className="mb-5 mt-1 font-corps text-sm text-encreDoux">
          Vous ne pourrez réserver qu'avec les réceptifs présents sur vos jours.
          Vous pourrez ajuster ce choix à tout moment.
        </p>
        <JoursSelector initial={jours} />
      </section>

      {/* Disponibilités */}
      {jours.length > 0 && (
        <section className="mt-6 rounded-xl border border-ligne bg-carte/40 p-6">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
            Mes disponibilités
          </p>
          <h2 className="mt-1 font-titre text-2xl font-600 text-encre">
            Quand êtes-vous joignable&nbsp;?
          </h2>
          <p className="mb-5 mt-1 font-corps text-sm text-encreDoux">
            Ces plages permettent aux réceptifs de <strong>vous</strong> proposer
            un rendez-vous. (La prise de RDV par les réceptifs arrive à l'étape suivante.)
          </p>
          <Disponibilites joursAgent={jours} initialFermes={fermes} />
        </section>
      )}

      {/* Étape 2 */}
      <section className="mt-6">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Étape 2
        </p>
        <h2 className="mt-1 font-titre text-2xl font-600 text-encre">
          Réserver mes créneaux
        </h2>
        {jours.length === 0 ? (
          <p className="mt-1 font-corps text-sm text-encreDoux">
            Choisissez d'abord vos jours ci-dessus.
          </p>
        ) : (
          <div className="mt-4">
            <Booking receptifs={receptifs} joursAgent={jours} engagementAt={agent.engagement_at as string | null} />
          </div>
        )}
      </section>
      </main>
    </div>
  );
}
