"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";
import { CRENEAUX_MATIN, affiche } from "@/lib/creneaux";

export default function Disponibilites({
  joursAgent,
  initialFermes,
}: {
  joursAgent: string[];
  initialFermes: { jour: string; hhmm: string }[];
}) {
  const supabase = createClient();
  const [fermes, setFermes] = useState<Set<string>>(
    new Set(initialFermes.map((f) => `${f.jour} ${f.hhmm}`)),
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(jour: string, hhmm: string) {
    const k = `${jour} ${hhmm}`;
    setBusy(k);
    const { data, error } = await supabase.rpc("basculer_creneau", {
      p_jour: jour,
      p_hhmm: hhmm,
    });
    setBusy(null);
    if (error) return;
    setFermes((prev) => {
      const next = new Set(prev);
      if (data === true) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  const jours = JOURS.filter((j) => joursAgent.includes(j.iso));

  return (
    <div>
      <p className="mb-4 font-corps text-sm text-encreDoux">
        Votre agenda est <strong className="text-encre">ouvert par défaut de 9h à 13h</strong> sur
        vos jours. Décochez les créneaux où vous ne souhaitez pas recevoir de
        demande de rendez-vous de la part des réceptifs.
      </p>
      <div className="space-y-4">
        {jours.map((j) => (
          <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
            <p className="mb-3 font-titre text-lg font-600 text-encre">{j.label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {CRENEAUX_MATIN.map((hhmm) => {
                const k = `${j.iso} ${hhmm}`;
                const ferme = fermes.has(k);
                return (
                  <button
                    key={hhmm}
                    onClick={() => toggle(j.iso, hhmm)}
                    disabled={busy === k}
                    title={ferme ? "Indisponible — cliquez pour ouvrir" : "Disponible — cliquez pour fermer"}
                    className={`rounded-lg border px-2 py-2 font-corps text-sm transition ${
                      ferme
                        ? "border-ligne bg-creme text-encre/30 line-through"
                        : "border-brique/40 bg-brique/10 text-encre hover:bg-brique/20"
                    }`}
                  >
                    {affiche(hhmm)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
