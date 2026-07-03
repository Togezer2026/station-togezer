# La Station TogeZer — outil meet & match

Plateforme de prise de rendez-vous B2B (agents de voyage ↔ réceptifs) pour l'IFTM Top Resa — **15, 16 & 17 septembre 2026**.

## Stack
- **Next.js 15** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** (Postgres + Auth + RLS + Realtime)
- **Resend** (e-mails depuis `hello@togezer.travel`) — palier 6
- Génération **.ics** — palier 6

## Le cœur : zéro double-booking (garanti par la base)
Tous les rendez-vous vivent dans la table `engagements`, avec un créneau daté (`plage tsrange`).
Deux **contraintes d'exclusion Postgres** suffisent à interdire tout chevauchement :

1. `engagements_agent_no_overlap` — un agent ne peut avoir deux engagements confirmés qui se chevauchent (matin, après-midi, présentation, déjeuner validé confondus).
2. `engagements_resource_no_overlap` — une **ressource** (réceptif *ou* groupe) ne peut recevoir deux RDV simultanés.

La ressource d'une fiche regroupée est l'`id du groupe` : réserver 9h00 sur l'Islande occupe
mécaniquement le 9h00 du Maroc et de la Tanzanie (**blocage croisé Mathilde**, générique).
Les écritures passent **exclusivement** par des fonctions `SECURITY DEFINER` (`reserver_rdv`, …) :
aucune écriture directe depuis le client.

## Structure
```
src/app/            Pages (public, annuaire, inscription, espaces)
supabase/migrations/  0001 schéma+contraintes · 0002 RLS · 0003 fonctions
supabase/seed.sql   8 exposants de test (généré depuis data/exposants.json)
data/exposants.json Jeu de données factice (descriptions + destinations multiples)
scripts/            gen-logos.mjs · gen-seed.mjs
public/logos/       Logos factices (SVG)
```

## Démarrer en local
```bash
npm install
cp .env.local.example .env.local   # remplir les clés Supabase
npm run dev                         # http://localhost:5192
```

## Brancher Supabase (projet TogeZer)
1. Créer le projet Supabase (organisation TogeZer, `martin@togezer.travel`).
2. Appliquer les migrations dans l'ordre : `0001` → `0002` → `0003` (SQL Editor).
3. Charger `supabase/seed.sql` pour les 8 exposants de test.
4. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env.local`.

Régénérer données de test : `npm run gen:logos && node scripts/gen-seed.mjs`.

## Plan par paliers
0. **Socle** — scaffold + schéma + contraintes + seed ✅
1. Page publique + annuaire filtrable + inscription agent
2. Moteur de créneaux + tests de concurrence (anti-conflit prouvé)
3. Prise de RDV agent + espaces perso
4. Regroupements (Mathilde)
5. Présentations + déjeuner curé
6. E-mails (7) + .ics
7. Messagerie
8. Admin + exports
9. Recette (17 scénarios) + simulation
