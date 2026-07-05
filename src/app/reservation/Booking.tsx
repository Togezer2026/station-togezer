"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";
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
type Dejeuner = { jour: string };

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
  const [dej, setDej] = useState<Dejeuner[]>([]);
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

  const loadDej = useCallback(async () => {
    const { data } = await supabase.rpc("mes_dejeuners");
    setDej((data ?? []) as Dejeuner[]);
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
    loadDej();
  }, [loadMes, loadDej]);

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

  const paysDe = (exposantId: string) =>
    receptifs.find((r) => r.id === exposantId)?.pays_principal ?? "";

  async function validerEngagement() {
    const { error } = await supabase.rpc("valider_engagement");
    if (!error) setEngage(new Date().toISOString());
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

  async function toggleDejeuner(jour: string) {
    setBusy(`dej_${jour}`);
    const present = dej.some((d) => d.jour === jour);
    const { error } = present
      ? await supabase.rpc("annuler_dejeuner", { p_jour: jour })
      : await supabase.rpc("demander_dejeuner", { p_jour: jour, p_receptifs: [] });
    setBusy(null);
    if (error) {
      setErreur("Action sur le déjeuner impossible. Réessayez.");
      return;
    }
    await loadDej();
  }

  // Un créneau de la grille de réservation (matin ou après-midi)
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

  const joursVenue = JOURS.filter((j) => joursAgent.includes(j.iso));

  // ---------------- « Mon programme » : tableau de bord pleine largeur ----------------
  const Programme = () => (
    <div className="rounded-xl border-2 border-double border-brique/40 bg-carte p-5 shadow-carte sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-titre text-2xl font-600 text-encre">
          Mon programme
          <span className="ml-2 font-corps text-sm font-400 text-encreDoux">
            {mes.length} rendez-vous{dej.length > 0 ? ` · ${dej.length} déjeuner${dej.length > 1 ? "s" : ""}` : ""}
          </span>
        </h3>
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
      </div>

      <div className="mt-5 space-y-5">
        {joursVenue.map((j) => {
          const duJour = mes
            .filter((e) => e.jour === j.iso)
            .sort((a, b) => a.debut.localeCompare(b.debut));
          const lunch = dej.some((d) => d.jour === j.iso);
          return (
            <div key={j.iso} className="border-t border-ligne/60 pt-4 first:border-0 first:pt-0">
              <div className="mb-2 flex items-baseline gap-3">
                <p className="font-titre text-xl font-600 text-encre">{j.label}</p>
                <span className="font-corps text-xs text-encreDoux">
                  {duJour.length === 0 && !lunch
                    ? "journée libre"
                    : `${duJour.length} rendez-vous${lunch ? " + déjeuner" : ""}`}
                </span>
              </div>

              {vue === "timeline" && <TimelineJour items={duJour} hasLunch={lunch} />}

              {/* Chips des rendez-vous */}
              {duJour.length > 0 && (
                <div className={`mt-3 grid gap-2 ${vue === "timeline" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {duJour.map((e) => (
                    <div key={e.id}
                      className="flex items-center gap-2 rounded-lg border border-ligne bg-white/60 px-3 py-2 font-corps text-sm">
                      <span className="font-700 text-brique">{affiche(normDebut(e.debut).slice(11))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-encre">{e.exposant_nom}</span>
                        <span className="block truncate text-xs text-encreDoux">
                          {paysDe(e.exposant_id)}
                          {e.representant ? ` · avec ${e.representant}` : ""}
                        </span>
                      </span>
                      <Link href={`/messages?receptif=${e.exposant_id}`} title="Écrire à ce réceptif"
                        className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-creme hover:text-brique">
                        💬
                      </Link>
                      <button onClick={() => annuler(e.id, e.exposant_id, e.jour)} disabled={busy === e.id}
                        title="Annuler ce rendez-vous"
                        className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-red-50 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Déjeuner réseautage — toujours proposé */}
              <div className="mt-2">
                {lunch ? (
                  <div className="flex items-center gap-2 rounded-lg border border-zMoutarde/50 bg-zMoutarde/10 px-3 py-2 font-corps text-sm">
                    <span className="text-base">🍽️</span>
                    <span className="flex-1 text-encre">
                      <span className="font-600">13h00 – 14h00 · Déjeuner réseautage</span>
                      <span className="block text-xs text-encreDoux">Vous êtes positionné — l'organisation reviendra vers vous.</span>
                    </span>
                    <button onClick={() => toggleDejeuner(j.iso)} disabled={busy === `dej_${j.iso}`}
                      title="Me retirer du déjeuner"
                      className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-red-50 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => toggleDejeuner(j.iso)} disabled={busy === `dej_${j.iso}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zMoutarde/60 px-3 py-2 font-corps text-sm text-encreDoux transition hover:bg-zMoutarde/10 hover:text-encre">
                    🍽️ Me positionner sur le déjeuner réseautage (13h00 – 14h00)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-corps text-xs text-encreDoux">
        Pour <strong>déplacer</strong> un rendez-vous&nbsp;: annulez-le (✕) puis choisissez un
        nouveau créneau dans la grille ci-dessous — l'ancien créneau est libéré aussitôt.
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      {joursVenue.length > 0 && <Programme />}

      {/* Ajout / modification des rendez-vous */}
      <div>
        <h3 className="font-titre text-2xl font-600 text-encre">
          Ajouter ou modifier mes rendez-vous
        </h3>
        <p className="mb-4 mt-1 font-corps text-sm text-encreDoux">
          Choisissez un réceptif, puis cliquez sur un créneau libre.
        </p>

        {erreur && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 font-corps text-sm text-red-700">{erreur}</p>
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

          {/* Grille de créneaux — jours côte à côte */}
          <div>
            {!selReceptif ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
                ← Sélectionnez un réceptif pour voir ses créneaux.
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-titre text-2xl font-600 text-encre">
                  {selReceptif.nom}
                  <span className="ml-2 font-corps text-sm text-encreDoux">
                    cliquez un créneau pour le réserver
                  </span>
                </h4>
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
      </div>

      {/* Validation de l'engagement */}
      {mes.length > 0 && (
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
                <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-brique" />
                <span>
                  Je m'engage à honorer mes rendez-vous, et à revenir les{" "}
                  <strong>annuler ou modifier</strong> sans tarder si un changement
                  dans mon agenda m'en empêche — afin de libérer le créneau pour un confrère.
                </span>
              </label>
              <button onClick={validerEngagement} disabled={!coche}
                className="mt-4 rounded-full bg-brique px-7 py-2.5 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-40">
                Je valide mon programme
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const minutesOf = (ts: string) => {
  const [h, m] = normDebut(ts).slice(11).split(":").map(Number);
  return h * 60 + m;
};

// Frise horaire d'une journée, pleine largeur (9h → 18h).
function TimelineJour({
  items,
  hasLunch,
}: {
  items: { debut: string; fin: string; exposant_nom: string }[];
  hasLunch: boolean;
}) {
  const START = 9 * 60,
    SPAN = 9 * 60; // 9h → 18h
  const pct = (min: number) => ((min - START) / SPAN) * 100;
  const LUNCH_L = pct(13 * 60),
    LUNCH_W = (60 / SPAN) * 100;

  return (
    <div className="w-full">
      <div className="relative h-12 w-full overflow-hidden rounded-lg border border-ligne bg-creme">
        {/* zone déjeuner (13-14h) */}
        <div className="absolute inset-y-0 bg-zMoutarde/10"
          style={{ left: `${LUNCH_L}%`, width: `${LUNCH_W}%` }} />
        {/* lignes des heures */}
        {[10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
          <div key={h} className="absolute inset-y-0 border-l border-ligne/40"
            style={{ left: `${pct(h * 60)}%` }} />
        ))}
        {/* bloc déjeuner */}
        {hasLunch && (
          <div className="absolute inset-y-2 flex items-center justify-center rounded bg-zMoutarde text-[11px]"
            style={{ left: `${LUNCH_L}%`, width: `${LUNCH_W}%` }}
            title="Déjeuner réseautage · 13h00 – 14h00">
            🍽️
          </div>
        )}
        {/* blocs rendez-vous */}
        {items.map((it, i) => {
          const s = minutesOf(it.debut),
            e = minutesOf(it.fin);
          return (
            <div key={i}
              className="absolute inset-y-2 rounded bg-brique transition hover:brightness-110"
              style={{ left: `${pct(s)}%`, width: `${Math.max(1.3, ((e - s) / SPAN) * 100)}%` }}
              title={`${affiche(normDebut(it.debut).slice(11))} · ${it.exposant_nom}`} />
          );
        })}
      </div>
      {/* légende des heures */}
      <div className="relative mt-1 h-4">
        {[9, 11, 13, 15, 17].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 font-corps text-[10px] text-encreDoux"
            style={{ left: `${pct(h * 60)}%` }}>
            {h}h
          </span>
        ))}
        <span className="absolute right-0 font-corps text-[10px] text-encreDoux">18h</span>
      </div>
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
