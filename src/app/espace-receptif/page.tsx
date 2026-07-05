import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Deconnexion from "@/app/mon-espace/Deconnexion";
import { JOURS, labelJour, FORMULE_LABEL } from "@/lib/jours";
import { affiche, normDebut } from "@/lib/creneaux";
import { GlobeGrid } from "@/components/Ornaments";
import SolliciterAgent from "./SolliciterAgent";

export const dynamic = "force-dynamic";

type Rdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  agence: string | null;
  agent_nom: string | null;
  agent_email: string | null;
  agent_ville: string | null;
};

export default async function EspaceReceptif() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "receptif") redirect("/mon-espace");

  const { data: fiche } = await supabase
    .from("exposants")
    .select("id, nom, pays_principal, continent_principal, logo_path, presences(jour, formule)")
    .eq("proprietaire_id", user.id)
    .maybeSingle();

  const { data: rdvData } = await supabase.rpc("receptif_rendez_vous");
  const rdv = (rdvData ?? []) as Rdv[];

  const heure = (ts: string) => affiche(normDebut(ts).slice(11));

  return (
    <div className="min-h-screen">
      <header className="border-b border-ligne bg-carte/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/espace-receptif" aria-label="La Station TogeZer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-togezer.png" alt="La Station TogeZer" className="h-11 w-auto" />
          </Link>
          <Deconnexion />
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-ligne">
        <GlobeGrid className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 text-ligne/50" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.28em] text-brique">
            Espace réceptif
          </p>
          <h1 className="mt-2 font-titre text-5xl font-600 text-encre">
            {fiche?.nom ?? "Votre espace"}
          </h1>
          {fiche && (
            <p className="mt-2 font-corps text-encreDoux">
              {fiche.pays_principal} · {fiche.continent_principal}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Présence */}
        {fiche && (
          <div className="mb-8 flex flex-wrap gap-3">
            {JOURS.map((j) => {
              const p = fiche.presences?.find((x: { jour: string; formule: string }) => x.jour === j.iso);
              return (
                <div key={j.iso}
                  className={`rounded-lg border px-4 py-2 font-corps text-sm ${
                    p ? "border-ligne bg-carte text-encre" : "border-dashed border-ligne text-encre/30"
                  }`}>
                  <span className="font-600">{j.label}</span>
                  <span className="ml-2 text-encreDoux">{p ? FORMULE_LABEL[p.formule] : "Absent"}</span>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="font-titre text-2xl font-600 text-encre">
          Vos rendez-vous ({rdv.length})
        </h2>

        {rdv.length === 0 ? (
          <p className="mt-4 font-corps text-encreDoux">
            Aucun rendez-vous pour l'instant. Les agents peuvent en réserver avec
            vous depuis leur espace.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {JOURS.filter((j) => rdv.some((r) => r.jour === j.iso)).map((j) => (
              <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-5 shadow-carte">
                <p className="font-titre text-lg font-600 text-encre">{labelJour(j.iso)}</p>
                <table className="mt-3 w-full text-left font-corps text-sm">
                  <tbody>
                    {rdv
                      .filter((r) => r.jour === j.iso)
                      .sort((a, b) => a.debut.localeCompare(b.debut))
                      .map((r) => (
                        <tr key={r.id} className="border-t border-ligne/60">
                          <td className="py-2 pr-4 font-600 text-brique">
                            {heure(r.debut)}–{heure(r.fin)}
                          </td>
                          <td className="py-2 pr-4 font-600 text-encre">{r.agence ?? "—"}</td>
                          <td className="py-2 pr-4 text-encreDoux">{r.agent_nom ?? ""}</td>
                          <td className="py-2 text-encreDoux">{r.agent_ville ?? ""}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <SolliciterAgent />

        <p className="mt-8 rounded-lg border border-dashed border-ligne p-4 font-corps text-sm text-encreDoux">
          Bientôt : la messagerie pour échanger avec les agents.
        </p>
      </div>
    </div>
  );
}
