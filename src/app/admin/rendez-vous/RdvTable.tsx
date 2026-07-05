"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { affiche, normDebut } from "@/lib/creneaux";

export type Rdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  agence: string | null;
  agent_nom: string | null;
  agent_email: string | null;
  receptif: string | null;
  representant: string | null;
};

const KIND_LABEL: Record<string, string> = {
  rdv_matin: "Petit-déj",
  rdv_aprem: "Après-midi",
  dejeuner: "Déjeuner",
  presentation_inscription: "Présentation",
  presentation_hold: "Présentation (salle)",
};

const heure = (ts: string) => affiche(normDebut(ts).slice(11));

export default function RdvTable({ rows }: { rows: Rdv[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [jour, setJour] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"aucun" | "receptif" | "agent" | "jour">("aucun");
  const [busy, setBusy] = useState<string | null>(null);

  const filtres = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (jour && r.jour !== jour) return false;
      if (type && r.kind !== type) return false;
      if (qq) {
        const hay = `${r.agence ?? ""} ${r.agent_nom ?? ""} ${r.receptif ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, jour, type, q]);

  async function supprimer(r: Rdv) {
    const msg = `Annuler ce rendez-vous ?\n\n${labelJour(r.jour)} à ${heure(r.debut)}\n${r.agence ?? "—"} ↔ ${r.receptif ?? "—"}\n\nLe créneau sera libéré et l'agent perdra ce RDV. Action définitive.`;
    if (!confirm(msg)) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: r.id, p_message: null });
    setBusy(null);
    if (error) {
      alert("La suppression a échoué.");
      return;
    }
    router.refresh();
  }

  function exportCsv() {
    const head = ["Jour", "Début", "Fin", "Type", "Agence", "Agent", "E-mail", "Réceptif", "Représentant"];
    const lignes = filtres.map((r) => [
      labelJour(r.jour), heure(r.debut), heure(r.fin), KIND_LABEL[r.kind] ?? r.kind,
      r.agence ?? "", r.agent_nom ?? "", r.agent_email ?? "", r.receptif ?? "", r.representant ?? "",
    ]);
    const csv = [head, ...lignes]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rendez-vous-station-togezer.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Regroupement
  const groupes = useMemo(() => {
    if (group === "aucun") return [{ titre: "", items: filtres }];
    const key = (r: Rdv) =>
      group === "receptif" ? r.receptif ?? "—" : group === "agent" ? `${r.agence ?? "—"}` : labelJour(r.jour);
    const map = new Map<string, Rdv[]>();
    for (const r of filtres) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([titre, items]) => ({ titre, items }));
  }, [filtres, group]);

  const champ = "rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className={champ}>
          <option value="aucun">Vue : liste</option>
          <option value="receptif">Grouper par réceptif</option>
          <option value="agent">Grouper par agence</option>
          <option value="jour">Grouper par jour</option>
        </select>
        <select value={jour} onChange={(e) => setJour(e.target.value)} className={champ}>
          <option value="">Tous les jours</option>
          {JOURS.map((j) => <option key={j.iso} value={j.iso}>{j.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={champ}>
          <option value="">Tous les types</option>
          <option value="rdv_matin">Petit-déjeuner</option>
          <option value="rdv_aprem">Après-midi</option>
          <option value="dejeuner">Déjeuner</option>
          <option value="presentation_inscription">Présentation</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          className={champ + " min-w-[200px] flex-1"} />
        <span className="font-corps text-sm text-encreDoux">{filtres.length} RDV</span>
        <button onClick={exportCsv}
          className="rounded-full border border-encre/20 px-4 py-2 font-corps text-sm text-encre hover:bg-creme">
          Exporter (CSV)
        </button>
      </div>

      <div className="space-y-6">
        {groupes.map((g) => (
          <div key={g.titre || "all"}>
            {g.titre && (
              <p className="mb-2 font-titre text-lg font-600 text-encre">
                {g.titre} <span className="font-corps text-sm text-encreDoux">({g.items.length})</span>
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
              <table className="w-full text-left font-corps text-sm">
                <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
                  <tr>
                    <th className="px-4 py-3">Jour</th>
                    <th className="px-4 py-3">Horaire</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Agence</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Réceptif</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-encreDoux">Aucun rendez-vous.</td></tr>
                  ) : (
                    g.items
                      .slice()
                      .sort((a, b) => a.jour.localeCompare(b.jour) || a.debut.localeCompare(b.debut))
                      .map((r) => (
                        <tr key={r.id} className="border-b border-ligne/60 last:border-0">
                          <td className="px-4 py-3 text-encreDoux">{labelJour(r.jour)}</td>
                          <td className="px-4 py-3 font-600 text-brique">{heure(r.debut)}–{heure(r.fin)}</td>
                          <td className="px-4 py-3 text-encreDoux">{KIND_LABEL[r.kind] ?? r.kind}</td>
                          <td className="px-4 py-3 font-600 text-encre">{r.agence ?? "—"}</td>
                          <td className="px-4 py-3 text-encreDoux">{r.agent_nom ?? "—"}</td>
                          <td className="px-4 py-3 text-encreDoux">
                            {r.receptif ?? "—"}
                            {r.representant && <span className="text-encre/50"> (avec {r.representant})</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => supprimer(r)} disabled={busy === r.id}
                              className="font-corps text-xs text-red-600 hover:underline disabled:opacity-50">
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
