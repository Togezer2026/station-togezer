import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const exposants = JSON.parse(readFileSync(join(root, "data", "exposants.json"), "utf8"));

const JOURS = { mardi: "2026-09-15", mercredi: "2026-09-16", jeudi: "2026-09-17" };
const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);

let out = `-- =====================================================================
--  Seed de test — 8 exposants factices (dont le groupe « Table Mathilde Quéva »)
--  Généré par scripts/gen-seed.mjs — NE PAS éditer à la main.
-- =====================================================================
begin;

-- Réinitialisation des données de test (idempotent)
delete from engagements;
delete from exposant_destinations;
delete from presences;
delete from exposants;
delete from groupes;

-- Capacité déjeuner (globale par jour) — à ajuster par l'admin
insert into dejeuner_config (jour, capacite) values
  ('2026-09-15', 20), ('2026-09-16', 20), ('2026-09-17', 20)
on conflict (jour) do update set capacite = excluded.capacite;

`;

// Groupes uniques
const groupes = [...new Set(exposants.filter((e) => e.groupe).map((e) => e.groupe))];
for (const g of groupes) {
  out += `insert into groupes (id, nom) values (gen_random_uuid(), ${q(g)});\n`;
}
out += "\n";

for (const e of exposants) {
  const groupeExpr = e.groupe
    ? `(select id from groupes where nom = ${q(e.groupe)})`
    : "null";
  out += `-- ${e.nom}\n`;
  out += `insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), ${q(e.slug)}, ${q(e.nom)}, ${q(e.pays_principal)}, ${q(e.continent_principal)}, ${q(e.description)}, ${q("/logos/" + e.slug + ".svg")}, ${q(e.email_contact)}, ${groupeExpr});\n`;

  for (const d of e.destinations_secondaires || []) {
    out += `insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = ${q(e.slug)}), ${q(d.pays)}, ${q(d.continent)});\n`;
  }

  for (const [jourNom, iso] of Object.entries(JOURS)) {
    const p = e.presences[jourNom];
    if (!p || p.formule === "absent") continue;
    out += `insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = ${q(e.slug)}), '${iso}', '${p.formule}', ${p.presentation ? "true" : "false"}, ${q(p.theme || null)});\n`;
  }
  out += "\n";
}

out += "commit;\n";

const dest = join(root, "supabase", "seed.sql");
writeFileSync(dest, out, "utf8");
console.log("seed écrit →", dest, `(${out.length} octets)`);
