import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { JOURS, labelJour } from "@/lib/jours";

export const dynamic = "force-dynamic";

type Rdv = {
  jour: string;
  kind: string;
  exposant_id: string | null;
  agent_id: string | null;
};

export default async function AdminHome() {
  const { supabase, profile } = await requireAdmin();

  const [{ data: recs }, { data: ags }, { data: rdvData }, { count: dejPending }] =
    await Promise.all([
      supabase.from("exposants").select("id, nom, proprietaire_id").order("nom"),
      supabase.from("agents").select("id, agence, created_at"),
      supabase.rpc("admin_rendez_vous"),
      supabase.from("demandes_dejeuner").select("*", { count: "exact", head: true }).eq("statut", "en_attente"),
    ]);

  const receptifs = recs ?? [];
  const agents = ags ?? [];
  const rdv = (rdvData ?? []) as Rdv[];

  const rdvParRec = new Map<string, number>();
  rdv.forEach((r) => {
    if (r.exposant_id) rdvParRec.set(r.exposant_id, (rdvParRec.get(r.exposant_id) ?? 0) + 1);
  });
  const agentsAvecRdv = new Set(rdv.map((r) => r.agent_id).filter(Boolean));

  const parJour = JOURS.map((j) => ({ j, n: rdv.filter((r) => r.jour === j.iso).length }));
  const maxJour = Math.max(1, ...parJour.map((x) => x.n));
  const topRec = receptifs
    .map((r) => ({ nom: r.nom, n: rdvParRec.get(r.id) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  const recSansRdv = receptifs.filter((r) => !rdvParRec.has(r.id));
  const agentsSansRdv = agents.filter((a) => !agentsAvecRdv.has(a.id));
  const recSansCompte = receptifs.filter((r) => !r.proprietaire_id);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-titre text-4xl font-600 text-encre">
            Tableau de bord
          </h1>
          <p className="mt-1 font-corps text-encreDoux">
            Vue d'ensemble de l'événement — {profile.full_name || "admin"}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi val={receptifs.length} label="Réceptifs" href="/admin/receptifs" />
        <Kpi val={agents.length} label="Agents inscrits" href="/admin/agents" />
        <Kpi val={rdv.length} label="Rendez-vous confirmés" href="/admin/rendez-vous" />
        <Kpi val={dejPending ?? 0} label="Déjeuners à valider" href="/admin/rendez-vous" accent />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* RDV par jour */}
        <Carte titre="Rendez-vous par jour">
          <div className="space-y-3">
            {parJour.map(({ j, n }) => (
              <div key={j.iso} className="flex items-center gap-3">
                <span className="w-24 font-corps text-sm text-encreDoux">{j.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-creme">
                  <div className="h-full rounded-full bg-brique" style={{ width: `${(n / maxJour) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-titre font-700 text-encre">{n}</span>
              </div>
            ))}
          </div>
        </Carte>

        {/* Top réceptifs */}
        <Carte titre="Réceptifs les plus demandés">
          {topRec[0]?.n === 0 ? (
            <p className="font-corps text-sm text-encreDoux">Aucun rendez-vous encore.</p>
          ) : (
            <ul className="space-y-2">
              {topRec.map((r) => (
                <li key={r.nom} className="flex items-center justify-between font-corps text-sm">
                  <span className="text-encre">{r.nom}</span>
                  <span className="font-700 text-brique">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* À suivre / alertes */}
      <h2 className="mt-8 font-titre text-2xl font-600 text-encre">À suivre</h2>
      <div className="mt-3 grid gap-6 lg:grid-cols-3">
        <Alerte
          titre="Réceptifs sans aucun RDV"
          items={recSansRdv.map((r) => r.nom)}
          href="/admin/receptifs"
          vide="Tous les réceptifs ont au moins un RDV 🎉"
        />
        <Alerte
          titre="Agents inscrits sans RDV"
          items={agentsSansRdv.map((a) => a.agence)}
          href="/admin/agents"
          vide="Tous les agents ont réservé 🎉"
        />
        <Alerte
          titre="Réceptifs sans compte d'accès"
          items={recSansCompte.map((r) => r.nom)}
          href="/admin/receptifs"
          vide="Tous les réceptifs ont un accès."
        />
      </div>

      {/* Accès rapides */}
      <h2 className="mt-8 font-titre text-2xl font-600 text-encre">Gérer</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Lien href="/admin/receptifs" t="Réceptifs" d="Fiches, formules, accès" />
        <Lien href="/admin/agents" t="Agents" d="Infos, MDP, suppression" />
        <Lien href="/admin/rendez-vous" t="Rendez-vous" d="Vues, filtres, export" />
        <Lien href="/admin/planning" t="Planning" d="Timeline glisser-déposer" />
      </div>
    </div>
  );
}

function Kpi({ val, label, href, accent }: { val: number; label: string; href: string; accent?: boolean }) {
  return (
    <Link href={href}
      className={`rounded-xl border bg-carte p-5 shadow-carte transition hover:border-brique/40 ${
        accent && val > 0 ? "border-brique/60" : "border-ligne"
      }`}>
      <p className="font-titre text-4xl font-700 text-brique">{val}</p>
      <p className="mt-1 font-corps text-sm text-encreDoux">{label}</p>
    </Link>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <h3 className="mb-4 font-titre text-lg font-600 text-encre">{titre}</h3>
      {children}
    </div>
  );
}

function Alerte({ titre, items, href, vide }: { titre: string; items: string[]; href: string; vide: string }) {
  return (
    <div className="rounded-xl border border-ligne bg-carte p-5 shadow-carte">
      <div className="flex items-center justify-between">
        <h3 className="font-titre text-base font-600 text-encre">{titre}</h3>
        <span className={`rounded-full px-2 py-0.5 font-corps text-xs font-600 ${
          items.length ? "bg-brique/10 text-brique" : "bg-creme text-encreDoux"
        }`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 font-corps text-sm text-encreDoux">{vide}</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto font-corps text-sm text-encre">
          {items.slice(0, 30).map((i) => <li key={i}>· {i}</li>)}
          {items.length > 30 && <li className="text-encreDoux">…et {items.length - 30} de plus</li>}
        </ul>
      )}
      <Link href={href} className="mt-3 inline-block font-corps text-sm text-brique underline underline-offset-2">
        Gérer
      </Link>
    </div>
  );
}

function Lien({ href, t, d }: { href: string; t: string; d: string }) {
  return (
    <Link href={href} className="rounded-xl border border-ligne bg-carte p-5 shadow-carte transition hover:border-brique/40">
      <p className="font-titre text-lg font-600 text-encre">{t}</p>
      <p className="mt-1 font-corps text-sm text-encreDoux">{d}</p>
    </Link>
  );
}
