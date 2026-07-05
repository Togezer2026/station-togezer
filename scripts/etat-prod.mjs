// Vérifie quelles migrations sont réellement appliquées dans la base,
// en testant l'existence des fonctions/tables clés. LECTURE SEULE.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Charge .env.local à la main (pas de dépendance dotenv)
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Chaque sonde : appel RPC (ou lecture table) → "absent" si PGRST202 / relation inexistante.
const SONDES = [
  ["0003 reserver_rdv", () => svc.rpc("reserver_rdv", { p_exposant_id: "00000000-0000-0000-0000-000000000000", p_debut: "2026-09-15 09:00:00" })],
  ["0007 definir_jours_agent", () => svc.rpc("definir_jours_agent", { p_jours: [] })],
  ["0008 creneaux_occupes", () => svc.rpc("creneaux_occupes", { p_exposant_id: "00000000-0000-0000-0000-000000000000", p_jour: "2026-09-15" })],
  ["0009/0015 admin_rendez_vous", () => svc.rpc("admin_rendez_vous")],
  ["0010 (index un RDV/réceptif)", () => svc.rpc("reserver_rdv", { p_exposant_id: "00000000-0000-0000-0000-000000000000", p_debut: "2026-09-15 09:00:00" })],
  ["0011 valider_engagement", () => svc.rpc("valider_engagement")],
  ["0012 receptif_rendez_vous", () => svc.rpc("receptif_rendez_vous")],
  ["0013 annuler_mes_rdv", () => svc.rpc("annuler_mes_rdv")],
  ["0014 basculer_creneau", () => svc.rpc("basculer_creneau", { p_jour: "2026-09-15", p_hhmm: "09:00" })],
  ["0015 deplacer_rdv", () => svc.rpc("deplacer_rdv", { p_id: "00000000-0000-0000-0000-000000000000", p_nouveau_debut: "2026-09-15 09:00:00" })],
  ["0016 admin_creer_rdv", () => svc.rpc("admin_creer_rdv", { p_agent_id: "00000000-0000-0000-0000-000000000000", p_exposant_id: "00000000-0000-0000-0000-000000000000", p_debut: "2026-09-15 09:00:00" })],
  ["0017 receptif_agents", () => svc.rpc("receptif_agents")],
  ["0017 creneaux_agent", () => svc.rpc("creneaux_agent", { p_agent_id: "00000000-0000-0000-0000-000000000000" })],
  ["0017 receptif_reserver_agent", () => svc.rpc("receptif_reserver_agent", { p_agent_id: "00000000-0000-0000-0000-000000000000", p_debut: "2026-09-15 09:00:00" })],
  ["0018 table messages", () => svc.from("messages").select("id", { count: "exact", head: true })],
  ["0018 mes_conversations", () => svc.rpc("mes_conversations")],
  ["0018 envoyer_message", () => svc.rpc("envoyer_message", { p_agent_id: "00000000-0000-0000-0000-000000000000", p_exposant_id: "00000000-0000-0000-0000-000000000000", p_contenu: "" })],
];

for (const [nom, run] of SONDES) {
  const { error } = await run();
  // Fonction absente → code PGRST202 (ou message "Could not find the function").
  const absent =
    error &&
    (error.code === "PGRST202" ||
      /could not find|does not exist/i.test(error.message ?? ""));
  console.log(`${absent ? "❌ ABSENT " : "✅ présent"}  ${nom}${error && !absent ? `   (répond : ${String(error.message).slice(0, 60)})` : ""}`);
}
