import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const exposants = JSON.parse(readFileSync(join(root, "data", "exposants.json"), "utf8"));

const JOURS = { mardi: "2026-09-15", mercredi: "2026-09-16", jeudi: "2026-09-17" };
const q = (s) => (s === null || s === undefined || s === "" ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const qi = (n) => (n === null || n === undefined ? "null" : String(parseInt(n, 10)));

let out = `-- =====================================================================
--  Seed exposants — liste RÉELLE des inscrits (généré par scripts/gen-seed.mjs)
--  SÉCURITÉ : aucun e-mail réel. Tous les contacts = martin@togezer.travel.
--  NE PAS éditer à la main.
-- =====================================================================
begin;

delete from engagements;
delete from exposant_destinations;
delete from presences;
delete from exposants;

insert into dejeuner_config (jour, capacite) values
  ('2026-09-15', 20), ('2026-09-16', 20), ('2026-09-17', 20)
on conflict (jour) do update set capacite = excluded.capacite;

`;

for (const e of exposants) {
  out += `-- ${e.nom}\n`;
  out += `insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), ${q(e.slug)}, ${q(e.nom)}, ${q(e.pays_principal)}, ${q(e.continent_principal)}, ${q(e.description)}, ${q("/logos/" + e.slug + ".svg")}, ${q(e.email_contact)}, ${q(e.contact_nom)}, ${q(e.whatsapp)}, ${qi(e.nb_personnes)}, ${q(e.notes)}, ${q(e.representant)});\n`;

  for (const d of e.destinations_secondaires || []) {
    out += `insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = ${q(e.slug)}), ${q(d.pays)}, ${q(d.continent)});\n`;
  }

  for (const [jourNom, iso] of Object.entries(JOURS)) {
    const p = e.presences[jourNom];
    if (!p || p.formule === "absent") continue;
    out += `insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = ${q(e.slug)}), '${iso}', '${p.formule}');\n`;
  }
  out += "\n";
}

out += "commit;\n";

writeFileSync(join(root, "supabase", "seed.sql"), out, "utf8");
console.log(`seed écrit (${exposants.length} exposants) → supabase/seed.sql`);
