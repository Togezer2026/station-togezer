"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  continent_principal: string;
  exposant_destinations: { pays: string; continent: string }[];
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
  engagementAt,
}: {
  receptifs: Receptif[];
  joursAgent: string[];
  engagementAt: string | null;
}) {
  const supabase = createClient();
  const [sel, setSel] = useState<string | null>(null);
  const [mes, setMes] = useState<Engagement[]>([]);
  const [occ, setOcc] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [continent, setContinent] = useState("");
  const [pays, setPays] = useState("");
  const [engage, setEngage] = useState<string | null>(engagementAt);
  const [coche, setCoche] = useState(false);
  const [vue, setVue] = useState<"timeline" | "liste">("timeline");

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

  const destinations = (r: Receptif) => [
    { pays: r.pays_principal, continent: r.continent_principal },
    ...r.exposant_destinations,
  ];

  const surMesJours = receptifs.filter((r) =>
    r.presences.some((p) => joursAgent.includes(p.jour) && BREAKFAST.has(p.formule)),
  );
  const continents = [...new Set(surMesJours.flatMap((r) => destinations(r).map((d) => d.continent)))].sort();
  const paysList = [...new Set(surMesJours.flatMap((r) => destinations(r).map((d) => d.pays)))]
    .filter((p) => !continent || surMesJours.some((r) => destinations(r).some((d) => d.pays === p && d.continent === continent)))
    .sort();
  const bookables = surMesJours
    .filter((r) => {
      const ds = destinations(r);
      if (continent && !ds.some((d) => d.continent === continent)) return false;
      if (pays && !ds.some((d) => d.pays === pays)) return false;
      return true;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  async function validerEngagement() {
    const { error } = await supabase.rpc("valider_engagement");
    if (!error) setEngage(new Date().toISOString());
  }

  const paysDe = (exposantId: string) =>
    receptifs.find((r) => r.id === exposantId)?.pays_principal ?? "";

  async function annulerTout() {
    if (!confirm("Réinitialiser : annuler TOUS vos rendez-vous ? Cette action est définitive.")) return;
    const { error } = await supabase.rpc("annuler_mes_rdv");
    if (error) {
      setErreur("La réinitialisation a échoué. Réessayez.");
      return;
    }
    await loadMes();
    if (sel) JOURS.filter((j) => joursAgent.includes(j.iso)).forEach((j) => loadOcc(sel, j.iso));
  }

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

  async function annuler(id: string, expoId: string | null, jour: string | null) {
    setErreur(null);
    setBusy(id);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: id, p_message: null });
    setBusy(null);
    if (error) {
      setErreur("L'annulation a échoué. Réessayez.");
      return;
    }
    const jobs: Promise<unknown>[] = [loadMes()];
    if (expoId && jour) jobs.push(loadOcc(expoId, jour));
    await Promise.all(jobs);
  }

  // Un créneau (matin ou après-midi) de la grille de réservation
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
          className="rounded-lg border border-brique bg-brique px-1.5 py-2 font-corps text-xs font-600 text-creme">
          {affiche(hhmm)} ✓
        </button>
      );
    if (prisAilleurs)
      return (
        <span key={hhmm} title={`Déjà pris : ${mien!.exposant_nom}`}
          className="rounded-lg border border-ligne bg-creme px-1.5 py-2 text-center font-corps text-xs text-encre/30">
          {affiche(hhmm)}
        </span>
      );
    if (occupe)
      return (
        <span key={hhmm} title="Créneau déjà réservé"
          className="rounded-lg border border-ligne bg-creme px-1.5 py-2 text-center font-corps text-xs text-encre/25 line-through">
          {affiche(hhmm)}
        </span>
      );
    return (
      <button key={hhmm} onClick={() => reserver(selReceptif.id, jourIso, hhmm)}
        disabled={busy === b}
        className="rounded-lg border border-encre/20 bg-white px-1.5 py-2 font-corps text-xs text-encre transition hover:border-brique hover:bg-brique/5">
        {affiche(hhmm)}
      </button>
    );
  };

  // ------ « Mon programme » : timeline + liste, annulation, messagerie ------
  const Programme = () => (
    <div className="rounded-xl border-2 border-double border-brique/40 bg-carte p-5 shadow-carte">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-titre text-2xl font-600 text-encre">
          Mon programme
          <span className="ml-2 font-corps text-sm font-400 text-encreDoux">
            {mes.length} rendez-vous
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-encre/15 p-0.5">
            {(["timeline", "liste"] as const).map((v) => (
              <button key={v} onClick={() => setVue(v)}
                className={`rounded-full px-4 py-1 font-corps text-xs font-600 capitalize transition ${
                  vue === v ? "bg-encre text-creme" : "text-encreDoux hover:text-encre"
                }`}>
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={annulerTout}
            className="rounded-full border border-encre/20 px-4 py-1.5 font-corps text-xs text-encreDoux transition hover:border-red-400 hover:text-red-600"
          >
            Tout réinitialiser
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {JOURS.filter((j) => joursAgent.includes(j.iso)).map((j) => {
          const duJour = mes
            .filter((e) => e.jour === j.iso)
            .sort((a, b) => a.debut.localeCompare(b.debut));
          return (
            <div key={j.iso} className="rounded-lg border border-ligne bg-white/50 p-4">
              <p className="font-titre text-lg font-600 text-encre">{j.label}</p>
              <div className="mt-2 pb-5">
                <Timeline items={duJour} />
              </div>
              {duJour.length === 0 ? (
                <p className="mt-2 font-corps text-xs text-encreDoux">
                  Aucun rendez-vous ce jour — la journée est à vous.
                </p>
              ) : vue === "liste" ? (
                <ul className="mt-2 space-y-1.5">
                  {duJour.map((e) => (
                    <li key={e.id}
                      className="flex items-center gap-2 rounded-lg border border-ligne bg-carte px-2.5 py-1.5 font-corps text-sm">
                      <span className="font-600 text-brique">{affiche(normDebut(e.debut).slice(11))}</span>
                      <span className="min-w-0 flex-1 truncate text-encre" title={e.exposant_nom}>
                        {e.exposant_nom}
                        <span className="text-encreDoux"> · {paysDe(e.exposant_id)}</span>
                      </span>
                      <Link href={`/messages?receptif=${e.exposant_id}`} title="Écrire à ce réceptif"
                        className="shrink-0 rounded px-1 text-encreDoux hover:text-brique">
                        💬
                      </Link>
                      <button onClick={() => annuler(e.id, e.exposant_id, e.jour)} disabled={busy === e.id}
                        title="Annuler ce rendez-vous"
                        className="shrink-0 rounded px-1 text-encreDoux hover:text-red-600">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 space-y-1">
                  {duJour.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 font-corps text-xs text-encre">
                      <span className="font-600 text-brique">{affiche(normDebut(e.debut).slice(11))}</span>
                      <span className="min-w-0 flex-1 truncate">{e.exposant_nom}</span>
                      <Link href={`/messages?receptif=${e.exposant_id}`} title="Écrire à ce réceptif"
                        className="shrink-0 text-encreDoux hover:text-brique">💬</Link>
                      <button onClick={() => annuler(e.id, e.exposant_id, e.jour)} disabled={busy === e.id}
                        title="Annuler" className="shrink-0 text-encreDoux hover:text-red-600">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-corps text-xs text-encreDoux">
        Pour <strong>déplacer</strong> un rendez-vous : annulez-le (✕) puis choisissez un
        nouveau créneau dans la grille ci-dessous — l'ancien créneau est libéré aussitôt.
      </p>
    </div>
  );

  // Carte de validation du programme (engagement)
  const CarteValidation = () => (
    <div className="rounded-xl border-2 border-double border-brique/50 bg-carte p-5 shadow-carte">
      {engage ? (
        <p className="font-corps text-sm text-encre">
          ✓ <strong>Programme confirmé.</strong> Merci&nbsp;! Pensez à revenir
          l'ajuster ici si votre agenda change — annuler un créneau libère la
          place pour un autre agent.
        </p>
      ) : (
        <>
          <p className="font-titre text-lg font-600 text-encre">
            Dernière étape&nbsp;: je valide mon programme
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 font-corps text-sm text-encre">
            <input
              type="checkbox"
              checked={coche}
              onChange={(e) => setCoche(e.target.checked)}
              className="mt-1 h-4 w-4 accent-brique"
            />
            <span>
              Je m'engage à honorer mes rendez-vous, et à revenir les{" "}
              <strong>annuler ou modifier</strong> sans tarder si un changement
              dans mon agenda m'en empêche — afin de libérer le créneau pour un
              confrère.
            </span>
          </label>
          <button
            onClick={validerEngagement}
            disabled={!coche}
            className="mt-4 rounded-full bg-brique px-7 py-2.5 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-40"
          >
            Je valide mon programme
          </button>
        </>
      )}
    </div>
  );

  // Un programme déjà validé s'affiche EN PREMIER ; sinon il vient après la grille.
  const programmeEnPremier = !!engage && mes.length > 0;

  return (
    <div className="space-y-6">
      {programmeEnPremier && <Programme />}

      {programmeEnPremier && (
        <h3 className="pt-1 font-titre text-xl font-600 text-encre">
          Ajouter ou modifier des rendez-vous
        </h3>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Liste des réceptifs réservables */}
        <div className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
          <p className="px-1 pb-2 font-corps text-xs text-encreDoux">
            Seuls les réceptifs présents sur <strong className="text-encre">vos jours</strong> s'affichent.
          </p>
          <div className="flex gap-2">
            <select value={continent} onChange={(e) => { setContinent(e.target.value); setPays(""); }}
              className="min-w-0 flex-1 rounded-lg border border-encre/20 bg-white px-2 py-1.5 font-corps text-xs">
              <option value="">Tous continents</option>
              {continents.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={pays} onChange={(e) => setPays(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-encre/20 bg-white px-2 py-1.5 font-corps text-xs">
              <option value="">Tous pays</option>
              {paysList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <p className="px-1 pt-2 font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
            {bookables.length} réceptif{bookables.length > 1 ? "s" : ""}
          </p>
          <div className="mt-1 max-h-[560px] space-y-1 overflow-y-auto">
            {bookables.map((r) => {
              const sec = r.exposant_destinations.map((d) => d.pays);
              const sousTitre = [r.pays_principal, ...sec].join(", ");
              const on = sel === r.id;
              const dejaRdv = mes.some((e) => e.exposant_id === r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => setSel(r.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                    on ? "bg-brique text-creme" : "text-encre hover:bg-creme"
                  }`}
                >
                  {r.logo_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo_path} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-corps text-sm font-600">{r.nom}</span>
                    <span className={`block truncate font-corps text-xs ${on ? "text-creme/80" : "text-encreDoux"}`}>
                      {sousTitre}
                    </span>
                  </span>
                  {dejaRdv && (
                    <span title="Vous avez déjà un rendez-vous avec ce réceptif"
                      className={`shrink-0 font-corps text-xs font-700 ${on ? "text-creme" : "text-brique"}`}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grille de créneaux — les jours côte à côte */}
        <div>
          {!selReceptif ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
              Sélectionnez un réceptif à gauche pour voir ses créneaux.
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-titre text-2xl font-600 text-encre">
                {selReceptif.nom}
                <span className="ml-2 font-corps text-sm text-encreDoux">
                  cliquez sur un créneau pour le réserver
                </span>
              </h3>
              {erreur && (
                <p className="rounded-lg bg-red-50 px-3 py-2 font-corps text-sm text-red-700">
                  {erreur}
                </p>
              )}
              <div className={`grid gap-4 ${joursDuReceptif.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
                {joursDuReceptif.map((j) => {
                  const taken = occ[`${selReceptif.id}_${j.iso}`] ?? new Set<string>();
                  const formule = formuleJour(j.iso);
                  const showMatin = BREAKFAST.has(formule);
                  const showAprem = formule === "journee";
                  return (
                    <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                      <p className="mb-3 text-center font-titre text-lg font-600 text-encre">{j.label}</p>
                      {showMatin && (
                        <div className="mb-4">
                          <p className="mb-2 font-corps text-[11px] font-600 uppercase tracking-wide text-encreDoux">
                            Petit-déjeuner · 20 min
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {CRENEAUX_MATIN.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                          </div>
                        </div>
                      )}
                      {showAprem && (
                        <div>
                          <p className="mb-2 font-corps text-[11px] font-600 uppercase tracking-wide text-encreDoux">
                            Après-midi · 30 min
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {CRENEAUX_APREM.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Programme + validation pour la première visite (après la grille) */}
      {!programmeEnPremier && mes.length > 0 && <Programme />}
      {mes.length > 0 && <CarteValidation />}
    </div>
  );
}

const minutesOf = (ts: string) => {
  const [h, m] = normDebut(ts).slice(11).split(":").map(Number);
  return h * 60 + m;
};

// Frise horaire d'une journée (9h → 18h) montrant les RDV posés.
function Timeline({ items }: { items: { debut: string; fin: string }[] }) {
  const START = 9 * 60,
    END = 18 * 60,
    SPAN = END - START;
  return (
    <div className="relative h-9 rounded-lg border border-ligne bg-creme">
      {[9, 11, 13, 15, 17].map((h) => (
        <div key={h} className="absolute top-0 h-full border-l border-ligne/60"
          style={{ left: `${((h * 60 - START) / SPAN) * 100}%` }}>
          <span className="absolute -bottom-5 -translate-x-1/2 font-corps text-[10px] text-encreDoux">{h}h</span>
        </div>
      ))}
      {items.map((it, i) => {
        const s = minutesOf(it.debut),
          e = minutesOf(it.fin);
        return (
          <div key={i} className="absolute bottom-1 top-1 rounded bg-brique"
            style={{ left: `${((s - START) / SPAN) * 100}%`, width: `${Math.max(1.6, ((e - s) / SPAN) * 100)}%` }}
            title={`${affiche(normDebut(it.debut).slice(11))}`} />
        );
      })}
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
