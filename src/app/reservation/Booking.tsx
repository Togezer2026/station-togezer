"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { CRENEAUX_MATIN, CRENEAUX_APREM, affiche, normDebut } from "@/lib/creneaux";

export type Presence = { jour: string; formule: string };
export type Receptif = {
  id: string;
  nom: string;
  logo_path: string | null;
  representant: string | null;
  pays_principal: string;
  presences: Presence[];
};
type Engagement = {
  id: string;
  exposant_id: string;
  exposant_nom: string;
  representant: string | null;
  jour: string;
  kind: string;
  debut: string;
  fin: string;
};

const BREAKFAST = new Set(["petits_dej", "biz_biz", "journee"]);

export default function Booking({
  receptifs,
  joursAgent,
}: {
  receptifs: Receptif[];
  joursAgent: string[];
}) {
  const supabase = createClient();
  const [sel, setSel] = useState<string | null>(null);
  const [mes, setMes] = useState<Engagement[]>([]);
  const [occ, setOcc] = useState<Record<string, Set<string>>>({}); // `${expo}_${jour}` -> set de "YYYY-MM-DD HH:MM"
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const loadMes = useCallback(async () => {
    const { data } = await supabase.rpc("mes_engagements");
    setMes((data ?? []) as Engagement[]);
  }, [supabase]);

  const loadOcc = useCallback(
    async (expoId: string, jour: string) => {
      const { data } = await supabase.rpc("creneaux_occupes", {
        p_exposant_id: expoId,
        p_jour: jour,
      });
      const set = new Set<string>(
        (data ?? []).map((r: { debut: string }) => normDebut(r.debut)),
      );
      setOcc((o) => ({ ...o, [`${expoId}_${jour}`]: set }));
    },
    [supabase],
  );

  useEffect(() => {
    loadMes();
  }, [loadMes]);

  // Réceptifs réservables : présents sur un jour de l'agent avec petit-déjeuner
  const bookables = receptifs
    .filter((r) => r.presences.some((p) => joursAgent.includes(p.jour) && BREAKFAST.has(p.formule)))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const selReceptif = bookables.find((r) => r.id === sel) ?? null;
  const joursDuReceptif = selReceptif
    ? JOURS.filter(
        (j) =>
          joursAgent.includes(j.iso) &&
          selReceptif.presences.some((p) => p.jour === j.iso),
      )
    : [];
  const formuleJour = (iso: string) =>
    selReceptif?.presences.find((p) => p.jour === iso)?.formule ?? "absent";

  useEffect(() => {
    if (selReceptif) joursDuReceptif.forEach((j) => loadOcc(selReceptif.id, j.iso));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // Le créneau (jour+heure) où l'agent est déjà pris (avec n'importe quel réceptif)
  const monEngagementA = (jour: string, hhmm: string) =>
    mes.find((e) => e.debut && normDebut(e.debut) === `${jour} ${hhmm}`);

  async function reserver(expoId: string, jour: string, hhmm: string) {
    setErreur(null);
    setBusy(`${expoId}_${jour}_${hhmm}`);
    const { error } = await supabase.rpc("reserver_rdv", {
      p_exposant_id: expoId,
      p_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(null);
    if (error) {
      setErreur(traduire(error.message));
      return;
    }
    await Promise.all([loadMes(), loadOcc(expoId, jour)]);
  }

  async function annuler(id: string, expoId: string, jour: string) {
    setErreur(null);
    setBusy(id);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: id, p_message: null });
    setBusy(null);
    if (error) {
      setErreur("L'annulation a échoué. Réessayez.");
      return;
    }
    await Promise.all([loadMes(), loadOcc(expoId, jour)]);
  }

  // Rendu d'un créneau (matin ou après-midi) — logique de conflit partagée
  const renderSlot = (hhmm: string, jourIso: string, taken: Set<string>) => {
    if (!selReceptif) return null;
    const slotKey = `${jourIso} ${hhmm}`;
    const mien = monEngagementA(jourIso, hhmm);
    const estMien = mien && mien.exposant_id === selReceptif.id;
    const prisAilleurs = mien && mien.exposant_id !== selReceptif.id;
    const occupe = taken.has(slotKey);
    const b = `${selReceptif.id}_${jourIso}_${hhmm}`;

    if (estMien)
      return (
        <button key={hhmm} onClick={() => annuler(mien!.id, selReceptif.id, jourIso)}
          disabled={busy === mien!.id} title="Votre rendez-vous — cliquez pour annuler"
          className="rounded-lg border border-brique bg-brique px-2 py-2 font-corps text-sm text-creme">
          {affiche(hhmm)} ✓
        </button>
      );
    if (prisAilleurs)
      return (
        <span key={hhmm} title={`Déjà pris : ${mien!.exposant_nom}`}
          className="rounded-lg border border-ligne bg-creme px-2 py-2 text-center font-corps text-sm text-encre/30">
          {affiche(hhmm)}
        </span>
      );
    if (occupe)
      return (
        <span key={hhmm} title="Créneau déjà réservé"
          className="rounded-lg border border-ligne bg-creme px-2 py-2 text-center font-corps text-sm text-encre/25 line-through">
          {affiche(hhmm)}
        </span>
      );
    return (
      <button key={hhmm} onClick={() => reserver(selReceptif.id, jourIso, hhmm)}
        disabled={busy === b}
        className="rounded-lg border border-encre/20 bg-white px-2 py-2 font-corps text-sm text-encre transition hover:border-brique hover:bg-brique/5">
        {affiche(hhmm)}
      </button>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Liste des réceptifs réservables */}
      <div className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
        <p className="px-2 py-1 font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
          Réceptifs de vos jours ({bookables.length})
        </p>
        <div className="mt-1 max-h-[520px] space-y-1 overflow-y-auto">
          {bookables.map((r) => (
            <button
              key={r.id}
              onClick={() => setSel(r.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-corps text-sm transition ${
                sel === r.id ? "bg-brique text-creme" : "text-encre hover:bg-creme"
              }`}
            >
              {r.logo_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logo_path} alt="" className="h-7 w-7 rounded" />
              )}
              <span className="truncate">{r.nom}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grille de créneaux */}
      <div>
        {!selReceptif ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
            Sélectionnez un réceptif à gauche pour voir ses créneaux.
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="font-titre text-2xl font-600 text-encre">
              {selReceptif.nom}
              <span className="ml-2 font-corps text-sm text-encreDoux">
                réservez vos créneaux
              </span>
            </h3>
            {erreur && (
              <p className="rounded-lg bg-red-50 px-3 py-2 font-corps text-sm text-red-700">
                {erreur}
              </p>
            )}
            {joursDuReceptif.map((j) => {
              const taken = occ[`${selReceptif.id}_${j.iso}`] ?? new Set<string>();
              const formule = formuleJour(j.iso);
              const showMatin = BREAKFAST.has(formule);
              const showAprem = formule === "journee";
              return (
                <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                  <p className="mb-3 font-titre text-lg font-600 text-encre">{j.label}</p>
                  {showMatin && (
                    <div className="mb-4">
                      <p className="mb-2 font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
                        Petit-déjeuner · 20 min
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {CRENEAUX_MATIN.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                      </div>
                    </div>
                  )}
                  {showAprem && (
                    <div>
                      <p className="mb-2 font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
                        Après-midi · 30 min
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {CRENEAUX_APREM.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mon programme */}
      {mes.length > 0 && (
        <div className="lg:col-span-2">
          <h3 className="mt-2 font-titre text-2xl font-600 text-encre">Mon programme</h3>
          <div className="mt-3 space-y-2">
            {JOURS.filter((j) => mes.some((e) => e.jour === j.iso)).map((j) => (
              <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                <p className="font-titre text-lg font-600 text-encre">{j.label}</p>
                <ul className="mt-2 space-y-1 font-corps text-sm text-encre">
                  {mes
                    .filter((e) => e.jour === j.iso)
                    .sort((a, b) => a.debut.localeCompare(b.debut))
                    .map((e) => (
                      <li key={e.id} className="flex items-center gap-2">
                        <span className="font-600 text-brique">
                          {affiche(normDebut(e.debut).slice(11))}
                        </span>
                        <span>{e.exposant_nom}</span>
                        {e.representant && (
                          <span className="text-encreDoux">(avec {e.representant})</span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function traduire(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("déjà un rendez-vous avec ce réceptif"))
    return "Vous avez déjà un rendez-vous avec ce réceptif (un seul par réceptif).";
  if (m.includes("indisponible") || m.includes("23p01")) return "Ce créneau vient d'être pris. Choisissez-en un autre.";
  if (m.includes("inscrit ce jour")) return "Vous n'êtes pas inscrit ce jour-là.";
  if (m.includes("présent ce jour")) return "Ce réceptif n'est pas présent ce jour-là.";
  return "Réservation impossible. Réessayez.";
}
