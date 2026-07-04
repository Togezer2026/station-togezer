import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import JoursSelector from "./JoursSelector";

export const dynamic = "force-dynamic";

export default async function Reservation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: agent } = await supabase
    .from("agents")
    .select("prenom")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/mon-espace");

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/mon-espace" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Mon espace
      </Link>
      <h1 className="mt-3 font-titre text-4xl font-600 text-encre">
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

      {/* Étape 2 */}
      <section className="mt-6 rounded-xl border border-ligne bg-carte p-6 shadow-carte">
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
          <p className="mt-1 font-corps text-sm text-encreDoux">
            Vos jours : <strong className="text-encre">{jours.map(labelJour).join(", ")}</strong>.
            La prise de créneaux (petits-déjeuners 20 min, après-midis 30 min,
            déjeuners, présentations) arrive à la prochaine étape du développement.
          </p>
        )}
      </section>
    </main>
  );
}
