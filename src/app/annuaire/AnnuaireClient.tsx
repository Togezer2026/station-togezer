"use client";

import { useMemo, useState } from "react";
import { JOURS, FORMULE_LABEL } from "@/lib/jours";

export type ExposantAnnuaire = {
  id: string;
  slug: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  description: string | null;
  logo_path: string | null;
  groupe_id: string | null;
  exposant_destinations: { pays: string; continent: string }[];
  presences: {
    jour: string;
    formule: string;
    tient_presentation: boolean;
    theme: string | null;
  }[];
};

function destinations(e: ExposantAnnuaire) {
  return [
    { pays: e.pays_principal, continent: e.continent_principal, principal: true },
    ...e.exposant_destinations.map((d) => ({ ...d, principal: false })),
  ];
}

export default function AnnuaireClient({
  exposants,
}: {
  exposants: ExposantAnnuaire[];
}) {
  const [continent, setContinent] = useState("");
  const [pays, setPays] = useState("");
  const [jours, setJours] = useState<string[]>([]);

  // Listes déroulantes construites à partir des destinations (principale + secondaires)
  const continents = useMemo(
    () =>
      [...new Set(exposants.flatMap((e) => destinations(e).map((d) => d.continent)))].sort(),
    [exposants],
  );
  const paysList = useMemo(
    () =>
      [...new Set(exposants.flatMap((e) => destinations(e).map((d) => d.pays)))]
        .filter((p) => !continent || exposants.some((e) => destinations(e).some((d) => d.pays === p && d.continent === continent)))
        .sort(),
    [exposants, continent],
  );

  const toggleJour = (iso: string) =>
    setJours((prev) =>
      prev.includes(iso) ? prev.filter((j) => j !== iso) : [...prev, iso],
    );

  const filtres = useMemo(() => {
    return exposants.filter((e) => {
      const dests = destinations(e);
      if (continent && !dests.some((d) => d.continent === continent)) return false;
      if (pays && !dests.some((d) => d.pays === pays)) return false;
      if (jours.length && !e.presences.some((p) => jours.includes(p.jour)))
        return false;
      return true;
    });
  }, [exposants, continent, pays, jours]);

  const reset = () => {
    setContinent("");
    setPays("");
    setJours([]);
  };
  const actif = continent || pays || jours.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Barre de filtres */}
      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-encre/10 bg-carte p-5 shadow-carte">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Continent</span>
          <select
            value={continent}
            onChange={(e) => {
              setContinent(e.target.value);
              setPays("");
            }}
            className="rounded-lg border border-encre/20 px-3 py-2"
          >
            <option value="">Tous</option>
            {continents.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Pays</span>
          <select
            value={pays}
            onChange={(e) => setPays(e.target.value)}
            className="rounded-lg border border-encre/20 px-3 py-2"
          >
            <option value="">Tous</option>
            {paysList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Jour de présence</span>
          <div className="flex gap-2">
            {JOURS.map((j) => (
              <button
                key={j.iso}
                onClick={() => toggleJour(j.iso)}
                className={`rounded-lg border px-3 py-2 transition ${
                  jours.includes(j.iso)
                    ? "border-brique bg-brique text-white"
                    : "border-encre/20 text-encre/70 hover:border-brique/50"
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-encre/50">
            {filtres.length} exposant{filtres.length > 1 ? "s" : ""}
          </span>
          {actif && (
            <button
              onClick={reset}
              className="rounded-lg border border-encre/20 px-3 py-2 text-sm text-encre/70 hover:bg-creme"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Grille */}
      {filtres.length === 0 ? (
        <p className="py-16 text-center text-encre/50">
          Aucun exposant ne correspond à ces filtres.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtres.map((e) => (
            <ExposantCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExposantCard({ e }: { e: ExposantAnnuaire }) {
  const secondaires = e.exposant_destinations;
  const presentation = e.presences.find((p) => p.tient_presentation && p.theme);
  return (
    <article className="flex flex-col rounded-xl border border-encre/10 bg-carte p-5 shadow-carte">
      <div className="flex items-center gap-3">
        {e.logo_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.logo_path} alt="" className="h-12 w-12 rounded-xl" />
        )}
        <div>
          <h3 className="font-titre text-lg text-encre">{e.nom}</h3>
          <p className="text-sm text-brique">
            {e.pays_principal} · {e.continent_principal}
          </p>
        </div>
      </div>

      {e.description && (
        <p className="mt-3 text-sm text-encre/70">{e.description}</p>
      )}

      {secondaires.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {secondaires.map((d) => (
            <span
              key={d.pays}
              className="rounded-full bg-creme px-2 py-0.5 text-xs text-encre/60"
            >
              {d.pays}
            </span>
          ))}
        </div>
      )}

      {presentation && (
        <p className="mt-3 rounded-lg bg-brique/10 px-3 py-2 text-xs text-brique">
          Présentation : « {presentation.theme} »
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-encre/10 pt-3">
        {JOURS.map((j) => {
          const p = e.presences.find((pr) => pr.jour === j.iso);
          return (
            <span
              key={j.iso}
              className={`rounded-md px-2 py-1 text-xs ${
                p
                  ? "bg-encre text-creme"
                  : "bg-creme text-encre/30 line-through"
              }`}
              title={p ? FORMULE_LABEL[p.formule] : "Absent"}
            >
              {j.court}
            </span>
          );
        })}
      </div>
    </article>
  );
}
