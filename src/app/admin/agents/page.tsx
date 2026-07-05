import { requireAdmin } from "@/lib/admin";
import { labelJour } from "@/lib/jours";
import UserActions from "../UserActions";
import EditAgent from "./EditAgent";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  agence: string;
  ville: string | null;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  created_at: string;
};

function dateFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAgents() {
  const { supabase } = await requireAdmin();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, agence, ville, prenom, nom, email, telephone, created_at")
    .order("created_at", { ascending: false });
  const { data: jours } = await supabase.from("agent_jours").select("agent_id, jour");

  const rows = (agents ?? []) as Agent[];
  const joursByAgent = (id: string) =>
    (jours ?? []).filter((j) => j.agent_id === id).map((j) => labelJour(j.jour as string));

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Agents inscrits</h1>
      <p className="mt-1 font-corps text-sm text-encreDoux">{rows.length} agent(s).</p>

      {rows.length === 0 ? (
        <p className="mt-8 font-corps text-encreDoux">
          Aucun agent inscrit pour l'instant.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
          <table className="w-full text-left font-corps text-sm">
            <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
              <tr>
                <th className="px-4 py-3">Agence</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Jours</th>
                <th className="px-4 py-3">Inscrit le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-3 font-600 text-encre">{a.agence}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.ville ?? "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.prenom} {a.nom}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.email}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.telephone ?? "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{joursByAgent(a.id).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{dateFr(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <EditAgent
                        userId={a.id}
                        email={a.email}
                        initial={{
                          agence: a.agence,
                          ville: a.ville ?? "",
                          prenom: a.prenom,
                          nom: a.nom,
                          telephone: a.telephone ?? "",
                        }}
                      />
                      <UserActions userId={a.id} email={a.email} label={a.agence} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
