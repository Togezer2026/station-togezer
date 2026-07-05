// =====================================================================
//  Tests d'intégration des règles vitales (anti double-booking & co).
//  Crée des comptes/fiches ZZ-TEST isolés, vérifie 10 règles, nettoie tout.
//  Usage : node scripts/test-regles.mjs
// =====================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const svc = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = () =>
  createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const MDP = "ZZtest-2026!aa";
const A1 = "zz-test-agent1@example.com";
const A2 = "zz-test-agent2@example.com";
const R1 = "zz-test-receptif@example.com";
const J15 = "2026-09-15";
const J16 = "2026-09-16";

let nbOk = 0, nbKo = 0;
function verdict(nom, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${nom}${detail ? `  — ${detail}` : ""}`);
  ok ? nbOk++ : nbKo++;
}

// ---------- Nettoyage (avant ET après, pour être rejouable) ----------
async function nettoyer() {
  for (const email of [A1, A2, R1]) {
    const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const u = data?.users?.find((x) => x.email === email);
    if (u) await svc.auth.admin.deleteUser(u.id); // cascade profiles/agents/engagements
  }
  await svc.from("exposants").delete().like("slug", "zz-test-%"); // cascade presences/engagements/messages
}

async function main() {
  await nettoyer();

  // ---------- Décor : 2 agents, 1 réceptif avec 2 fiches ----------
  const mkAgent = async (email, prenom) => {
    const { data, error } = await svc.auth.admin.createUser({
      email, password: MDP, email_confirm: true,
      user_metadata: { agence: `ZZ-TEST Agence ${prenom}`, ville: "Testville", prenom, nom: "ZZTEST" },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    return data.user.id;
  };
  const agent1 = await mkAgent(A1, "Alice");
  const agent2 = await mkAgent(A2, "Bruno");

  const { data: ru, error: re } = await svc.auth.admin.createUser({
    email: R1, password: MDP, email_confirm: true,
  });
  if (re) throw new Error(`createUser receptif: ${re.message}`);
  const receptifUid = ru.user.id;
  await svc.from("profiles").upsert({ id: receptifUid, role: "receptif", email: R1 });

  const mkExpo = async (slug, nom, proprietaire) => {
    const { data, error } = await svc
      .from("exposants")
      .insert({ slug, nom, pays_principal: "Testland", continent_principal: "Zztest", proprietaire_id: proprietaire })
      .select("id").single();
    if (error) throw new Error(`exposant ${slug}: ${error.message}`);
    return data.id;
  };
  const expo1 = await mkExpo("zz-test-expo1", "ZZ-TEST Réceptif 1", receptifUid);
  const expo2 = await mkExpo("zz-test-expo2", "ZZ-TEST Réceptif 2", null);
  // expo1 : Journée le 15, Petit-déj le 16. expo2 : Journée le 15.
  await svc.from("presences").insert([
    { exposant_id: expo1, jour: J15, formule: "journee" },
    { exposant_id: expo1, jour: J16, formule: "petits_dej" },
    { exposant_id: expo2, jour: J15, formule: "journee" },
  ]);

  // Connexions
  const login = async (email) => {
    const c = anonClient();
    const { error } = await c.auth.signInWithPassword({ email, password: MDP });
    if (error) throw new Error(`login ${email}: ${error.message}`);
    return c;
  };
  const cA1 = await login(A1);
  const cA2 = await login(A2);
  const cR1 = await login(R1);

  await cA1.rpc("definir_jours_agent", { p_jours: [J15, J16] });
  await cA2.rpc("definir_jours_agent", { p_jours: [J15, J16] });

  const rdv = (c, expo, debut) => c.rpc("reserver_rdv", { p_exposant_id: expo, p_debut: debut });

  // ---------- Les 10 règles ----------
  // R1 : réservation nominale
  const t1 = await rdv(cA1, expo1, `${J15} 09:00:00`);
  verdict("R1  Réservation d'un créneau libre", !t1.error, t1.error?.message);

  // R2 : deux agents, même réceptif, même créneau → refus (anti double-booking ressource)
  const t2 = await rdv(cA2, expo1, `${J15} 09:00:00`);
  verdict("R2  Double-booking du réceptif refusé", !!t2.error, t2.error ? "" : "ACCEPTÉ À TORT");

  // R3 : un seul RDV par couple agent↔réceptif
  const t3 = await rdv(cA1, expo1, `${J15} 09:20:00`);
  verdict("R3  Second RDV avec le même réceptif refusé", !!t3.error, t3.error ? "" : "ACCEPTÉ À TORT");

  // R4 : agent déjà pris à cette heure avec un autre réceptif → refus (anti double-booking agent)
  const t4 = await rdv(cA1, expo2, `${J15} 09:00:00`);
  verdict("R4  Double-booking de l'agent refusé", !!t4.error, t4.error ? "" : "ACCEPTÉ À TORT");

  // R5 : après-midi autorisé si formule Journée
  const t5 = await rdv(cA1, expo2, `${J15} 14:00:00`);
  verdict("R5  Après-midi accepté (Pass Journée)", !t5.error, t5.error?.message);

  // R6 : après-midi refusé si formule petit-déj
  const t6 = await rdv(cA2, expo1, `${J16} 14:00:00`);
  verdict("R6  Après-midi refusé (formule petit-déj)", !!t6.error, t6.error ? "" : "ACCEPTÉ À TORT");

  // R7 : annuler libère le créneau pour un autre agent
  const { data: mesE } = await cA1.rpc("mes_engagements");
  const rdv9h = (mesE ?? []).find((e) => e.exposant_id === expo1);
  await cA1.rpc("annuler_engagement", { p_id: rdv9h?.id, p_message: null });
  const t7 = await rdv(cA2, expo1, `${J15} 09:00:00`);
  verdict("R7  Annulation → créneau libéré et re-réservable", !!rdv9h && !t7.error, t7.error?.message);

  // R8 : retirer un jour annule les RDV de ce jour
  await cA1.rpc("definir_jours_agent", { p_jours: [J16] });
  const { data: apres } = await cA1.rpc("mes_engagements");
  verdict("R8  Jour retiré → RDV du jour annulés", (apres ?? []).every((e) => e.jour !== J15));

  // R9 : messagerie aller-retour + cloisonnement
  const m1 = await cA2.rpc("envoyer_message", { p_agent_id: agent2, p_exposant_id: expo1, p_contenu: "Bonjour ZZ-TEST" });
  const filR = await cR1.rpc("fil", { p_agent_id: agent2, p_exposant_id: expo1 });
  const lu = (filR.data ?? []).some((m) => m.contenu === "Bonjour ZZ-TEST");
  const filIntrus = await cA1.rpc("fil", { p_agent_id: agent2, p_exposant_id: expo1 });
  const cloisonne = (filIntrus.data ?? []).length === 0;
  verdict("R9  Chat : envoi lu par le réceptif, illisible par un tiers", !m1.error && lu && cloisonne,
    m1.error?.message ?? (!lu ? "message non lu" : !cloisonne ? "FUITE : un tiers lit le fil" : ""));

  // R10 : usurpation refusée (un agent ne peut écrire au nom d'un autre)
  const t10 = await cA1.rpc("envoyer_message", { p_agent_id: agent2, p_exposant_id: expo1, p_contenu: "usurpation" });
  verdict("R10 Chat : écrire au nom d'un autre agent refusé", !!t10.error, t10.error ? "" : "ACCEPTÉ À TORT");

  await nettoyer();
  console.log(`\n${nbKo === 0 ? "🎉" : "💥"} ${nbOk}/${nbOk + nbKo} règles vérifiées${nbKo ? ` — ${nbKo} ÉCHEC(S)` : ""}`);
  process.exit(nbKo === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erreur du banc de test :", e.message);
  await nettoyer().catch(() => {});
  process.exit(1);
});
