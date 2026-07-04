// Créneaux du matin : 09h00 → 12h40, toutes les 20 minutes (12 créneaux).
export const CRENEAUX_MATIN: string[] = (() => {
  const out: string[] = [];
  for (let m = 9 * 60; m <= 12 * 60 + 40; m += 20) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
})();

// Créneaux de l'après-midi : 14h00 → 17h30, toutes les 30 minutes (8 créneaux).
export const CRENEAUX_APREM: string[] = (() => {
  const out: string[] = [];
  for (let m = 14 * 60; m <= 17 * 60 + 30; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
})();

// "09:00" -> "9h00"
export function affiche(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${parseInt(h, 10)}h${m}`;
}

// Normalise un timestamp SQL/ISO en "YYYY-MM-DD HH:MM"
export function normDebut(ts: string): string {
  return ts.replace("T", " ").slice(0, 16);
}
