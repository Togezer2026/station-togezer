import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const CSV = "/Users/martinhuard/Downloads/Inscription La Station TogeZer - Top Resa 2026-Vue générale (3).csv";

// --- Parseur CSV RFC4180 (gère guillemets + retours ligne dans les champs) ---
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => (s ?? "").replace(/​/g, "").replace(/\s+/g, " ").trim();

function slugify(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function mapFormule(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("journ")) return "journee";
  if (v.includes("biz")) return "biz_biz";
  if (v.includes("petit") || v.includes("dej") || v.includes("déj")) return "petits_dej";
  return "absent";
}

const CONTINENTS = [
  [/tanzanie|namibie|alg[eé]rie|s[eé]n[eé]gal|madagascar|cap.?vert|mozambique|zambie|zimbabwe|botswana|zanzibar|maroc/i, "Afrique"],
  [/indon[eé]sie|sri.?lanka|maldives|vietnam|philippines|tha[iï]lande|chine|\binde\b|japon|oman|indo\b/i, "Asie"],
  [/allemagne|autriche|grande.?bretagne|angleterre|irlande|suisse|gr[eè]ce|balkans|croatie|slov[eé]nie|mont[eé]n[eé]gro|bosnie|herz[eé]govine|albanie|mac[eé]doine|kosovo/i, "Europe"],
  [/usa|[eé]tats.?unis|canada|bahamas|p[eé]rou|\bperu\b|chili|dominicaine|argentine|altiplano|bolivie|br[eé]sil|[eé]quateur|equateur|galapagos|guatemala|belize|mexique|nicaragua/i, "Amériques"],
  [/australie/i, "Océanie"],
];
const continentOf = (t) => { for (const [re, c] of CONTINENTS) if (re.test(t)) return c; return "Autre"; };

const palette = ["#8C3A2F","#B0503C","#C1902F","#4E827D","#93A079","#6B7A8F","#9C5518","#7A5C8E","#4F7A52","#A34A5E"];

// --- Curation manuelle : destinations propres (le formulaire d'inscription
//     était en texte libre). Clé = slug. p = [pays, continent] principal,
//     s = destinations secondaires. nom = correction éventuelle du nom. ---
const AF = "Afrique", AS = "Asie", EU = "Europe", AM = "Amériques", OC = "Océanie";
const CURATION = {
  "serengeti-big-cats-safaris": { p: ["Tanzanie", AF], s: [] },
  "african-eagle-namibie": { p: ["Namibie", AF], s: [] },
  "algerie-tours": { nom: "Algérie Tours", p: ["Algérie", AF], s: [] },
  "archipel-contact": { nom: "Archipel Contact", p: ["Indonésie", AS], s: [] },
  "atypique-indonesie": { p: ["Indonésie", AS], s: [] },
  "atypique-voyages": { p: ["Sri Lanka", AS], s: [["Maldives", AS], ["Vietnam", AS], ["Philippines", AS]] },
  "bretzel-travel-gmbh": { p: ["Allemagne", EU], s: [["Autriche", EU]] },
  "brightside-travel-ltd": { p: ["Grande-Bretagne", EU], s: [["Irlande", EU]] },
  "contact-voyages-senegal": { nom: "Contact Voyages Sénégal", p: ["Sénégal", AF], s: [] },
  "elite-american-voyages": { nom: "Elite American Voyages", p: ["États-Unis", AM], s: [["Canada", AM], ["Bahamas", AM]] },
  "escapades-madagascar": { p: ["Madagascar", AF], s: [] },
  "evasion-tropicale": { p: ["Philippines", AS], s: [] },
  "go-beyond": { p: ["Thaïlande", AS], s: [["Vietnam", AS], ["Chine", AS], ["Sri Lanka", AS]] },
  "mai-globe-travels": { p: ["Sri Lanka", AS], s: [["Vietnam", AS]] },
  "mozsensations": { p: ["Mozambique", AF], s: [["Zambie", AF], ["Zimbabwe", AF]] },
  "phima-voyages": { p: ["Pérou", AM], s: [] },
  "pura-vida-cabo-verde": { p: ["Cap-Vert", AF], s: [] },
  "senses-of-siam": { p: ["Thaïlande", AS], s: [] },
  "shanti-travel": { p: ["Inde", AS], s: [["Indonésie", AS], ["Japon", AS], ["Sri Lanka", AS], ["Vietnam", AS], ["Philippines", AS]] },
  "sikiliza": { p: ["Zimbabwe", AF], s: [["Botswana", AF]] },
  "swiss-travel-tour": { p: ["Suisse", EU], s: [] },
  "tanganyika-expeditions": { p: ["Tanzanie", AF], s: [["Zanzibar", AF]] },
  "terra-australia": { p: ["Australie", OC], s: [] },
  "terra-balka": { p: ["Balkans", EU], s: [["Croatie", EU], ["Slovénie", EU], ["Monténégro", EU], ["Bosnie-Herzégovine", EU], ["Albanie", EU], ["Macédoine", EU], ["Kosovo", EU]] },
  "terra-chile": { p: ["Chili", AM], s: [] },
  "terra-dominicana": { p: ["République Dominicaine", AM], s: [] },
  "terra-gaia-altiplano": { nom: "Terra Gaïa Altiplano", p: ["Argentine", AM], s: [] },
  "terra-gaia-argentina": { nom: "Terra Gaïa Argentina", p: ["Argentine", AM], s: [] },
  "terra-gaia-bolivia": { p: ["Bolivie", AM], s: [] },
  "terra-gaia-brazil": { nom: "Terra Gaïa Brazil", p: ["Brésil", AM], s: [] },
  "terra-gaia-ecuador-galapagos": { p: ["Équateur", AM], s: [["Galápagos", AM]] },
  "terra-guatemala": { p: ["Guatemala", AM], s: [["Belize", AM]] },
  "terra-maya": { p: ["Mexique", AM], s: [] },
  "terra-morocco": { nom: "Terra Morocco", p: ["Maroc", AF], s: [] },
  "terra-nicaragua": { p: ["Nicaragua", AM], s: [] },
  "terra-peru": { p: ["Pérou", AM], s: [] },
  "tierra-latina-argentine-bresil": { nom: "Tierra Latina", p: ["Argentine", AM], s: [["Brésil", AM], ["Mexique", AM]] },
  "viasuntours": { p: ["Grèce", EU], s: [] },
  "wakiy-tour": { p: ["Équateur", AM], s: [] },
  "xplore": { p: ["Mexique", AM], s: [["Oman", AS], ["Brésil", AM], ["Indonésie", AS]] },
};

