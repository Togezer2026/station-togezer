// Les 3 jours de l'événement — source unique de vérité.
export const JOURS = [
  { iso: "2026-09-15", label: "Mardi 15", court: "Mar", courtDate: "Mar 15" },
  { iso: "2026-09-16", label: "Mercredi 16", court: "Mer", courtDate: "Mer 16" },
  { iso: "2026-09-17", label: "Jeudi 17", court: "Jeu", courtDate: "Jeu 17" },
] as const;

export type JourIso = (typeof JOURS)[number]["iso"];

export function labelJour(iso: string): string {
  return JOURS.find((j) => j.iso === iso)?.label ?? iso;
}

export const FORMULE_LABEL: Record<string, string> = {
  petits_dej: "Pass Petits-Déj",
  biz_biz: "Pass BiZ-BiZ",
  journee: "Pass Journée",
  absent: "Absent",
};
