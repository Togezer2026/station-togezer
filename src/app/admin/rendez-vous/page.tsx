import { requireAdmin } from "@/lib/admin";
import RdvTable, { type Rdv } from "./RdvTable";

export const dynamic = "force-dynamic";

export default async function AdminRdv() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_rendez_vous");
  const rows = (data ?? []) as Rdv[];

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Rendez-vous</h1>
      <p className="mb-6 mt-1 font-corps text-sm text-encreDoux">
        Tous les rendez-vous confirmés — filtrez et exportez.
      </p>
      <RdvTable rows={rows} />
    </div>
  );
}
