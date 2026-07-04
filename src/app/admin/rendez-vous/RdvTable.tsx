"use client";

import { useMemo, useState } from "react";
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
  const [jour, setJour] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

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

  function exportCsv() {
    const head = ["Jour", "Heure début", "Heure fin", "Type", "Agence", "Agent", "E-mail", "Réceptif", "Représentant"];
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

  const champ = "rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher agence / agent / réceptif…"
          className={champ + " min-w-[240px] flex-1"} />
        <span className="font-corps text-sm text-encreDoux">{filtres.length} RDV</span>
        <button onClick={exportCsv}
          className="rounded-full border border-encre/20 px-4 py-2 font-corps text-sm text-encre hover:bg-creme">
          Exporter (CSV)
        </button>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {filtres.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-encreDoux">Aucun rendez-vous.</td></tr>
            ) : (
              filtres.map((r) => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