const raw = readFileSync(CSV, "utf8");
const rows = parseCSV(raw).slice(1).filter((r) => clean(r[0])); // sans en-tête + lignes vides

const exposants = [];
const seen = new Set();
rows.forEach((r, idx) => {
  let nom = clean(r[0]);
  let representant = null;
  const mm = nom.match(/^\(([^)]+)\)\s*(.+)$/); // ex. "(Mathilde) SERENGETI..."
  if (mm) { representant = /mathilde/i.test(mm[1]) ? "Mathilde Quéva" : clean(mm[1]); nom = clean(mm[2]); }
  // Casse plus douce pour les noms tout-majuscules
  if (nom === nom.toUpperCase()) nom = nom.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  let slug = slugify(nom) || `dmc-${idx}`;
  while (seen.has(slug)) slug += "-" + idx;
  seen.add(slug);

  // Destinations : curation manuelle si disponible, sinon découpe auto
  let paysPrincipal, continentPrincipal, secondaires;
  const cur = CURATION[slug];
  if (cur) {
    if (cur.nom) nom = cur.nom;
    paysPrincipal = cur.p[0];
    continentPrincipal = cur.p[1];
    secondaires = cur.s.map(([pays, continent]) => ({ pays, continent }));
  } else {
    let destRaw = clean(r[1]).replace(/moz zam zim/i, "Mozambique, Zambie, Zimbabwe");
    const tokens = destRaw.split(/[,\n/()]+/).map((s) => clean(s)).filter(Boolean);
    paysPrincipal = tokens[0] || "—";
    continentPrincipal = continentOf(paysPrincipal);
    if (continentPrincipal === "Autre") continentPrincipal = continentOf(destRaw);
    secondaires = tokens.slice(1).map((p) => ({ pays: p, continent: continentOf(p) === "Autre" ? continentPrincipal : continentOf(p) }));
  }
  const descDest = [paysPrincipal, ...secondaires.map((d) => d.pays)].join(", ");

  const presences = {
    mardi: { formule: mapFormule(r[3]) },
    mercredi: { formule: mapFormule(r[4]) },
    jeudi: { formule: mapFormule(r[5]) },
  };

  const notes = [clean(r[10]), clean(r[11])].filter((s) => s && s !== "N/A" && s !== "/" && s.toLowerCase() !== "ras").join(" — ");

  exposants.push({
    slug,
    nom,
    // SÉCURITÉ : aucun vrai e-mail. Tout est redirigé vers Martin pour la phase de test.
    email_contact: "martin@togezer.travel",
    pays_principal: paysPrincipal,
    continent_principal: continentPrincipal,
    destinations_secondaires: secondaires,
    description: descDest,
    contact_nom: clean(r[7]) || null,
    whatsapp: clean(r[9]) || null,
    nb_personnes: parseInt(clean(r[2]), 10) || null,
    notes: notes || null,
    representant,
    couleur: palette[idx % palette.length],
    presences,
  });
});

writeFileSync(join(root, "data", "exposants.json"), JSON.stringify(exposants, null, 2), "utf8");
console.log(`${exposants.length} exposants réels écrits → data/exposants.json`);
console.log("Aperçu :", exposants.slice(0, 3).map((e) => `${e.nom} (${e.pays_principal}/${e.continent_principal})`).join(" · "));
