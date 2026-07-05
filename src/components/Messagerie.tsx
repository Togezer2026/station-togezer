"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conv = {
  agent_id: string;
  exposant_id: string;
  agence: string;
  receptif: string;
  dernier: string;
  dernier_at: string;
};
type Msg = { id: string; expediteur_id: string; contenu: string; created_at: string };
type Partner = { id: string; nom: string };
type Sel = { agent_id: string; exposant_id: string; titre: string };

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Messagerie({
  role,
  agentId,
  exposantId,
}: {
  role: "agent" | "receptif";
  agentId?: string;
  exposantId?: string;
}) {
  const supabase = createClient();
  const [uid, setUid] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [fil, setFil] = useState<Msg[]>([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const titreConv = (c: Conv) => (role === "agent" ? c.receptif : c.agence);

  async function chargerConvs() {
    const { data } = await supabase.rpc("mes_conversations");
    setConvs((data ?? []) as Conv[]);
  }
  async function chargerFil(a: string, e: string) {
    const { data } = await supabase.rpc("fil", { p_agent_id: a, p_exposant_id: e });
    setFil((data ?? []) as Msg[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    chargerConvs();
    if (role === "agent") {
      supabase
        .from("exposants")
        .select("id, nom")
        .order("nom")
        .then(({ data }) =>
          setPartners(((data ?? []) as { id: string; nom: string }[]).map((x) => ({ id: x.id, nom: x.nom }))),
        );
    } else {
      supabase
        .rpc("receptif_agents")
        .then(({ data }) =>
          setPartners(
            ((data ?? []) as { id: string; agence: string }[]).map((x) => ({ id: x.id, nom: x.agence })),
          ),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharge le fil ouvert (+ léger rafraîchissement pour voir les réponses).
  useEffect(() => {
    if (!sel) return;
    chargerFil(sel.agent_id, sel.exposant_id);
    const t = setInterval(() => chargerFil(sel.agent_id, sel.exposant_id), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.agent_id, sel?.exposant_id]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [fil]);

  function ouvrirNouveau(id: string) {
    const p = partners.find((x) => x.id === id);
    if (!p) return;
    setSel({
      agent_id: role === "agent" ? agentId! : p.id,
      exposant_id: role === "receptif" ? exposantId! : p.id,
      titre: p.nom,
    });
  }

  async function envoyer() {
    if (!sel || !texte.trim() || envoi) return;
    setEnvoi(true);
    setErreurEnvoi(null);
    const { error } = await supabase.rpc("envoyer_message", {
      p_agent_id: sel.agent_id,
      p_exposant_id: sel.exposant_id,
      p_contenu: texte.trim(),
    });
    setEnvoi(false);
    if (error) {
      setErreurEnvoi("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
      return;
    }
    setTexte("");
    await chargerFil(sel.agent_id, sel.exposant_id);
    chargerConvs();
  }

  const dejaOuverts = new Set(convs.map((c) => (role === "agent" ? c.exposant_id : c.agent_id)));
  const nouveaux = partners.filter((p) => !dejaOuverts.has(p.id));

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Colonne conversations */}
      <div className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
        <label className="block">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
            Nouvelle conversation
          </span>
          <select
            value=""
            onChange={(e) => e.target.value && ouvrirNouveau(e.target.value)}
            className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
          >
            <option value="">— {role === "agent" ? "Choisir un réceptif" : "Choisir un agent"} —</option>
            {nouveaux.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 space-y-1">
          {convs.length === 0 && (
            <p className="px-1 py-4 font-corps text-sm text-encreDoux">Aucune conversation pour l'instant.</p>
          )}
          {convs.map((c) => {
            const actif = sel?.agent_id === c.agent_id && sel?.exposant_id === c.exposant_id;
            return (
              <button
                key={`${c.agent_id}-${c.exposant_id}`}
                onClick={() => setSel({ agent_id: c.agent_id, exposant_id: c.exposant_id, titre: titreConv(c) })}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  actif ? "bg-brique/10" : "hover:bg-creme"
                }`}
              >
                <p className="font-corps text-sm font-600 text-encre">{titreConv(c)}</p>
                <p className="truncate font-corps text-xs text-encreDoux">{c.dernier}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colonne fil */}
      <div className="flex min-h-[420px] flex-col rounded-xl border border-ligne bg-carte shadow-carte">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center font-corps text-encreDoux">
            Sélectionnez une conversation ou démarrez-en une.
          </div>
        ) : (
          <>
            <div className="border-b border-ligne px-5 py-3">
              <p className="font-titre text-lg font-600 text-encre">{sel.titre}</p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {fil.length === 0 && (
                <p className="py-8 text-center font-corps text-sm text-encreDoux">
                  Démarrez la conversation ci-dessous.
                </p>
              )}
              {fil.map((m) => {
                const moi = m.expediteur_id === uid;
                return (
                  <div key={m.id} className={`flex ${moi ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 font-corps text-sm ${
                        moi ? "bg-brique text-creme" : "bg-creme text-encre"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.contenu}</p>
                      <p className={`mt-1 text-[10px] ${moi ? "text-creme/70" : "text-encreDoux"}`}>
                        {quand(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>
            {erreurEnvoi && (
              <p className="border-t border-ligne px-3 pt-2 font-corps text-xs text-red-600">
                {erreurEnvoi}
              </p>
            )}
            <div className="flex items-end gap-2 border-t border-ligne p-3">
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    envoyer();
                  }
                }}
                rows={2}
                placeholder="Votre message…"
                className="flex-1 resize-none rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
              />
              <button
                onClick={envoyer}
                disabled={!texte.trim() || envoi}
                className="rounded-full bg-brique px-5 py-2.5 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
