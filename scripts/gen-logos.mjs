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
  const c2 = darken(c1, 0.7);
  const txt = initials(e.nom);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${e.nom}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="32" fill="url(#g)"/>
  <text x="80" y="80" dy=".35em" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700" fill="#ffffff" letter-spacing="1">${txt}</text>
</svg>`;
  const out = join(root, "public", "logos", `${e.slug}.svg`);
  writeFileSync(out, svg, "utf8");
  console.log("logo:", `${e.slug}.svg`, "→", txt);
}
console.log(`\n${exposants.length} logos générés.`);
