import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const exposants = JSON.parse(readFileSync(join(root, "data", "exposants.json"), "utf8"));

// Monogramme : 1 à 2 lettres tirées du nom commercial
function initials(nom) {
  const words = nom.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function darken(hex, f = 0.75) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

for (const e of exposants) {
  const c1 = e.couleur;
  const txt = initials(e.nom);
  // Monogramme lisible : fond crème, filet + initiales dans la couleur du DMC.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${e.nom}">
  <rect x="4" y="4" width="152" height="152" rx="28" fill="#FBF7EE" stroke="${c1}" stroke-width="4"/>
  <text x="80" y="82" dy=".35em" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="66" font-weight="700" fill="${c1}" letter-spacing="1">${txt}</text>
</svg>`;
  const out = join(root, "public", "logos", `${e.slug}.svg`);
  writeFileSync(out, svg, "utf8");
  console.log("logo:", `${e.slug}.svg`, "→", txt);
}
console.log(`\n${exposants.length} logos générés.`);
