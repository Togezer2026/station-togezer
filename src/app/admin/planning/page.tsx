import { requireAdmin } from "@/lib/admin";
import Planning, { type PlanningRdv } from "./Planning";

export const dynamic = "force-dynamic";

export default async function AdminPlanning() {
  const { supabase } = await requireAdmin();
  const { data: rdvData } = await supabase.rpc("admin_rendez_vous");
  const [{ data: recs }, { data: ags }, { data: aj }] = await Promise.all([
    supabase.from("exposants").select("id, nom, presences(jour, formule)").order("nom"),
    supabase.from("agents").select("id, agence").order("agence"),
    supabase.from("agent_jours").select("agent_id, jour"),
  ]);

  const agentJours: Record<string, string[]> = {};
  (aj ?? []).forEach((r) => {
    (agentJours[r.agent_id as string] ??= []).push(r.jour as string);
  });

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Planning</h1>
      <p className="mb-6 mt-1 font-corps text-sm text-encreDoux">
        Choisissez un réceptif ou une agence, visualisez ses 3 journées, et
        <strong> glissez-déposez</strong> un rendez-vous pour le déplacer.
      </p>
      <Planning
        rdvs={(rdvData ?? []) as PlanningRdv[]}
        receptifs={(recs ?? []) as unknown as { id: string; nom: string; presences: { jour: string; formule: string }[] }[]}
        agents={(ags ?? []) as { id: string; agence: string }[]}
        agentJours={agentJours}
      />
    </div>
  );
}
