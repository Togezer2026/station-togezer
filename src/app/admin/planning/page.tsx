import { requireAdmin } from "@/lib/admin";
import Planning, { type PlanningRdv } from "./Planning";

export const dynamic = "force-dynamic";

export default async function AdminPlanning() {
  const { supabase } = await requireAdmin();
  const { data: rdvData } = await supabase.rpc("admin_rendez_vous");
  const [{ data: recs }, { data: ags }] = await Promise.all([
    supabase.from("exposants").select("id, nom").order("nom"),
    supabase.from("agents").select("id, agence").order("agence"),
  ]);

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Planning</h1>
      <p className="mb-6 mt-1 font-corps text-sm text-encreDoux">
        Choisissez un réceptif ou une agence, visualisez ses 3 journées, et
        <strong> glissez-déposez</strong> un rendez-vous pour le déplacer.
      </p>
      <Planning
        rdvs={(rdvData ?? []) as PlanningRdv[]}
        receptifs={(recs ?? []) as { id: string; nom: string }[]}
        agents={(ags ?? []) as { id: string; agence: string }[]}
      />
    </div>
  );
}
