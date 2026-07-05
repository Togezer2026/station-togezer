"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { affiche } from "@/lib/creneaux";

type Agent = { id: string; agence: string; ville: string | null; contact: string | null };
type Slot = { jour: string; hhmm: string; statut: string };

export default function SolliciterAgent() {
  const supabase = createClient();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sel, setSel] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("receptif_agents").then(({ data }) => setAgents((data ?? []) as Agent[]));
  }, [supabase]);

  const loadSlots = useCallback(
    async (agentId: string) => {
      const { data } = await supabase.rpc("creneaux_agent", { p_agent_id: agentId });
      setSlots((data ?? []) as Slot[]);
    },
    [supabase],
  );

  useEffect(() => {
    if (sel) loadSlots(sel);
    else setSlots([]);
  }, [sel, loadSlots]);

  async function reserver(jour: string, hhmm: string) {
    setBusy(`${jour} ${hhmm}`);
    setErreur(null);
    const { error } = await supabase.rpc("receptif_reserver_agent", {
      p_agent_id: sel,
      p_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(null);
    if (error) {
      setErreur(
        error.message.includes("déjà un rendez-vous")
          ? "Vous avez déjà un rendez-vous avec cet agent."
          : error.message.includes("disponible")
            ? "L'agent n'est plus disponible sur ce créneau."
            : "Réservation impossible.",
      );
      return;
    }
    await loadSlots(sel);
    router.refresh();
  }

  async function annuler(jour: string, hhmm: string) {
    // On retrouve l'engagement via une annulation ciblée : on recharge après.
    setBusy(`${jour} ${hhmm}`);
    const { data } = await supabase.rpc("receptif_rendez_vous");
    const rdv = (data ?? []).find(
      (r: { id: string; jour: string; debut: string }) =>
        r.jour === jour && r.debut.replace("T", " ").slice(11, 16) === hhmm,
    );
    if (rdv) await supabase.rpc("receptif_annuler", { p_id: rdv.id });
    setBusy(null);
    await loadSlots(sel);
    router.refresh();
  }

  const joursDuSlot = JOURS.filter((j) => slots.some((s) => s.jour === j.iso));

  return (
    <div className="mt-10">
      <h2 className="font-titre text-2xl font-600 text-encre">Solliciter un rendez-vous</h2>
      <p className="mb-4 mt-1 font-corps text-sm text-encreDoux">
        Choisissez une agence : vous verrez ses créneaux <strong>disponibles</strong>
        (là où vos présences et ses disponibilités coïncident) et pourrez lui proposer un rendez-vous.
      </p>

      <select value={sel} onChange={(e) => setSel(e.target.value)}
        className="min-w-[260px] rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
        <option value="">— Choisir une agence —</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.agence}{a.ville ? ` — ${a.ville}` : ""}</option>
        ))}
      </select>

      {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}

      {sel && (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {joursDuSlot.length === 0 ? (
            <p className="font-corps text-sm text-encreDoux">
              Aucun créneau commun avec cette agence.
            </p>
          ) : (
            joursDuSlot.map((j) => (
              <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                <p className="mb-3 font-titre text-lg font-600 text-encre">{j.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {slots
                    .filter((s) => s.jour === j.iso)
                    .map((s) => {
                      if (s.statut === "ensemble")
                        return (
                          <button key={s.hhmm} onClick={() => annuler(s.jour, s.hhmm)}
                            disabled={busy === `${s.jour} ${s.hhmm}`}
                            title="Votre RDV — cliquez pour annuler"
                            className="rounded-lg border border-brique bg-brique px-2 py-2 font-corps text-sm text-creme">
                            {affiche(s.hhmm)} ✓
                          </button>
                        );
                      if (s.statut === "indispo")
                        return (
                          <span key={s.hhmm}
                            className="rounded-lg border border-ligne bg-creme px-2 py-2 text-center font-corps text-sm text-encre/25 line-through">
                            {affiche(s.hhmm)}
                          </span>
                        );
                      return (
                        <button key={s.hhmm} onClick={() => reserver(s.jour, s.hhmm)}
                          disabled={busy === `${s.jour} ${s.hhmm}`}
                          className="rounded-lg border border-encre/20 bg-white px-2 py-2 font-corps text-sm text-encre transition hover:border-brique hover:bg-brique/5">
                          {affiche(s.hhmm)}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
