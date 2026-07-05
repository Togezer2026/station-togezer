"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { CRENEAUX_MATIN, CRENEAUX_APREM, affiche, normDebut } from "@/lib/creneaux";

export type PlanningRdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  exposant_id: string | null;
  agent_id: string | null;
  agence: string | null;
  receptif: string | null;
};

const SLOTS = [...CRENEAUX_MATIN, ...CRENEAUX_APREM];

export default function Planning({
  rdvs,
  receptifs,
  agents,
}: {
  rdvs: PlanningRdv[];
  receptifs: { id: string; nom: string }[];
  agents: { id: string; agence: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"receptif" | "agent">("receptif");
  const [entityId, setEntityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  // RDV de l'entité sélectionnée (déplaçables : matin/après-midi)
  const items = useMemo(
    () =>
      rdvs.filter(
        (r) =>
          (r.kind === "rdv_matin" || r.kind === "rdv_aprem") &&
          (mode === "receptif" ? r.exposant_id === entityId : r.agent_id === entityId),
      ),
    [rdvs, mode, entityId],
  );

  const at = (jour: string, hhmm: string) =>
    items.find((r) => normDebut(r.debut) === `${jour} ${hhmm}`);

  // Étiquette du bloc = l'autre partie
  const label = (r: PlanningRdv) => (mode === "receptif" ? r.agence : r.receptif) ?? "—";

  async function drop(jour: string, hhmm: string) {
    const id = dragRef.current;
    dragRef.current = null;
    if (!id) return;
    const r = items.find((x) => x.id === id);
    if (!r) return;
    if (normDebut(r.debut) === `${jour} ${hhmm}`) return; // même case
    const ok = confirm(
      `Déplacer ce rendez-vous ?\n\n${label(r)}\nDe ${labelJour(r.jour)} ${affiche(normDebut(r.debut).slice(11))}\nVers ${labelJour(jour)} ${affiche(hhmm)}\n\nL'anti-conflit reste garanti : si la cible est occupée, le déplacement sera refusé.`,
    );
    if (!ok) return;
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("deplacer_rdv", {
      p_id: id,
      p_nouveau_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(false);
    if (error) {
      setErreur(error.message.includes("occupé") ? "Créneau cible déjà occupé." : "Déplacement impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select value={mode} onChange={(e) => { setMode(e.target.value as "receptif" | "agent"); setEntityId(""); }}
          className="rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
          <option value="receptif">Par réceptif</option>
          <option value="agent">Par agence</option>
        </select>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)}
          className="min-w-[220px] rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
          <option value="">— Choisir —</option>
          {mode === "receptif"
            ? receptifs.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)
            : agents.map((a) => <option key={a.id} value={a.id}>{a.agence}</option>)}
        </select>
        {busy && <span className="font-corps text-sm text-encreDoux">Déplacement…</span>}
        {erreur && <span className="font-corps text-sm text-red-600">{erreur}</span>}
      </div>

      {!entityId ? (
        <p className="rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
          Sélectionnez un {mode === "receptif" ? "réceptif" : "une agence"} pour voir son planning.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {JOURS.map((j) => (
            <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
              <p className="mb-2 text-center font-titre text-lg font-600 text-encre">{j.label}</p>
              <div className="space-y-1">
                {SLOTS.map((hhmm) => {
                  const r = at(j.iso, hhmm);
                  return (
                    <div
                      key={hhmm}
                      onDragOver={(e) => { if (!r) e.preventDefault(); }}
                      onDrop={() => drop(j.iso, hhmm)}
                      className="flex items-center gap-2"
                    >
                      <span className="w-12 shrink-0 text-right font-corps text-[11px] text-encreDoux">
                        {affiche(hhmm)}
                      </span>
                      {r ? (
                        <div
                          draggable
                          onDragStart={() => { dragRef.current = r.id; }}
                          title="Glissez pour déplacer"
                          className="flex-1 cursor-grab truncate rounded-md bg-brique px-2 py-1.5 font-corps text-xs font-600 text-creme active:cursor-grabbing"
                        >
                          {label(r)}
                        </div>
                      ) : (
                        <div className="h-7 flex-1 rounded-md border border-dashed border-ligne/70" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
