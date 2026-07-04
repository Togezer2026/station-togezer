import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { JOURS, FORMULE_LABEL } from "@/lib/jours";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  contact_nom: string | null;
  representant: string | null;
  presences: { jour: string; formule: string }[];
};

export default async function AdminReceptifs() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("exposants")
    .select("id, nom, pays_principal, continent_principal, contact_nom, representant, presences(jour, formule)")
    .order("nom");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-titre text-3xl font-600 text-encre">Réceptifs</h1>
          <p className="mt-1 font-corps text-sm text-encreDoux">
            {rows.length} fiches — cliquez pour tout éditer.
          </p>
        </div>
        <Link
          href="/admin/receptifs/nouveau"
          className="rounded-full bg-brique px-5 py-2.5 font-corps font-600 text-creme hover:bg-briqueFonce"
        >
          + Nouveau réceptif
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
        <table className="w-full text-left font-corps text-sm">
          <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Destination · continent</th>
              <th className="px-4 py-3">Contact</th>
              {JOURS.map((j) => (
                <th key={j.iso} className="px-3 py-3 text-center">{j.court}</th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ligne/60 last:border-0 hover:bg-creme/50">
                <td className="px-4 py-3 font-600 text-encre">
                  {r.nom}
                  {r.representant && (
                    <span className="ml-2 text-xs text-encreDoux">(avec {r.representant})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-encreDoux">
                  <span className="text-brique">{r.pays_principal}</span> · {r.continent_principal}
                </td>
                <td className="px-4 py-3 text-encreDoux">{r.contact_nom ?? "—"}</td>
                {JOURS.map((j) => {
                  const p = r.presences.find((x) => x.jour === j.iso);
                  return (
                    <td key={j.iso} className="px-3 py-3 text-center" title={p ? FORMULE_LABEL[p.formule] : "Absent"}>
                      {p ? <span className="text-brique">●</span> : <span className="text-encre/20">–</span>}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/receptifs/${r.id}`} className="text-brique underline underline-offset-2">
                    Éditer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
