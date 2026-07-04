"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";

export default function JoursSelector({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [jours, setJours] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const toggle = (iso: string) =>
    setJours((p) => (p.includes(iso) ? p.filter((j) => j !== iso) : [...p, iso]));

  async function save() {
    setErreur(null);
    if (jours.length === 0) {
      setErreur("Choisissez au moins un jour de venue.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_jours_agent", { p_jours: jours });
    setBusy(false);
    if (error) {
      setErreur("Une erreur est survenue. Réessayez.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {JOURS.map((j) => {
          const on = jours.includes(j.iso);
          return (
            <button
              key={j.iso}
              type="button"
              onClick={() => { toggle(j.iso); setOk(false); }}
              className={`rounded-xl border px-6 py-4 font-corps transition ${
                on
                  ? "border-brique bg-brique text-creme"
                  : "border-ligne bg-carte text-encre hover:border-brique/50"
              }`}
            >
              <span className="block font-titre text-xl font-600">{j.label}</span>
              <span className="text-xs opacity-80">Septembre 2026</span>
            </button>
          );
        })}
      </div>

      {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}

      <div className="mt-5 flex items-center gap-4">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-brique px-7 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer mes jours"}
        </button>
        {ok && <span className="font-corps text-sm text-brique">✓ Jours enregistrés</span>}
      </div>
    </div>
  );
}
