# Dossier technique — « La Station TogeZer »

> Application « meet & match » de prise de rendez-vous pour un salon B2B de 3 jours
> (agents de voyage ↔ réceptifs / DMC), édition **15-16-17 septembre 2026**, à **Voie 15, Paris**.
> Document auto-suffisant destiné à préparer la fusion avec un Hub interne existant
> (Next.js App Router / TypeScript / Prisma-PostgreSQL / auth maison / emails / Vercel).
>
> **Rédigé le 6 juillet 2026. Aucun secret en clair : les valeurs sensibles sont `<masqué>`.**

---

## 0. Livrable 2 — Accès direct au code

- **Dépôt GitHub (PUBLIC)** : `https://github.com/Togezer2026/station-togezer`
  - owner/repo : **`Togezer2026/station-togezer`**, branche par défaut **`main`**.
  - Statut vérifié : HTTP 200 (public, clonable sans authentification).
- **Ce dossier lui-même** est versionné à la racine du dépôt : `DOSSIER_TECHNIQUE.md`.
- Rien à provisionner pour lire le code : `git clone https://github.com/Togezer2026/station-togezer`.
- Le back-end (base + fonctions) vit dans **Supabase** ; toute la logique SQL est dans
  `supabase/migrations/*.sql` (versionnée, verbatim plus bas). L'état réellement appliqué
  en production est tracé dans `supabase/PROD_STATE.md`.

> Note comptes : le dépôt est sous l'organisation GitHub **Togezer2026** (univers TogeZer),
> distincte du compte perso du propriétaire. Le projet Supabase et le projet Vercel sont
> également sous l'univers TogeZer.

---

## 1. Stack complète

| Couche | Technologie | Version / détail |
|---|---|---|
| Framework | **Next.js** (App Router) | `^15.5.20` (React `19.0.0`, react-dom `19.0.0`) |
| Langage | **TypeScript** | `^5.7.3`, `strict: true` |
| Styles | **Tailwind CSS** v3 | `^3.4.17` + `postcss` `^8.4.49` + `autoprefixer` `^10.4.20` |
| Base de données | **PostgreSQL** (managé par **Supabase**) | extensions `btree_gist`, `pgcrypto` |
| Accès DB / Auth / Realtime | **Supabase** | `@supabase/supabase-js ^2.47.10`, `@supabase/ssr ^0.5.2` |
| Auth | **Supabase Auth** (email + mot de passe) | sessions par cookies (SSR), refresh via middleware |
| Emails | **Supabase Auth** (transactionnels : confirmation, reset). **Resend** prévu (non branché) | clé `RESEND_API_KEY=<masqué>` réservée |
| Stockage fichiers | **aucun** (pas de bucket) — les logos/photos sont des fichiers statiques dans `public/` | logos SVG générés, 3 photos `.png` du lieu |
| Hébergement | **Vercel** (front + API routes Next) | prod : `stationtogezer.vercel.app` |
| Polices | Google Fonts via `@import` CSS (pas `next/font`) | **Cormorant Garamond** (titres) + **Mulish** (corps) |
| Fonts build | chargées côté navigateur (évite l'échec de fetch `next/font` au build Vercel) | — |

**Il n'y a ni ORM ni Prisma ici** : l'app parle à Postgres **exclusivement via le client Supabase**
(REST/PostgREST + RPC vers des fonctions SQL `SECURITY DEFINER`). C'est le point de divergence
majeur avec le Hub cible (Prisma + auth maison) — voir §12.

**Dépendances (package.json)** — aucune librairie « lourde » : pas de state manager, pas de
librairie de dates, pas de composants UI tiers. Tout est fait main avec React + Tailwind.

### Variables d'environnement (`.env.local`, gitignored)

| Variable | Rôle | Valeur |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique (publishable `sb_publishable_…`) | `<masqué>` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role (serveur only, contourne RLS) | `<masqué>` |
| `RESEND_API_KEY` | e-mails Resend (réservé, non utilisé) | `<masqué>` |
| `NEXT_PUBLIC_SITE_URL` | URL publique (liens e-mails) | `https://stationtogezer.vercel.app` |

---

## 2. Modèle de données INTÉGRAL

Base PostgreSQL. Tout est créé par les migrations `supabase/migrations/0001…0020`.
Le **code SQL complet et verbatim** de chaque migration est en **§14 (annexe SQL)** ; ci-dessous
la synthèse table par table (état final, migrations cumulées).

### 2.1 Enums (types)

| Enum | Valeurs | Usage |
|---|---|---|
| `role_type` | `admin`, `receptif`, `agent`, `representant` | rôle d'un profil |
| `formule_type` | `absent`, `petits_dej`, `biz_biz`, `journee` | présence/formule d'un réceptif un jour donné |
| `engagement_kind` | `rdv_matin`, `rdv_aprem`, `presentation_hold`, `presentation_inscription`, `dejeuner` | nature d'un créneau réservé |
| `statut_type` | `confirme`, `en_attente`, `annule` | statut d'un engagement / d'une demande |

### 2.2 Tables

**`profiles`** — 1 ligne par utilisateur authentifié (adossé à `auth.users` de Supabase).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| role | role_type | non | — | admin / receptif / agent / representant |
| email | text | non | — | |
| full_name | text | oui | — | |
| created_at | timestamptz | non | now() | |

**`groupes`** — agenda partagé entre plusieurs réceptifs (cas « Mathilde », générique).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| nom | text | non | — | |
| representant_id | uuid | oui | — | FK → `profiles(id)` ON DELETE SET NULL |
| created_at | timestamptz | non | now() | |

**`exposants`** — les réceptifs / DMC (« exposants » en base, appelés « réceptifs » en UI).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| slug | text | non | — | **UNIQUE** |
| nom | text | non | — | |
| pays_principal | text | non | — | destination principale |
| continent_principal | text | non | — | |
| description | text | oui | — | |
| logo_path | text | oui | — | chemin statique ex. `/logos/xxx.svg` |
| email_contact | text | oui | — | (tous mis à `martin@togezer.travel` pour cette édition) |
| groupe_id | uuid | oui | — | FK → `groupes(id)` SET NULL (regroupement) |
| proprietaire_id | uuid | oui | — | FK → `profiles(id)` SET NULL (compte réceptif lié) |
| created_at | timestamptz | non | now() | |
| contact_nom | text | oui | — | *(0005)* représentant sur place |
| whatsapp | text | oui | — | *(0005)* |
| nb_personnes | int | oui | — | *(0005)* |
| notes | text | oui | — | *(0005)* notes internes admin |
| representant | text | oui | — | *(0005)* nom du représentant si regroupé |
| contact_photo | text | oui | — | *(0007)* photo du représentant |
| contact_bio | text | oui | — | *(0007)* bio du représentant |

**`exposant_destinations`** — destinations secondaires (un réceptif couvre souvent plusieurs pays).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| exposant_id | uuid | non | — | FK → `exposants(id)` ON DELETE CASCADE |
| pays | text | non | — | |
| continent | text | non | — | |

**`presences`** — présence + formule d'un réceptif, **par jour**.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| exposant_id | uuid | non | — | FK → `exposants(id)` CASCADE |
| jour | date | non | — | **CHECK ∈ {2026-09-15,16,17}** |
| formule | formule_type | non | `absent` | |
| tient_presentation | bool | non | false | ce réceptif anime une présentation |
| theme | text | oui | — | thème de la présentation |
| salle | text | oui | — | attribué par l'admin |
| presentation_debut | timestamptz | oui | — | attribué par l'admin |
| — | — | — | — | **UNIQUE (exposant_id, jour)** |

**`agents`** — les agents de voyage inscrits.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | — | PK, FK → `profiles(id)` CASCADE |
| agence | text | non | — | |
| prenom | text | non | — | |
| nom | text | non | — | |
| email | text | non | — | |
| telephone | text | oui | — | |
| created_at | timestamptz | non | now() | |
| ville | text | oui | — | *(0007)* ville de l'agence |
| engagement_at | timestamptz | oui | — | *(0011)* date où l'agent a validé son engagement |

**`agent_jours`** — jours de venue d'un agent.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| agent_id | uuid | non | — | FK → `agents(id)` CASCADE |
| jour | date | non | — | CHECK ∈ 3 dates |
| — | — | — | — | **PK (agent_id, jour)** |

**`dejeuner_config`** — capacité globale du déjeuner, par jour.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| jour | date | non | — | **PK**, CHECK ∈ 3 dates |
| capacite | int | non | 0 | |

**`demandes_dejeuner`** — positionnement d'un agent sur le déjeuner réseautage d'un jour.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| agent_id | uuid | non | — | FK → `agents(id)` CASCADE |
| jour | date | non | — | CHECK ∈ 3 dates |
| receptifs_souhaites | uuid[] | non | `{}` | souhaits (non bloquant, pour futur meet&match) |
| statut | statut_type | non | `en_attente` | |
| created_at | timestamptz | non | now() | |
| — | — | — | — | **UNIQUE (agent_id, jour)** |

**`engagements`** — ⭐ **table centrale** : tout créneau réservé (RDV matin/après-midi,
présentation, déjeuner) est une ligne ici. C'est le cœur anti-conflit.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| kind | engagement_kind | non | — | rdv_matin / rdv_aprem / presentation_* / dejeuner |
| agent_id | uuid | oui | — | FK → `agents(id)` CASCADE (null pour presentation_hold) |
| exposant_id | uuid | oui | — | FK → `exposants(id)` CASCADE |
| resource_id | uuid | oui | — | = `groupe_id` si regroupé, sinon `exposant_id` (clé anti-conflit ressource) |
| jour | date | non | — | CHECK ∈ 3 dates |
| plage | **tsrange** | non | — | créneau daté (jour + heure), sans fuseau |
| statut | statut_type | non | `confirme` | |
| message_annulation | text | oui | — | |
| created_at | timestamptz | non | now() | |

Contraintes anti-conflit (voir §7) :
- `engagements_agent_no_overlap` : `EXCLUDE USING gist (agent_id WITH =, plage WITH &&) WHERE (agent_id IS NOT NULL AND statut='confirme')`
- `engagements_resource_no_overlap` : `EXCLUDE USING gist (resource_id WITH =, plage WITH &&) WHERE (resource_id IS NOT NULL AND statut='confirme')`
- `uniq_agent_receptif_rdv` *(0010)* : `UNIQUE INDEX (agent_id, resource_id) WHERE kind IN ('rdv_matin','rdv_aprem') AND statut='confirme'` → **un seul RDV par couple agent↔réceptif sur tout l'événement**.

**`agent_creneaux_fermes`** *(0014)* — créneaux du matin qu'un agent a fermés (indispo).
Par défaut l'agenda de l'agent est OUVERT ; on ne stocke QUE les créneaux fermés.

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| agent_id | uuid | non | — | FK → `agents(id)` CASCADE |
| jour | date | non | — | CHECK ∈ 3 dates |
| hhmm | text | non | — | ex. "09:20" |
| — | — | — | — | **PK (agent_id, jour, hhmm)** |

> ⚠️ La **saisie** de ces créneaux fermés côté agent a été **retirée de l'UI** (section
> « Mes disponibilités » supprimée), mais la table et sa prise en compte par le réceptif
> (fonction `creneaux_agent`) **subsistent**. Voir §6 et §12.

**`messages`** *(0018)* — messagerie agent ↔ réceptif (1 conversation = 1 couple agent+réceptif).

| Champ | Type | Null | Défaut | Notes |
|---|---|---|---|---|
| id | uuid | non | gen_random_uuid() | PK |
| agent_id | uuid | non | — | FK → `agents(id)` CASCADE |
| exposant_id | uuid | non | — | FK → `exposants(id)` CASCADE |
| expediteur_id | uuid | non | — | uid de l'expéditeur (agent ou proprio réceptif) |
| contenu | text | non | — | **CHECK char_length ≤ 4000** *(0019)* |
| created_at | timestamptz | non | now() | |
| — | — | — | — | index `idx_msg_conv (agent_id, exposant_id, created_at)` |

### 2.3 Index

`idx_eng_agent(agent_id)`, `idx_eng_expo(exposant_id)`, `idx_eng_jour(jour)`,
`idx_pres_expo(exposant_id)`, `idx_dest_expo(exposant_id)`, `idx_msg_conv`,
`uniq_agent_receptif_rdv` (unique partiel).

### 2.4 Sécurité au niveau lignes (RLS) — principe

**Toutes les tables ont RLS activé.** Règle d'or : **aucune écriture directe d'engagement
depuis le client** — tout passe par des fonctions `SECURITY DEFINER` (RPC). Les policies
`SELECT` cloisonnent la lecture par rôle. Détail verbatim en §14 (0002_rls.sql, 0019).

- `profiles` : lecture = soi-même ou admin.
- `exposants` / `exposant_destinations` / `presences` / `groupes` : **lecture ouverte à tous**
  (annuaire public) ; écriture = admin uniquement.
- `agents` / `agent_jours` : lecture = soi-même ou admin ; update agent = soi-même.
- `engagements` : lecture = admin, ou l'agent concerné, ou le réceptif propriétaire, ou le
  représentant du groupe. **Aucune** policy insert/update/delete (passage par RPC obligatoire).
- `messages` : lecture = l'agent, le réceptif propriétaire, ou admin.
- `demandes_dejeuner` / `agent_creneaux_fermes` : lecture = soi-même ou admin.
- Depuis 0019 : `is_admin()` et `mes_groupes()` sont `SECURITY DEFINER` ; les RPC métier ne
  sont **plus exécutables par le rôle `anon`** (revoke), seulement `authenticated`.

---

## 3. Rôles & utilisateurs — parcours de A à Z

Quatre rôles (`role_type`). Trois sont réellement exploités : **admin**, **receptif**, **agent**.
Le 4ᵉ, **representant**, est prévu (agenda partagé « Mathilde ») mais géré via la colonne
`groupes.representant_id` plutôt que par un espace dédié distinct.

### 3.1 Agent de voyage (rôle `agent`) — le cœur de cible

C'est l'app **dédiée aux agents**. Parcours :

1. **Découverte** (`/`) : page d'accueil publique (programme, lieu, gratuité) + lien annuaire.
2. **Inscription** (`/inscription`) : agence, ville, prénom, nom, e-mail pro, téléphone (option), mot de passe.
   L'agent **ne choisit PAS de formule** (concept interne aux réceptifs).
   → `supabase.auth.signUp` avec métadonnées ; un **trigger** `handle_new_agent` crée
   automatiquement le `profiles(role=agent)` + la fiche `agents`. E-mail de confirmation envoyé.
3. **Confirmation e-mail** (`/auth/confirm`) : clic sur le lien → session établie → `/mon-espace`.
4. **Mon espace** (`/mon-espace`) : accueil connecté (billet de l'événement, compteur de RDV,
   résumé de ses infos avec lien « Modifier »).
5. **Prise de RDV** (`/reservation`) :
   - **Étape 1** : choisit ses **jours de venue** (`definir_jours_agent`).
   - **Étape 2** : « Mon programme » (timeline par jour) + réserve des créneaux avec les
     réceptifs présents sur ses jours + se positionne sur le **déjeuner réseautage** (13h-14h).
   - **Validation** : coche l'engagement d'honorer/annuler ses RDV (`valider_engagement`).
6. **Messagerie** (`/messages`) : échange avec les réceptifs.
7. **Mes informations** (`/mes-informations`) : édite agence/ville/prénom/nom/téléphone (pas l'e-mail).

Permissions agent : lit l'annuaire (public), lit/écrit **ses** engagements via RPC, lit **ses**
messages, ne voit jamais les RDV/messages d'un autre agent (RLS).

### 3.2 Réceptif / exposant (rôle `receptif`)

**Pas d'inscription publique** : l'admin crée le compte (`AccesReceptif`) et le lie à une fiche.

1. **Connexion** (`/connexion`) → redirigé vers `/espace-receptif`.
2. **Espace réceptif** (`/espace-receptif`) :
   - voit sa présence/formule par jour, la liste de **ses** rendez-vous (agents qui ont réservé),
   - **sollicite** des agents : « Solliciter un rendez-vous » — choisit une agence, voit les
     créneaux **communs** (présence réceptif ∩ jours agent ∩ dispo agent) et propose un RDV
     (`receptif_reserver_agent`),
   - **messagerie** avec les agents.

Permissions : lit sa fiche + les RDV pris sur sa fiche + ses messages ; réserve/annule via RPC.

### 3.3 Administrateur (rôle `admin`)

Compte unique (`martin@togezer.travel`), créé via `supabase/admin_bootstrap.sql`.
Accès au **back-office complet** `/admin/*`. Détail en §5.

### 3.4 Représentant regroupé (rôle `representant`)

Cas « Mathilde » : une même personne représente **plusieurs** réceptifs (Alkémia, Tamazirt,
Serengeti). Ces fiches partagent un `groupe_id` → même `resource_id` dans `engagements` →
**réserver un créneau sur l'une occupe mécaniquement le même créneau sur les autres**
(blocage croisé). La lecture de l'agenda partagé passe par `mes_groupes()` dans la RLS.

---

## 4. Routes & pages

Next.js App Router. `dynamic = "force-dynamic"` sur les pages qui lisent la session.
Un **middleware** (`src/middleware.ts`) rafraîchit la session Supabase à chaque requête.

| URL | Type | Accès | Rôle | Ce qu'on y fait |
|---|---|---|---|---|
| `/` | page publique | tous | — | Accueil (redirige vers l'espace si déjà connecté) |
| `/annuaire` | page publique | tous | — | Annuaire filtrable des réceptifs |
| `/inscription` | page | anonyme | — | Création de compte agent (redirige si connecté) |
| `/connexion` | page | anonyme | — | Connexion (redirige selon rôle si connecté) |
| `/auth/confirm` | route (GET) | — | — | Confirme l'e-mail (verifyOtp / exchangeCode) → redirige |
| `/auth/erreur` | page | — | — | Écran d'erreur de confirmation |
| `/nouveau-mot-de-passe` | page | lien reset | tous | Définit un nouveau mot de passe |
| `/mon-espace` | page | connecté | agent | Accueil connecté agent (billet, compteur, infos) |
| `/reservation` | page | connecté | agent | Choix jours + prise de RDV + déjeuner + validation |
| `/messages` | page | connecté | agent | Messagerie agent↔réceptif |
| `/mes-informations` | page | connecté | agent | Édition de ses coordonnées |
| `/espace-receptif` | page | connecté | receptif | RDV reçus + sollicitation agents + messagerie |
| `/admin` | page | connecté | **admin** | ⭐ Tableau de bord (KPIs, alertes, classements) |
| `/admin/receptifs` | page | admin | admin | Liste des réceptifs (présence/formule par jour) |
| `/admin/receptifs/nouveau` | page | admin | admin | Créer une fiche réceptif |
| `/admin/receptifs/[id]` | page | admin | admin | Éditer fiche + créer accès + gérer compte |
| `/admin/agents` | page | admin | admin | Liste des agents (édition, reset MDP, suppression) |
| `/admin/rendez-vous` | page | admin | admin | Tous les RDV : filtres, groupements, export CSV, suppression (masse) |
| `/admin/planning` | page | admin | admin | Planning glisser-déposer par réceptif/agence |

Server Actions (`"use server"`) : `admin/actions-users.ts` (reset MDP, suppression user,
édition agent), `admin/receptifs/actions.ts` (création de compte réceptif via service_role).

---

## 5. ⭐ LE DASHBOARD ADMINISTRATEUR (priorité absolue)

### 5.1 Philosophie & workflow servi

Le back-office est **une console d'exploitation d'événement**, pas un simple CRUD. Il est pensé
pour répondre aux questions qu'un organisateur se pose **pendant** la préparation et **le jour J** :

- « Où en est le remplissage ? » → KPIs + RDV par jour.
- « Qui est en danger / sous-exploité ? » → **alertes** (réceptifs sans RDV, agents sans RDV,
  réceptifs sans compte d'accès, **fiches incomplètes**) et **classement top/flop** des réceptifs.
- « Il faut que je bouge/crée/supprime un RDV » → vue Rendez-vous (filtrable, groupable,
  exportable, suppression en masse) **et** Planning **glisser-déposer** par participant.
- « Un réceptif/agent a un souci de compte » → reset MDP (génère un lien) + suppression.

Le fil conducteur : **partir des RDV confirmés** (données fiables garanties par la base) et en
dériver toutes les vues, plutôt que de recalculer un état fragile côté application. L'admin
**garde toujours la main** (les calculs sont des propositions modifiables), et **l'anti-conflit
reste garanti par la base** même quand l'admin déplace/crée un RDV manuellement.

Navigation (barre du haut, `admin/layout.tsx`) : **Tableau de bord · Réceptifs · Agents inscrits
· Rendez-vous · Planning**, + « Voir le site » + Déconnexion. La garde `requireAdmin()`
(redirige si non-admin) enveloppe **toutes** les pages `/admin/*`.

### 5.2 Écran « Tableau de bord » (`/admin`)

Blocs, dans l'ordre vertical :

1. **En-tête** : « Tableau de bord » + nom de l'admin.
2. **4 KPIs cliquables** (cartes) :
   - **Réceptifs** (→ `/admin/receptifs`),
   - **Agents inscrits** (→ `/admin/agents`),
   - **Rendez-vous confirmés** (→ `/admin/rendez-vous`),
   - **Déjeuners à valider** (compte `demandes_dejeuner` en `en_attente`, → `/admin/rendez-vous`,
     carte accentuée en brique si > 0).
3. **Rendez-vous par jour** : 3 barres horizontales proportionnelles (Mardi/Mercredi/Jeudi).
4. **Classements côte à côte** :
   - **Réceptifs les plus demandés** (top 6 par nombre de RDV),
   - **Réceptifs les moins demandés** (flop 6).
5. **Section « À suivre » — 4 alertes** (chaque carte affiche un compteur + liste scrollable + lien « Gérer ») :
   - **Réceptifs sans aucun RDV**,
   - **Agents inscrits sans RDV**,
   - **Réceptifs sans compte d'accès** (à activer),
   - **Fiches incomplètes** — une fiche est « 100 % complète » ssi elle a : description, logo,
     représentant (`contact_nom`), **photo** du représentant (`contact_photo`), **bio**
     (`contact_bio`), et au moins une présence. La carte liste, par réceptif, **ce qui manque**.

Logique : tout est calculé en Server Component à partir de `admin_rendez_vous()` (RPC) + lectures
directes `exposants`/`agents`/`demandes_dejeuner`. **Code verbatim ci-dessous** (`admin/page.tsx`).

### 5.3 Écran « Réceptifs » (`/admin/receptifs`)

Tableau : Nom (+ « (avec {représentant}) » si regroupé), Destination · continent, Contact,
puis **3 colonnes jour** (Mar/Mer/Jeu) affichant la **formule** prise sous forme de badge
**PD** (Petits-Déj) / **BB** (BiZ-BiZ) / **J** (Journée), ou « – » si absent. Légende en tête.
Bouton **« + Nouveau réceptif »**. Chaque ligne → « Éditer » vers `/admin/receptifs/[id]`.

### 5.4 Écran « Éditer un réceptif » (`/admin/receptifs/[id]` et `/nouveau`)

Trois blocs (composant `EditForm`) :
- **Fiche** : nom, destination principale, continent, description, contact (nom), WhatsApp,
  e-mail de contact, nb de personnes, **Représentant (affiché UNIQUEMENT si la fiche est
  regroupée** — `groupe_id` ou `representant` déjà présent), logo (chemin), notes internes.
- **Destinations secondaires** : liste éditable (pays + continent), ajout/suppression.
- **Présence & formule par jour** : un `select` par jour (Absent / Petits-Déj / BiZ-BiZ / Journée).
- Boutons : Enregistrer / (Supprimer le réceptif).

Sous le formulaire :
- **Compte d'accès réceptif** (`AccesReceptif`) : crée le compte Auth du réceptif (e-mail +
  mot de passe) via une **server action** `creerAccesReceptif` (service_role), lui attribue le
  rôle `receptif` et lie la fiche (`proprietaire_id`).
- **Gérer le compte réceptif** (si un compte est lié) : **reset MDP** (génère un lien de
  récupération) + **suppression** définitive du compte (`UserActions`).

### 5.5 Écran « Agents inscrits » (`/admin/agents`)

Tableau : Agence, Ville, Contact, E-mail, Téléphone, Jours, Inscrit le, Actions.
Actions par ligne : **Éditer** (modal `EditAgent` → `modifierAgent`, l'e-mail reste verrouillé
car c'est l'identifiant), **Lien MDP** (reset), **Supprimer** (`UserActions`).

### 5.6 Écran « Rendez-vous » (`/admin/rendez-vous`)

Console de gestion de **tous** les RDV confirmés (`admin_rendez_vous()`), composant `RdvTable` :
- **Vue** : liste, ou **groupé** par réceptif / par agence / par jour.
- **Filtres** : jour, type (`rdv_matin`/`rdv_aprem`/`dejeuner`/présentation), **recherche** plein
  texte (agence/agent/réceptif).
- **Sélection en masse** : cases à cocher + « Tout sélectionner » → **« Supprimer la sélection (n) »**.
- **Suppression unitaire** par ligne (`annuler_engagement`).
- **Export CSV** (BOM UTF-8, colonnes Jour/Début/Fin/Type/Agence/Agent/E-mail/Réceptif/Représentant).
- Colonnes : sélection, Jour, Horaire (début–fin), Type, Agence, Agent, Réceptif (+ représentant).

### 5.7 Écran « Planning » (`/admin/planning`) — glisser-déposer

Composant `Planning` : on choisit un **réceptif** ou une **agence**, on voit ses journées
réellement réservées, et on **glisse-dépose** un RDV vers un autre créneau (`deplacer_rdv`,
avec **confirmation** et anti-conflit garanti côté base : si la cible est occupée, refus).
Les créneaux affichés s'**adaptent à la formule** (petit-déj → matin seul ; journée → matin +
après-midi) et aux **jours réellement présents**. Sur chaque bloc : **✕ pour supprimer**
(`annuler_engagement`) ; un clic sur une case vide ouvre une modale **« Créer un rendez-vous »**
(`admin_creer_rdv`).

### 5.8 Code source VERBATIM du dashboard admin

Fichiers, dans l'ordre : `layout.tsx`, `page.tsx` (tableau de bord), `receptifs/page.tsx`,
`receptifs/[id]/page.tsx`, `receptifs/nouveau/page.tsx`, `receptifs/EditForm.tsx`,
`receptifs/AccesReceptif.tsx`, `receptifs/actions.ts`, `agents/page.tsx`, `agents/EditAgent.tsx`,
`rendez-vous/page.tsx`, `rendez-vous/RdvTable.tsx`, `planning/page.tsx`, `planning/Planning.tsx`,
`UserActions.tsx`, `actions-users.ts`, `lib/admin.ts`.

#### `src/app/admin/layout.tsx`

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import Deconnexion from "@/app/mon-espace/Deconnexion";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/receptifs", label: "Réceptifs" },
  { href: "/admin/agents", label: "Agents inscrits" },
  { href: "/admin/rendez-vous", label: "Rendez-vous" },
  { href: "/admin/planning", label: "Planning" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-ligne bg-carte">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-titre text-xl font-700 text-encre">
              Admin · <span className="text-brique">TogeZer</span>
            </Link>
            <nav className="hidden gap-4 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="font-corps text-sm text-encreDoux hover:text-encre"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-corps text-sm text-encreDoux hover:text-encre"
            >
              Voir le site
            </Link>
            <Deconnexion />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
```

#### `src/app/admin/page.tsx`

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { JOURS, labelJour } from "@/lib/jours";

export const dynamic = "force-dynamic";

type Rdv = {
  jour: string;
  kind: string;
  exposant_id: string | null;
  agent_id: string | null;
};

export default async function AdminHome() {
  const { supabase, profile } = await requireAdmin();

  const [{ data: recs }, { data: ags }, { data: rdvData }, { count: dejPending }] =
    await Promise.all([
      supabase
        .from("exposants")
        .select("id, nom, proprietaire_id, description, logo_path, contact_nom, contact_photo, contact_bio, presences(jour)")
        .order("nom"),
      supabase.from("agents").select("id, agence, created_at"),
      supabase.rpc("admin_rendez_vous"),
      supabase.from("demandes_dejeuner").select("*", { count: "exact", head: true }).eq("statut", "en_attente"),
    ]);

  const receptifs = recs ?? [];
  const agents = ags ?? [];
  const rdv = (rdvData ?? []) as Rdv[];

  const rdvParRec = new Map<string, number>();
  rdv.forEach((r) => {
    if (r.exposant_id) rdvParRec.set(r.exposant_id, (rdvParRec.get(r.exposant_id) ?? 0) + 1);
  });
  const agentsAvecRdv = new Set(rdv.map((r) => r.agent_id).filter(Boolean));

  const parJour = JOURS.map((j) => ({ j, n: rdv.filter((r) => r.jour === j.iso).length }));
  const maxJour = Math.max(1, ...parJour.map((x) => x.n));
  const classement = receptifs
    .map((r) => ({ nom: r.nom, n: rdvParRec.get(r.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const topRec = classement.slice(0, 6);
  const flopRec = [...classement].reverse().slice(0, 6);
  const recSansRdv = receptifs.filter((r) => !rdvParRec.has(r.id));
  const agentsSansRdv = agents.filter((a) => !agentsAvecRdv.has(a.id));
  const recSansCompte = receptifs.filter((r) => !r.proprietaire_id);

  // Fiches réceptif complètes à 100 % ?
  const champsManquants = (r: {
    description: string | null; logo_path: string | null; contact_nom: string | null;
    contact_photo: string | null; contact_bio: string | null; presences: { jour: string }[];
  }) => {
    const m: string[] = [];
    if (!r.description) m.push("description");
    if (!r.logo_path) m.push("logo");
    if (!r.contact_nom) m.push("représentant");
    if (!r.contact_photo) m.push("photo du représentant");
    if (!r.contact_bio) m.push("bio du représentant");
    if (!r.presences || r.presences.length === 0) m.push("présence/jours");
    return m;
  };
  const fichesIncompletes = receptifs
    .map((r) => ({ nom: r.nom, manque: champsManquants(r) }))
    .filter((r) => r.manque.length > 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-titre text-4xl font-600 text-encre">
            Tableau de bord
          </h1>
          <p className="mt-1 font-corps text-encreDoux">
            Vue d'ensemble de l'événement — {profile.full_name || "admin"}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi val={receptifs.length} label="Réceptifs" href="/admin/receptifs" />
        <Kpi val={agents.length} label="Agents inscrits" href="/admin/agents" />
        <Kpi val={rdv.length} label="Rendez-vous confirmés" href="/admin/rendez-vous" />
        <Kpi val={dejPending ?? 0} label="Déjeuners à valider" href="/admin/rendez-vous" accent />
      </div>

      {/* RDV par jour */}
      <div className="mt-6">
        <Carte titre="Rendez-vous par jour">
          <div className="space-y-3">
            {parJour.map(({ j, n }) => (
              <div key={j.iso} className="flex items-center gap-3">
                <span className="w-24 font-corps text-sm text-encreDoux">{j.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-creme">
                  <div className="h-full rounded-full bg-brique" style={{ width: `${(n / maxJour) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-titre font-700 text-encre">{n}</span>
              </div>
            ))}
          </div>
        </Carte>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Carte titre="Réceptifs les plus demandés">
          <Classement items={topRec} />
        </Carte>
        <Carte titre="Réceptifs les moins demandés">
          <Classement items={flopRec} />
        </Carte>
      </div>

      {/* À suivre / alertes */}
      <h2 className="mt-8 font-titre text-2xl font-600 text-encre">À suivre</h2>
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <Alerte
          titre="Réceptifs sans aucun RDV"
          items={recSansRdv.map((r) => r.nom)}
          href="/admin/receptifs"
          vide="Tous les réceptifs ont au moins un RDV 🎉"
        />
        <Alerte
          titre="Agents inscrits sans RDV"
          items={agentsSansRdv.map((a) => a.agence)}
          href="/admin/agents"
          vide="Tous les agents ont réservé 🎉"
        />
        <Alerte
          titre="Réceptifs sans compte d'accès (à activer)"
          items={recSansCompte.map((r) => r.nom)}
          href="/admin/receptifs"
          vide="Tous les réceptifs ont un accès."
        />
        <Alerte
          titre="Fiches incomplètes"
          items={fichesIncompletes.map((r) => `${r.nom} — manque : ${r.manque.join(", ")}`)}
          href="/admin/receptifs"
          vide="Toutes les fiches sont complètes 🎉"
        />
      </div>
    </div>
  );
}

function Kpi({ val, label, href, accent }: { val: number; label: string; href: string; accent?: boolean }) {
  return (
    <Link href={href}
      className={`rounded-xl border bg-carte p-5 shadow-carte transition hover:border-brique/40 ${
        accent && val > 0 ? "border-brique/60" : "border-ligne"
      }`}>
      <p className="font-titre text-4xl font-700 text-brique">{val}</p>
      <p className="mt-1 font-corps text-sm text-encreDoux">{label}</p>
    </Link>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <h3 className="mb-4 font-titre text-lg font-600 text-encre">{titre}</h3>
      {children}
    </div>
  );
}

function Alerte({ titre, items, href, vide }: { titre: string; items: string[]; href: string; vide: string }) {
  return (
    <div className="rounded-xl border border-ligne bg-carte p-5 shadow-carte">
      <div className="flex items-center justify-between">
        <h3 className="font-titre text-base font-600 text-encre">{titre}</h3>
        <span className={`rounded-full px-2 py-0.5 font-corps text-xs font-600 ${
          items.length ? "bg-brique/10 text-brique" : "bg-creme text-encreDoux"
        }`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 font-corps text-sm text-encreDoux">{vide}</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto font-corps text-sm text-encre">
          {items.slice(0, 30).map((i) => <li key={i}>· {i}</li>)}
          {items.length > 30 && <li className="text-encreDoux">…et {items.length - 30} de plus</li>}
        </ul>
      )}
      <Link href={href} className="mt-3 inline-block font-corps text-sm text-brique underline underline-offset-2">
        Gérer
      </Link>
    </div>
  );
}

function Classement({ items }: { items: { nom: string; n: number }[] }) {
  if (!items.length || items.every((i) => i.n === 0))
    return <p className="font-corps text-sm text-encreDoux">Aucun rendez-vous encore.</p>;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.nom} className="flex items-center justify-between font-corps text-sm">
          <span className="text-encre">{r.nom}</span>
          <span className="font-700 text-brique">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}
```

#### `src/app/admin/receptifs/page.tsx`

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { JOURS, FORMULE_LABEL } from "@/lib/jours";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  contact_nom: string | null;
  representant: string | null;
  presences: { jour: string; formule: string }[];
};

export default async function AdminReceptifs() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("exposants")
    .select("id, nom, pays_principal, continent_principal, contact_nom, representant, presences(jour, formule)")
    .order("nom");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-titre text-3xl font-600 text-encre">Réceptifs</h1>
          <p className="mt-1 font-corps text-sm text-encreDoux">
            {rows.length} fiches — cliquez pour tout éditer.
            <span className="ml-3 rounded-md bg-brique/10 px-1.5 py-0.5 text-xs font-700 text-brique">PD</span>
            <span className="ml-1 text-xs">Petits-Déj</span>
            <span className="ml-2 rounded-md bg-brique/10 px-1.5 py-0.5 text-xs font-700 text-brique">BB</span>
            <span className="ml-1 text-xs">BiZ-BiZ</span>
            <span className="ml-2 rounded-md bg-brique/10 px-1.5 py-0.5 text-xs font-700 text-brique">J</span>
            <span className="ml-1 text-xs">Journée</span>
          </p>
        </div>
        <Link
          href="/admin/receptifs/nouveau"
          className="rounded-full bg-brique px-5 py-2.5 font-corps font-600 text-creme hover:bg-briqueFonce"
        >
          + Nouveau réceptif
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
        <table className="w-full text-left font-corps text-sm">
          <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Destination · continent</th>
              <th className="px-4 py-3">Contact</th>
              {JOURS.map((j) => (
                <th key={j.iso} className="px-3 py-3 text-center">{j.court}</th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ligne/60 last:border-0 hover:bg-creme/50">
                <td className="px-4 py-3 font-600 text-encre">
                  {r.nom}
                  {r.representant && (
                    <span className="ml-2 text-xs text-encreDoux">(avec {r.representant})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-encreDoux">
                  <span className="text-brique">{r.pays_principal}</span> · {r.continent_principal}
                </td>
                <td className="px-4 py-3 text-encreDoux">{r.contact_nom ?? "—"}</td>
                {JOURS.map((j) => {
                  const p = r.presences.find((x) => x.jour === j.iso);
                  const court: Record<string, string> = { petits_dej: "PD", biz_biz: "BB", journee: "J" };
                  return (
                    <td key={j.iso} className="px-3 py-3 text-center" title={p ? FORMULE_LABEL[p.formule] : "Absent"}>
                      {p && p.formule !== "absent" ? (
                        <span className="inline-block min-w-[26px] rounded-md bg-brique/10 px-1.5 py-0.5 text-xs font-700 text-brique">
                          {court[p.formule] ?? "●"}
                        </span>
                      ) : (
                        <span className="text-encre/20">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/receptifs/${r.id}`} className="text-brique underline underline-offset-2">
                    Éditer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### `src/app/admin/receptifs/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import EditForm, { type ExposantEdit } from "../EditForm";
import AccesReceptif from "../AccesReceptif";
import UserActions from "../../UserActions";

export const dynamic = "force-dynamic";

export default async function EditReceptif({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("exposants")
    .select("*, exposant_destinations(pays, continent), presences(jour, formule)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  // Compte réceptif lié (pour réinitialisation / suppression)
  let compte: { id: string; email: string } | null = null;
  if (data.proprietaire_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", data.proprietaire_id)
      .single();
    if (p) compte = p as { id: string; email: string };
  }

  return (
    <div>
      <Link href="/admin/receptifs" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Réceptifs
      </Link>
      <h1 className="mb-6 mt-3 font-titre text-3xl font-600 text-encre">{data.nom}</h1>
      <div className="mt-6">
        <EditForm exposant={data as unknown as ExposantEdit} />
      </div>
      <div className="mt-8">
        <AccesReceptif
          exposantId={data.id}
          defaultEmail={data.email_contact ?? ""}
          hasAccess={!!data.proprietaire_id}
        />
      </div>
      {compte && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ligne bg-carte p-6 shadow-carte">
          <div>
            <p className="font-titre text-lg font-600 text-encre">Gérer le compte réceptif</p>
            <p className="font-corps text-sm text-encreDoux">Connecté avec : {compte.email}</p>
          </div>
          <UserActions userId={compte.id} email={compte.email} label={data.nom} />
        </div>
      )}
    </div>
  );
}
```

#### `src/app/admin/receptifs/nouveau/page.tsx`

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import EditForm from "../EditForm";

export const dynamic = "force-dynamic";

export default async function NouveauReceptif() {
  await requireAdmin();
  return (
    <div>
      <Link href="/admin/receptifs" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Réceptifs
      </Link>
      <h1 className="mb-6 mt-3 font-titre text-3xl font-600 text-encre">Nouveau réceptif</h1>
      <EditForm exposant={null} />
    </div>
  );
}
```

#### `src/app/admin/receptifs/EditForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";

const CONTINENTS = ["Afrique", "Amériques", "Asie", "Europe", "Océanie", "Autre"];
const FORMULES = [
  { v: "absent", l: "Absent" },
  { v: "petits_dej", l: "Petits-Déj (9h–13h)" },
  { v: "biz_biz", l: "BiZ-BiZ (9h–14h)" },
  { v: "journee", l: "Journée (9h–18h)" },
];

const JOUR_NOM: Record<string, string> = {
  "2026-09-15": "Mardi 15",
  "2026-09-16": "Mercredi 16",
  "2026-09-17": "Jeudi 17",
};

export type ExposantEdit = {
  id: string;
  slug: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  description: string | null;
  logo_path: string | null;
  email_contact: string | null;
  contact_nom: string | null;
  whatsapp: string | null;
  nb_personnes: number | null;
  notes: string | null;
  representant: string | null;
  groupe_id: string | null;
  exposant_destinations: { pays: string; continent: string }[];
  presences: { jour: string; formule: string }[];
};

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export default function EditForm({ exposant }: { exposant: ExposantEdit | null }) {
  const router = useRouter();
  const isNew = !exposant;
  const [f, setF] = useState({
    nom: exposant?.nom ?? "",
    pays_principal: exposant?.pays_principal ?? "",
    continent_principal: exposant?.continent_principal ?? "Afrique",
    description: exposant?.description ?? "",
    logo_path: exposant?.logo_path ?? "",
    email_contact: exposant?.email_contact ?? "martin@togezer.travel",
    contact_nom: exposant?.contact_nom ?? "",
    whatsapp: exposant?.whatsapp ?? "",
    nb_personnes: exposant?.nb_personnes?.toString() ?? "",
    notes: exposant?.notes ?? "",
    representant: exposant?.representant ?? "",
  });
  const [dests, setDests] = useState<{ pays: string; continent: string }[]>(
    exposant?.exposant_destinations ?? [],
  );
  const [pres, setPres] = useState<Record<string, string>>(
    Object.fromEntries(
      JOURS.map((j) => [j.iso, exposant?.presences.find((p) => p.jour === j.iso)?.formule ?? "absent"]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    const supabase = createClient();

    const payload = {
      nom: f.nom.trim(),
      pays_principal: f.pays_principal.trim(),
      continent_principal: f.continent_principal,
      description: f.description.trim() || null,
      logo_path: f.logo_path.trim() || null,
      email_contact: f.email_contact.trim() || null,
      contact_nom: f.contact_nom.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      nb_personnes: f.nb_personnes ? parseInt(f.nb_personnes, 10) : null,
      notes: f.notes.trim() || null,
      representant: f.representant.trim() || null,
    };

    let id = exposant?.id;
    if (isNew) {
      const { data, error } = await supabase
        .from("exposants")
        .insert({ ...payload, slug: slugify(f.nom) + "-" + Math.floor(Date.now() / 1000) })
        .select("id")
        .single();
      if (error) { setErreur(error.message); setBusy(false); return; }
      id = data.id;
    } else {
      const { error } = await supabase.from("exposants").update(payload).eq("id", id!);
      if (error) { setErreur(error.message); setBusy(false); return; }
    }

    // Destinations secondaires : on remplace
    await supabase.from("exposant_destinations").delete().eq("exposant_id", id!);
    const cleanDests = dests.filter((d) => d.pays.trim());
    if (cleanDests.length) {
      await supabase.from("exposant_destinations").insert(
        cleanDests.map((d) => ({ exposant_id: id!, pays: d.pays.trim(), continent: d.continent })),
      );
    }

    // Présences : on remplace (seules les non-absent sont stockées)
    await supabase.from("presences").delete().eq("exposant_id", id!);
    const rows = JOURS.filter((j) => pres[j.iso] !== "absent").map((j) => ({
      exposant_id: id!,
      jour: j.iso,
      formule: pres[j.iso],
    }));
    if (rows.length) await supabase.from("presences").insert(rows);

    setBusy(false);
    router.push("/admin/receptifs");
    router.refresh();
  }

  async function remove() {
    if (!exposant) return;
    if (!confirm(`Supprimer définitivement « ${exposant.nom} » et tous ses rendez-vous ?`)) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("exposants").delete().eq("id", exposant.id);
    if (error) { setErreur(error.message); setBusy(false); return; }
    router.push("/admin/receptifs");
    router.refresh();
  }

  const champ = "w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm outline-none focus:border-brique";
  const lbl = "mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux";

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={lbl}>Nom du réceptif</span>
            <input className={champ} value={f.nom} onChange={set("nom")} required /></label>
          <label><span className={lbl}>Destination principale</span>
            <input className={champ} value={f.pays_principal} onChange={set("pays_principal")} required /></label>
          <label><span className={lbl}>Continent principal</span>
            <select className={champ} value={f.continent_principal} onChange={set("continent_principal")}>
              {CONTINENTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="sm:col-span-2"><span className={lbl}>Description</span>
            <textarea className={champ} rows={2} value={f.description} onChange={set("description")} /></label>
          <label><span className={lbl}>Contact (nom)</span>
            <input className={champ} value={f.contact_nom} onChange={set("contact_nom")} /></label>
          <label><span className={lbl}>WhatsApp</span>
            <input className={champ} value={f.whatsapp} onChange={set("whatsapp")} /></label>
          <label><span className={lbl}>E-mail de contact</span>
            <input className={champ} value={f.email_contact} onChange={set("email_contact")} /></label>
          <label><span className={lbl}>Nb de personnes</span>
            <input className={champ} type="number" value={f.nb_personnes} onChange={set("nb_personnes")} /></label>
          {/* Champ réservé aux fiches regroupées (agenda partagé type Alkémia/Tamazirt/Serengeti) */}
          {(exposant?.groupe_id || exposant?.representant) && (
            <label><span className={lbl}>Représentant (regroupement)</span>
              <input className={champ} value={f.representant} onChange={set("representant")} placeholder="ex. Mathilde Quéva" /></label>
          )}
          <label><span className={lbl}>Logo (chemin)</span>
            <input className={champ} value={f.logo_path} onChange={set("logo_path")} placeholder="/logos/xxx.svg" /></label>
          <label className="sm:col-span-2"><span className={lbl}>Notes internes</span>
            <textarea className={champ} rows={2} value={f.notes} onChange={set("notes")} /></label>
        </div>
      </div>

      {/* Destinations secondaires */}
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <div className="flex items-center justify-between">
          <h2 className="font-titre text-lg font-600 text-encre">Destinations secondaires</h2>
          <button type="button" onClick={() => setDests((d) => [...d, { pays: "", continent: f.continent_principal }])}
            className="rounded-full border border-encre/20 px-3 py-1 text-sm text-encre hover:bg-creme">+ Ajouter</button>
        </div>
        <div className="mt-4 space-y-2">
          {dests.length === 0 && <p className="font-corps text-sm text-encreDoux">Aucune.</p>}
          {dests.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input className={champ} value={d.pays} placeholder="Pays" onChange={(e) => setDests((arr) => arr.map((x, j) => j === i ? { ...x, pays: e.target.value } : x))} />
              <select className={champ + " max-w-[180px]"} value={d.continent} onChange={(e) => setDests((arr) => arr.map((x, j) => j === i ? { ...x, continent: e.target.value } : x))}>
                {CONTINENTS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setDests((arr) => arr.filter((_, j) => j !== i))}
                className="rounded-lg border border-encre/20 px-3 text-encreDoux hover:bg-creme">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Présence par jour */}
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <h2 className="font-titre text-lg font-600 text-encre">Présence &amp; formule par jour</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {JOURS.map((j) => (
            <label key={j.iso}><span className={lbl}>{JOUR_NOM[j.iso]}</span>
              <select className={champ} value={pres[j.iso]} onChange={(e) => setPres((p) => ({ ...p, [j.iso]: e.target.value }))}>
                {FORMULES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select></label>
          ))}
        </div>
      </div>

      {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={busy}
          className="rounded-full bg-brique px-8 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50">
          {busy ? "Enregistrement…" : isNew ? "Créer le réceptif" : "Enregistrer"}
        </button>
        {!isNew && (
          <button type="button" onClick={remove} disabled={busy}
            className="font-corps text-sm text-red-600 underline underline-offset-2">
            Supprimer ce réceptif
          </button>
        )}
      </div>
    </form>
  );
}
```

#### `src/app/admin/receptifs/AccesReceptif.tsx`

```tsx
"use client";

import { useState } from "react";
import { creerAccesReceptif } from "./actions";

export default function AccesReceptif({
  exposantId,
  defaultEmail,
  hasAccess,
}: {
  exposantId: string;
  defaultEmail: string;
  hasAccess: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await creerAccesReceptif(exposantId, email, password);
    setBusy(false);
    if (res.error) setMsg({ ok: false, text: res.error });
    else setMsg({ ok: true, text: "Accès créé. Communiquez ces identifiants au réceptif." });
  }

  const champ = "w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm outline-none focus:border-brique";

  return (
    <div className="max-w-3xl rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <h2 className="font-titre text-lg font-600 text-encre">Compte d'accès réceptif</h2>
      <p className="mt-1 font-corps text-sm text-encreDoux">
        {hasAccess
          ? "Un accès est déjà lié à cette fiche. Vous pouvez en créer un nouveau (autre e-mail)."
          : "Créez l'accès de ce réceptif à son espace personnel."}
        {" "}En phase de test, utilisez un e-mail distinct par compte.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">E-mail de connexion</span>
          <input className={champ} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">Mot de passe (8+)</span>
          <input className={champ} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}
          className="rounded-full bg-brique px-6 py-2.5 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50">
          {busy ? "Création…" : "Créer l'accès"}
        </button>
      </form>
      {msg && (
        <p className={`mt-3 font-corps text-sm ${msg.ok ? "text-brique" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
```

#### `src/app/admin/receptifs/actions.ts`

```tsx
"use server";

import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// Crée (ou réattache) le compte d'accès d'un réceptif et le lie à sa fiche.
export async function creerAccesReceptif(
  exposantId: string,
  email: string,
  password: string,
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  if (!email.trim() || password.length < 8) {
    return { error: "E-mail requis et mot de passe d'au moins 8 caractères." };
  }
  const svc = createServiceClient();

  // 1) Créer l'utilisateur Auth (déjà confirmé)
  const { data, error } = await svc.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Création du compte impossible." };
  }
  const uid = data.user.id;

  // 2) Profil rôle réceptif
  const { error: e2 } = await svc
    .from("profiles")
    .upsert({ id: uid, role: "receptif", email: email.trim() });
  if (e2) return { error: e2.message };

  // 3) Lier la fiche réceptif à ce compte
  const { error: e3 } = await svc
    .from("exposants")
    .update({ proprietaire_id: uid })
    .eq("id", exposantId);
  if (e3) return { error: e3.message };

  revalidatePath(`/admin/receptifs/${exposantId}`);
  return { ok: true };
}
```

#### `src/app/admin/agents/page.tsx`

```tsx
import { requireAdmin } from "@/lib/admin";
import { labelJour } from "@/lib/jours";
import UserActions from "../UserActions";
import EditAgent from "./EditAgent";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  agence: string;
  ville: string | null;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  created_at: string;
};

function dateFr(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAgents() {
  const { supabase } = await requireAdmin();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, agence, ville, prenom, nom, email, telephone, created_at")
    .order("created_at", { ascending: false });
  const { data: jours } = await supabase.from("agent_jours").select("agent_id, jour");

  const rows = (agents ?? []) as Agent[];
  const joursByAgent = (id: string) =>
    (jours ?? []).filter((j) => j.agent_id === id).map((j) => labelJour(j.jour as string));

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Agents inscrits</h1>
      <p className="mt-1 font-corps text-sm text-encreDoux">{rows.length} agent(s).</p>

      {rows.length === 0 ? (
        <p className="mt-8 font-corps text-encreDoux">
          Aucun agent inscrit pour l'instant.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
          <table className="w-full text-left font-corps text-sm">
            <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
              <tr>
                <th className="px-4 py-3">Agence</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Jours</th>
                <th className="px-4 py-3">Inscrit le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-3 font-600 text-encre">{a.agence}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.ville ?? "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.prenom} {a.nom}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.email}</td>
                  <td className="px-4 py-3 text-encreDoux">{a.telephone ?? "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{joursByAgent(a.id).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-encreDoux">{dateFr(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <EditAgent
                        userId={a.id}
                        email={a.email}
                        initial={{
                          agence: a.agence,
                          ville: a.ville ?? "",
                          prenom: a.prenom,
                          nom: a.nom,
                          telephone: a.telephone ?? "",
                        }}
                      />
                      <UserActions userId={a.id} email={a.email} label={a.agence} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

#### `src/app/admin/agents/EditAgent.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierAgent } from "../actions-users";

type Infos = { agence: string; ville: string; prenom: string; nom: string; telephone: string };

export default function EditAgent({
  userId,
  email,
  initial,
}: {
  userId: string;
  email: string;
  initial: Infos;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Infos>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof Infos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    const res = await modifierAgent(userId, form);
    setBusy(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => { setForm(initial); setErreur(null); setOpen(true); }}
        className="rounded-full border border-encre/20 px-3 py-1 font-corps text-xs text-encre transition hover:border-brique hover:text-brique"
      >
        Éditer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-carte p-6 shadow-carte"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-titre text-xl font-600 text-encre">Modifier l'agent</h3>
            <p className="mt-1 font-corps text-xs text-encreDoux">
              {email} (identifiant de connexion — non modifiable)
            </p>
            <div className="mt-4 space-y-3">
              <Champ label="Agence" value={form.agence} onChange={set("agence")} />
              <Champ label="Ville" value={form.ville} onChange={set("ville")} />
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Prénom" value={form.prenom} onChange={set("prenom")} />
                <Champ label="Nom" value={form.nom} onChange={set("nom")} />
              </div>
              <Champ label="Téléphone" value={form.telephone} onChange={set("telephone")} />
            </div>
            {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setOpen(false)}
                className="rounded-full border border-encre/20 px-5 py-2 font-corps text-sm text-encre">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={busy}
                className="rounded-full bg-brique px-5 py-2 font-corps font-600 text-creme disabled:opacity-50">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Champ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
        {label}
      </span>
      <input value={value} onChange={onChange}
        className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm" />
    </label>
  );
}
```

#### `src/app/admin/rendez-vous/page.tsx`

```tsx
import { requireAdmin } from "@/lib/admin";
import RdvTable, { type Rdv } from "./RdvTable";

export const dynamic = "force-dynamic";

export default async function AdminRdv() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_rendez_vous");
  const rows = (data ?? []) as Rdv[];

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Rendez-vous</h1>
      <p className="mb-6 mt-1 font-corps text-sm text-encreDoux">
        Tous les rendez-vous confirmés — filtrez et exportez.
      </p>
      <RdvTable rows={rows} />
    </div>
  );
}
```

#### `src/app/admin/rendez-vous/RdvTable.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { affiche, normDebut } from "@/lib/creneaux";

export type Rdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  agence: string | null;
  agent_nom: string | null;
  agent_email: string | null;
  receptif: string | null;
  representant: string | null;
};

const KIND_LABEL: Record<string, string> = {
  rdv_matin: "Petit-déj",
  rdv_aprem: "Après-midi",
  dejeuner: "Déjeuner",
  presentation_inscription: "Présentation",
  presentation_hold: "Présentation (salle)",
};

const heure = (ts: string) => affiche(normDebut(ts).slice(11));

export default function RdvTable({ rows }: { rows: Rdv[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [jour, setJour] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"aucun" | "receptif" | "agent" | "jour">("aucun");
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const toggleSel = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const filtres = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (jour && r.jour !== jour) return false;
      if (type && r.kind !== type) return false;
      if (qq) {
        const hay = `${r.agence ?? ""} ${r.agent_nom ?? ""} ${r.receptif ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, jour, type, q]);

  async function supprimer(r: Rdv) {
    const msg = `Annuler ce rendez-vous ?\n\n${labelJour(r.jour)} à ${heure(r.debut)}\n${r.agence ?? "—"} ↔ ${r.receptif ?? "—"}\n\nLe créneau sera libéré et l'agent perdra ce RDV. Action définitive.`;
    if (!confirm(msg)) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: r.id, p_message: null });
    setBusy(null);
    if (error) {
      alert("La suppression a échoué.");
      return;
    }
    router.refresh();
  }

  const idsFiltres = filtres.map((r) => r.id);
  const toutSelectionne = idsFiltres.length > 0 && idsFiltres.every((id) => sel.has(id));
  const toggleTout = () => setSel(toutSelectionne ? new Set() : new Set(idsFiltres));

  async function supprimerSelection() {
    if (sel.size === 0) return;
    if (!confirm(`Supprimer ${sel.size} rendez-vous ? Les créneaux seront libérés. Action définitive.`)) return;
    setBusy("bulk");
    await Promise.all([...sel].map((id) => supabase.rpc("annuler_engagement", { p_id: id, p_message: null })));
    setBusy(null);
    setSel(new Set());
    router.refresh();
  }

  function exportCsv() {
    const head = ["Jour", "Début", "Fin", "Type", "Agence", "Agent", "E-mail", "Réceptif", "Représentant"];
    const lignes = filtres.map((r) => [
      labelJour(r.jour), heure(r.debut), heure(r.fin), KIND_LABEL[r.kind] ?? r.kind,
      r.agence ?? "", r.agent_nom ?? "", r.agent_email ?? "", r.receptif ?? "", r.representant ?? "",
    ]);
    const csv = [head, ...lignes]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rendez-vous-station-togezer.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Regroupement
  const groupes = useMemo(() => {
    if (group === "aucun") return [{ titre: "", items: filtres }];
    const key = (r: Rdv) =>
      group === "receptif" ? r.receptif ?? "—" : group === "agent" ? `${r.agence ?? "—"}` : labelJour(r.jour);
    const map = new Map<string, Rdv[]>();
    for (const r of filtres) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([titre, items]) => ({ titre, items }));
  }, [filtres, group]);

  const champ = "rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className={champ}>
          <option value="aucun">Vue : liste</option>
          <option value="receptif">Grouper par réceptif</option>
          <option value="agent">Grouper par agence</option>
          <option value="jour">Grouper par jour</option>
        </select>
        <select value={jour} onChange={(e) => setJour(e.target.value)} className={champ}>
          <option value="">Tous les jours</option>
          {JOURS.map((j) => <option key={j.iso} value={j.iso}>{j.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={champ}>
          <option value="">Tous les types</option>
          <option value="rdv_matin">Petit-déjeuner</option>
          <option value="rdv_aprem">Après-midi</option>
          <option value="dejeuner">Déjeuner</option>
          <option value="presentation_inscription">Présentation</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          className={champ + " min-w-[200px] flex-1"} />
        <span className="font-corps text-sm text-encreDoux">{filtres.length} RDV</span>
        <button onClick={toggleTout}
          className="rounded-full border border-encre/20 px-4 py-2 font-corps text-sm text-encre hover:bg-creme">
          {toutSelectionne ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        {sel.size > 0 && (
          <button onClick={supprimerSelection} disabled={busy === "bulk"}
            className="rounded-full bg-red-600 px-4 py-2 font-corps text-sm font-600 text-white hover:bg-red-700 disabled:opacity-50">
            Supprimer la sélection ({sel.size})
          </button>
        )}
        <button onClick={exportCsv}
          className="rounded-full border border-encre/20 px-4 py-2 font-corps text-sm text-encre hover:bg-creme">
          Exporter (CSV)
        </button>
      </div>

      <div className="space-y-6">
        {groupes.map((g) => (
          <div key={g.titre || "all"}>
            {g.titre && (
              <p className="mb-2 font-titre text-lg font-600 text-encre">
                {g.titre} <span className="font-corps text-sm text-encreDoux">({g.items.length})</span>
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-ligne bg-carte shadow-carte">
              <table className="w-full text-left font-corps text-sm">
                <thead className="border-b border-ligne text-xs uppercase tracking-wide text-encreDoux">
                  <tr>
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} className="accent-brique" />
                    </th>
                    <th className="px-4 py-3">Jour</th>
                    <th className="px-4 py-3">Horaire</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Agence</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Réceptif</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-encreDoux">Aucun rendez-vous.</td></tr>
                  ) : (
                    g.items
                      .slice()
                      .sort((a, b) => a.jour.localeCompare(b.jour) || a.debut.localeCompare(b.debut))
                      .map((r) => (
                        <tr key={r.id} className={`border-b border-ligne/60 last:border-0 ${sel.has(r.id) ? "bg-brique/5" : ""}`}>
                          <td className="px-3 py-3">
                            <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} className="accent-brique" />
                          </td>
                          <td className="px-4 py-3 text-encreDoux">{labelJour(r.jour)}</td>
                          <td className="px-4 py-3 font-600 text-brique">{heure(r.debut)}–{heure(r.fin)}</td>
                          <td className="px-4 py-3 text-encreDoux">{KIND_LABEL[r.kind] ?? r.kind}</td>
                          <td className="px-4 py-3 font-600 text-encre">{r.agence ?? "—"}</td>
                          <td className="px-4 py-3 text-encreDoux">{r.agent_nom ?? "—"}</td>
                          <td className="px-4 py-3 text-encreDoux">
                            {r.receptif ?? "—"}
                            {r.representant && <span className="text-encre/50"> (avec {r.representant})</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => supprimer(r)} disabled={busy === r.id}
                              className="font-corps text-xs text-red-600 hover:underline disabled:opacity-50">
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### `src/app/admin/planning/page.tsx`

```tsx
import { requireAdmin } from "@/lib/admin";
import Planning, { type PlanningRdv } from "./Planning";

export const dynamic = "force-dynamic";

export default async function AdminPlanning() {
  const { supabase } = await requireAdmin();
  const { data: rdvData } = await supabase.rpc("admin_rendez_vous");
  const [{ data: recs }, { data: ags }, { data: aj }] = await Promise.all([
    supabase.from("exposants").select("id, nom, presences(jour, formule)").order("nom"),
    supabase.from("agents").select("id, agence").order("agence"),
    supabase.from("agent_jours").select("agent_id, jour"),
  ]);

  const agentJours: Record<string, string[]> = {};
  (aj ?? []).forEach((r) => {
    (agentJours[r.agent_id as string] ??= []).push(r.jour as string);
  });

  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Planning</h1>
      <p className="mb-6 mt-1 font-corps text-sm text-encreDoux">
        Choisissez un réceptif ou une agence, visualisez ses 3 journées, et
        <strong> glissez-déposez</strong> un rendez-vous pour le déplacer.
      </p>
      <Planning
        rdvs={(rdvData ?? []) as PlanningRdv[]}
        receptifs={(recs ?? []) as unknown as { id: string; nom: string; presences: { jour: string; formule: string }[] }[]}
        agents={(ags ?? []) as { id: string; agence: string }[]}
        agentJours={agentJours}
      />
    </div>
  );
}
```

#### `src/app/admin/planning/Planning.tsx`

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { CRENEAUX_MATIN, CRENEAUX_APREM, affiche, normDebut } from "@/lib/creneaux";

export type PlanningRdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  exposant_id: string | null;
  agent_id: string | null;
  agence: string | null;
  receptif: string | null;
};

const BREAKFAST = new Set(["petits_dej", "biz_biz", "journee"]);

export default function Planning({
  rdvs,
  receptifs,
  agents,
  agentJours,
}: {
  rdvs: PlanningRdv[];
  receptifs: { id: string; nom: string; presences: { jour: string; formule: string }[] }[];
  agents: { id: string; agence: string }[];
  agentJours: Record<string, string[]>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"receptif" | "agent">("receptif");
  const [entityId, setEntityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ jour: string; hhmm: string } | null>(null);
  const [autre, setAutre] = useState("");
  const dragRef = useRef<string | null>(null);

  // RDV de l'entité sélectionnée (déplaçables : matin/après-midi)
  const items = useMemo(
    () =>
      rdvs.filter(
        (r) =>
          (r.kind === "rdv_matin" || r.kind === "rdv_aprem") &&
          (mode === "receptif" ? r.exposant_id === entityId : r.agent_id === entityId),
      ),
    [rdvs, mode, entityId],
  );

  const at = (jour: string, hhmm: string) =>
    items.find((r) => normDebut(r.debut) === `${jour} ${hhmm}`);

  // Étiquette du bloc = l'autre partie
  const label = (r: PlanningRdv) => (mode === "receptif" ? r.agence : r.receptif) ?? "—";

  // Jours et créneaux affichés = ceux réellement réservés par l'entité
  const selReceptif = mode === "receptif" ? receptifs.find((r) => r.id === entityId) : null;
  const jours = !entityId
    ? []
    : mode === "receptif"
      ? JOURS.filter((j) => selReceptif?.presences.some((p) => p.jour === j.iso && p.formule !== "absent"))
      : JOURS.filter((j) => (agentJours[entityId] ?? []).includes(j.iso));
  const slotsFor = (jourIso: string): string[] => {
    if (mode === "agent") return [...CRENEAUX_MATIN, ...CRENEAUX_APREM];
    const f = selReceptif?.presences.find((p) => p.jour === jourIso)?.formule;
    if (f === "journee") return [...CRENEAUX_MATIN, ...CRENEAUX_APREM];
    if (f === "petits_dej" || f === "biz_biz") return CRENEAUX_MATIN;
    return [];
  };

  async function drop(jour: string, hhmm: string) {
    const id = dragRef.current;
    dragRef.current = null;
    if (!id) return;
    const r = items.find((x) => x.id === id);
    if (!r) return;
    if (normDebut(r.debut) === `${jour} ${hhmm}`) return; // même case
    const ok = confirm(
      `Déplacer ce rendez-vous ?\n\n${label(r)}\nDe ${labelJour(r.jour)} ${affiche(normDebut(r.debut).slice(11))}\nVers ${labelJour(jour)} ${affiche(hhmm)}\n\nL'anti-conflit reste garanti : si la cible est occupée, le déplacement sera refusé.`,
    );
    if (!ok) return;
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("deplacer_rdv", {
      p_id: id,
      p_nouveau_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(false);
    if (error) {
      setErreur(error.message.includes("occupé") ? "Créneau cible déjà occupé." : "Déplacement impossible.");
      return;
    }
    router.refresh();
  }

  async function creer() {
    if (!creating || !autre) return;
    const agent_id = mode === "agent" ? entityId : autre;
    const exposant_id = mode === "receptif" ? entityId : autre;
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("admin_creer_rdv", {
      p_agent_id: agent_id,
      p_exposant_id: exposant_id,
      p_debut: `${creating.jour} ${creating.hhmm}:00`,
    });
    setBusy(false);
    setCreating(null);
    setAutre("");
    if (error) {
      setErreur(
        error.message.includes("déjà un rendez-vous")
          ? "Cet agent a déjà un rendez-vous avec ce réceptif."
          : error.message.includes("occupé")
            ? "Créneau déjà occupé."
            : "Création impossible.",
      );
      return;
    }
    router.refresh();
  }

  async function supprimer(r: PlanningRdv) {
    if (!confirm(`Supprimer ce rendez-vous ?\n\n${label(r)}\n${labelJour(r.jour)} à ${affiche(normDebut(r.debut).slice(11))}\n\nLe créneau sera libéré. Action définitive.`))
      return;
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: r.id, p_message: null });
    setBusy(false);
    if (error) {
      setErreur("Suppression impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select value={mode} onChange={(e) => { setMode(e.target.value as "receptif" | "agent"); setEntityId(""); }}
          className="rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
          <option value="receptif">Par réceptif</option>
          <option value="agent">Par agence</option>
        </select>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)}
          className="min-w-[220px] rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
          <option value="">— Choisir —</option>
          {mode === "receptif"
            ? receptifs.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)
            : agents.map((a) => <option key={a.id} value={a.id}>{a.agence}</option>)}
        </select>
        {busy && <span className="font-corps text-sm text-encreDoux">Déplacement…</span>}
        {erreur && <span className="font-corps text-sm text-red-600">{erreur}</span>}
      </div>

      {!entityId ? (
        <p className="rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
          Sélectionnez un {mode === "receptif" ? "réceptif" : "une agence"} pour voir son planning.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {jours.length === 0 && (
            <p className="font-corps text-encreDoux">Cette entité n'est présente sur aucun jour.</p>
          )}
          {jours.map((j) => (
            <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
              <p className="mb-2 text-center font-titre text-lg font-600 text-encre">{j.label}</p>
              <div className="space-y-1">
                {slotsFor(j.iso).map((hhmm) => {
                  const r = at(j.iso, hhmm);
                  return (
                    <div
                      key={hhmm}
                      onDragOver={(e) => { if (!r) e.preventDefault(); }}
                      onDrop={() => drop(j.iso, hhmm)}
                      className="flex items-center gap-2"
                    >
                      <span className="w-12 shrink-0 text-right font-corps text-[11px] text-encreDoux">
                        {affiche(hhmm)}
                      </span>
                      {r ? (
                        <div
                          draggable
                          onDragStart={() => { dragRef.current = r.id; }}
                          title="Glissez pour déplacer"
                          className="flex flex-1 items-center gap-1 rounded-md bg-brique px-2 py-1.5 font-corps text-xs font-600 text-creme"
                        >
                          <span className="flex-1 cursor-grab truncate active:cursor-grabbing">{label(r)}</span>
                          <button onClick={() => supprimer(r)} title="Supprimer ce RDV"
                            className="shrink-0 rounded px-1 text-creme/80 hover:bg-white/20 hover:text-white">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setCreating({ jour: j.iso, hhmm }); setAutre(""); setErreur(null); }}
                          title="Créer un rendez-vous ici"
                          className="h-7 flex-1 rounded-md border border-dashed border-ligne/70 transition hover:border-brique/50 hover:bg-brique/5"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4"
          onClick={() => setCreating(null)}>
          <div className="w-full max-w-md rounded-xl bg-carte p-6 shadow-carte"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-titre text-xl font-600 text-encre">Créer un rendez-vous</h3>
            <p className="mt-1 font-corps text-sm text-encreDoux">
              {labelJour(creating.jour)} à {affiche(creating.hhmm)}
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
                {mode === "receptif" ? "Avec quelle agence ?" : "Avec quel réceptif ?"}
              </span>
              <select value={autre} onChange={(e) => setAutre(e.target.value)}
                className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm">
                <option value="">— Choisir —</option>
                {(mode === "receptif"
                  ? agents.map((a) => ({ id: a.id, nom: a.agence }))
                  : receptifs
                ).map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setCreating(null)}
                className="rounded-full border border-encre/20 px-5 py-2 font-corps text-sm text-encre">
                Annuler
              </button>
              <button onClick={creer} disabled={!autre || busy}
                className="rounded-full bg-brique px-5 py-2 font-corps font-600 text-creme disabled:opacity-50">
                Créer le RDV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### `src/app/admin/UserActions.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { genererLienReset, supprimerUtilisateur } from "./actions-users";

export default function UserActions({
  userId,
  email,
  label,
}: {
  userId: string;
  email: string;
  label: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setErr(null);
    setLink(null);
    const r = await genererLienReset(email);
    setBusy(false);
    if (r.link) setLink(r.link);
    else setErr(r.error ?? "Erreur");
  }

  async function del() {
    if (!confirm(`Supprimer définitivement « ${label} » (${email}) et toutes ses données ? Action irréversible.`))
      return;
    setBusy(true);
    setErr(null);
    const r = await supprimerUtilisateur(userId);
    setBusy(false);
    if (r.ok) router.refresh();
    else setErr(r.error ?? "Erreur");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button onClick={reset} disabled={busy}
          className="rounded-full border border-encre/20 px-3 py-1 font-corps text-xs text-encre hover:bg-creme disabled:opacity-50">
          Lien MDP
        </button>
        <button onClick={del} disabled={busy}
          className="rounded-full border border-red-300 px-3 py-1 font-corps text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
          Supprimer
        </button>
      </div>
      {err && <span className="font-corps text-xs text-red-600">{err}</span>}
      {link && (
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
          title="Copiez ce lien et transmettez-le à la personne"
          className="mt-1 w-72 rounded border border-ligne bg-white px-2 py-1 font-corps text-[11px] text-encreDoux" />
      )}
    </div>
  );
}
```

#### `src/app/admin/actions-users.ts`

```tsx
"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

async function origin() {
  const h = await headers();
  const host = h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// Génère un lien de réinitialisation de mot de passe (à transmettre à la personne).
export async function genererLienReset(
  email: string,
): Promise<{ link?: string; error?: string }> {
  await requireAdmin();
  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${await origin()}/nouveau-mot-de-passe` },
  });
  if (error || !data.properties) {
    return { error: error?.message ?? "Génération du lien impossible." };
  }
  return { link: data.properties.action_link };
}

// Modifie la fiche d'un agent (l'e-mail, identifiant de connexion, ne bouge pas).
export async function modifierAgent(
  userId: string,
  infos: { agence: string; ville: string; prenom: string; nom: string; telephone: string },
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  if (!infos.agence.trim() || !infos.prenom.trim() || !infos.nom.trim()) {
    return { error: "Agence, prénom et nom sont obligatoires." };
  }
  const svc = createServiceClient();
  const { error } = await svc
    .from("agents")
    .update({
      agence: infos.agence.trim(),
      ville: infos.ville.trim(),
      prenom: infos.prenom.trim(),
      nom: infos.nom.trim(),
      telephone: infos.telephone.trim() || null,
    })
    .eq("id", userId);
  if (error) return { error: error.message };
  // Garde le nom du profil cohérent avec la fiche agent.
  await svc
    .from("profiles")
    .update({ full_name: `${infos.prenom.trim()} ${infos.nom.trim()}` })
    .eq("id", userId);
  revalidatePath("/admin/agents");
  return { ok: true };
}

// Supprime définitivement un utilisateur (agent ou réceptif) et ses données liées.
export async function supprimerUtilisateur(
  userId: string,
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/agents");
  revalidatePath("/admin/receptifs");
  return { ok: true };
}
```

#### `src/lib/admin.ts`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Garde d'accès admin : renvoie le profil admin ou redirige.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/mon-espace");
  return { user, profile, supabase };
}
```

---

## 6. ⭐ Fonctions SPÉCIFIQUES à l'édition de septembre

Tout ce qui a été pensé pour **ce salon précis** et qu'un outil générique n'aurait pas anticipé :

- **3 jours fixes, en dur** : **mardi 15, mercredi 16, jeudi 17 septembre 2026**. Ces dates sont
  **codées** partout : `CHECK (jour IN ('2026-09-15','2026-09-16','2026-09-17'))` sur 5 tables, et
  `src/lib/jours.ts` (source unique côté front : `iso`, `label` « Mardi 15 », `court` « Mar »,
  `courtDate` « Mar 15 »). **Point d'intégration** : dé-hardcoder pour un module ré-éditable.

- **Trois formats de rendez-vous propres à TogeZer** (vocabulaire marketing du salon) :
  - **« Les Petits-Dejs TogeZer »** — RDV en tête-à-tête de **20 min**, matin **9h00 → 13h00**.
  - **« Dejs Biz Biz »** — déjeuner réseautage **13h00 → 14h00**, convivial (assis/debout).
  - **« Les Z'aprems »** — après-midi **14h00 → 18h00** : formations par destination **+** RDV
    tête-à-tête de **30 min**.

- **Formules réceptif (internes, jamais choisies par l'agent)** — `formule_type` par jour :
  - `petits_dej` : présent le matin (9h-13h) → propose des RDV matin.
  - `biz_biz` : matin + déjeuner (9h-14h).
  - `journee` : journée complète (9h-18h) → propose matin **et** après-midi.
  - `absent`.
  Ce sont **elles** qui déterminent quels créneaux un réceptif propose, pas un réglage agent.

- **Créneaux façonnés pour le salon** :
  - Matin : **12 créneaux de 20 min** (09:00 → 12:40).
  - Après-midi : **8 créneaux de 30 min** (14:00 → 17:30), **réservés aux réceptifs `journee`**.
  - Déjeuner : **13:00-14:00**, non découpé (positionnement, pas de slot).

- **Cas « Mathilde » / regroupement (générique)** : plusieurs réceptifs représentés par la même
  personne partagent un `groupe_id` → **même `resource_id`** → **blocage croisé** automatique
  (réserver l'Islande à 9h occupe le Maroc et la Tanzanie à 9h). Concrètement, cette édition :
  **Alkémia, Tamazirt, Serengeti** représentés par **Mathilde**.

- **Un seul RDV par couple agent↔réceptif** sur **tout l'événement** (pas par jour) :
  index unique `uniq_agent_receptif_rdv`. Règle métier terrain : on ne « monopolise » pas un réceptif.

- **Déjeuner réseautage** : capacité **globale par jour** (`dejeuner_config`), l'agent se
  **positionne** (`demandes_dejeuner`, non bloquant), l'admin **cure** ensuite (statut). Le
  « meet & match déjeuner » (qui déjeune avec qui) est **volontairement reporté** — le champ
  `receptifs_souhaites uuid[]` est déjà là pour l'accueillir.

- **Présentations / formations** (`presences.tient_presentation`, `theme`, `salle`,
  `presentation_debut`) + `engagement_kind` `presentation_hold` (le réceptif occupe sa salle,
  bloque ses RDV) et `presentation_inscription` (un agent y assiste). **Schéma en place, UI non
  encore exposée** — prévu pour les « Z'aprems ».

- **Lieu en dur** : **Voie 15, 397 bis rue de Vaugirard, 75015 Paris** (Porte de Versailles),
  lien Maps, 3 photos du lieu (galerie lightbox sur l'accueil).

- **Engagement moral de l'agent** : case à cocher « je m'engage à honorer / annuler mes RDV »
  → `agents.engagement_at` (`valider_engagement`). Sert au discours anti no-show.

- **Module d'assignation des tables à Voie 15** : **noté, pas encore développé.** Principe prévu :
  partir des RDV confirmés → calcul déterministe table/créneau, réceptif fixe toute la matinée,
  tables de 4 pour regroupements, équité belle/moyenne/moins-bonne salle sur 3 jours, proposition
  + échange manuel, contrainte base « jamais 2 RDV même table même créneau ».

---

## 7. Système de rendez-vous (cœur de la logique)

### 7.1 Génération des créneaux

Côté front, `src/lib/creneaux.ts` génère `CRENEAUX_MATIN` (09:00→12:40, pas de 20 min) et
`CRENEAUX_APREM` (14:00→17:30, pas de 30 min), + helpers `affiche` ("09:00"→"9h00") et
`normDebut` (normalise un timestamp SQL/ISO en "YYYY-MM-DD HH:MM"). Côté base, les fonctions
valident les créneaux par calcul (modulo 20/30, bornes horaires).

### 7.2 Anti-conflit / anti double-booking — **garantie structurelle**

Le zéro double-booking n'est **pas** géré applicativement mais **par la base**, via deux
contraintes d'exclusion PostgreSQL (extension `btree_gist`) sur la table `engagements` :

- **`engagements_agent_no_overlap`** — un **agent** ne peut jamais avoir deux engagements
  confirmés dont les `plage` (tsrange) se chevauchent.
- **`engagements_resource_no_overlap`** — une **ressource** (`resource_id` = réceptif ou groupe)
  non plus.

Effet : même en cas de clics simultanés, **un seul** `INSERT` passe ; les autres lèvent
`exclusion_violation` (errcode `23P01`), traduit en message clair. C'est infalsifiable côté client.

### 7.3 Écritures = fonctions SECURITY DEFINER (RPC)

Aucune écriture directe. Les fonctions clés (verbatim en §14) :

- `reserver_rdv(exposant, debut)` — réservation agent : vérifie agent inscrit, jour de venue,
  présence/formule du réceptif, validité du créneau (matin 20'/après-midi 30'), calcule
  `resource_id = coalesce(groupe_id, id)`, insère ; capture `exclusion_violation`.
- `annuler_engagement(id, message)` — annulation par l'agent concerné **ou** l'admin (statut→annule).
- `annuler_mes_rdv()` — l'agent réinitialise tous ses RDV.
- `definir_jours_agent(jours[])` — pose les jours de venue **et** annule les RDV + retire les
  demandes de déjeuner des jours retirés (cascade métier).
- `deplacer_rdv(id, nouveau_debut)` — **admin** : déplace un RDV, re-valide le créneau,
  anti-conflit garanti.
- `admin_creer_rdv(agent, exposant, debut)` — **admin** : crée un RDV.
- `receptif_reserver_agent(agent, debut)` / `receptif_annuler(id)` — le réceptif réserve/annule
  avec un agent, sur créneau commun (présence ∩ jour agent ∩ dispo agent), 1 RDV/agent max.
- Lectures : `creneaux_occupes(exposant, jour)` (sans révéler qui), `mes_engagements()`,
  `admin_rendez_vous()`, `receptif_rendez_vous()`, `creneaux_agent(agent)` (statut libre/indispo/ensemble).

### 7.4 Durées, annulations, historique

- Durées : matin **20 min**, après-midi **30 min**, RDV réceptif→agent **20 min**.
- Annulation = passage `statut='annule'` (la ligne est conservée → **historique**), ce qui
  **libère** le créneau (les contraintes/indices sont partiels `WHERE statut='confirme'`).
- Pas de suppression physique des engagements annulés (traçabilité).

**Code verbatim du cœur RDV côté front** : `reservation/page.tsx`, `reservation/Booking.tsx`,
`reservation/JoursSelector.tsx`, `lib/creneaux.ts`, `lib/jours.ts` (§ ci-dessous). Les fonctions
SQL sont en §14.

---

## 8. Autres fonctions

- **Messagerie** (`messages`, RPC `envoyer_message` / `mes_conversations` / `fil`, composant
  `Messagerie.tsx`) : 1 conversation = 1 couple (agent, réceptif), échange possible avec ou sans
  RDV. Cloisonnée par RLS. Rafraîchissement léger (polling 8 s). Ouverture directe d'une conversation
  via `/messages?receptif=ID` (depuis un RDV). Côté réceptif, intégrée dans `/espace-receptif`.
- **Sollicitation réceptif → agent** (`SolliciterAgent.tsx`, RPC `receptif_agents`,
  `creneaux_agent`, `receptif_reserver_agent`, `receptif_annuler`) : le réceptif voit les créneaux
  **communs** avec statut (libre / indispo / ensemble) et propose un RDV.
- **Annuaire public** (`/annuaire`, `AnnuaireClient.tsx`) : cartes réceptifs (logo, destinations —
  principale en rouge, secondaires en virgules), filtres continent/pays/jour, badges de présence
  avec dates (Mar 15 / Mer 16 / Jeu 17).
- **Exports** : **CSV** des rendez-vous (vue admin). Pas d'ICS/PDF (prévus « palier 6 »).
- **Notifications e-mail** : uniquement les **transactionnels Supabase Auth** (confirmation
  d'inscription, réinitialisation de mot de passe). Les relances/rappels et l'envoi depuis
  `hello@togezer.travel` (via **Resend**) sont **prévus mais non branchés** (dépend d'un accès DNS).
- **Déjeuner** : positionnement agent (§6), remonté dans le KPI admin « Déjeuners à valider ».
- **Engagement** de l'agent (§6).

---

## 9. Personnalisation / thème

**Charte « gare rétro européenne années 50 »**, sobre, un seul geste libre (le Z-pinceau).
Configurable via `tailwind.config.ts` (tokens couleurs + polices) et `globals.css` (import des
polices, grain SVG). Tokens (verbatim en §14) :

- Couleurs : `creme #F5EFE2` (fond papier), `carte #FBF7EE`, `ligne #D8C6A8`, `encre #3B2F26`
  (brun espresso, jamais noir dur), `encreDoux #7C6C5B`, **`brique #B0503C`** (accent lead),
  `briqueFonce #8E3E2E`, palette du Z : `zBrique`, `zMoutarde #C79A46`, `zSarcelle #4E827D`,
  `zSauge #93A079`.
- Polices : `titre` = Cormorant Garamond (serif élégant), `corps` = Mulish.
- Ombre `carte`, ornements maison (`components/Ornaments.tsx` : GlobeGrid, FiletGare…),
  logo officiel `public/logo-togezer.png` (composant `Wordmark`).

Ce qui est « paramétrable » aujourd'hui relève surtout du **contenu admin** (fiches réceptifs,
présences, formules, textes en dur des pages). Il n'y a pas d'écran de configuration de thème :
la charte est dans le code.

---

## 10. Règles métier (validations, calculs, limites, cas limites)

- Mot de passe : **≥ 8 caractères** (inscription, création compte réceptif, reset).
- Jours de venue : **≥ 1** obligatoire pour réserver ; RDV possibles **uniquement** avec les
  réceptifs présents un de ces jours.
- Créneau matin valide : minute multiple de 20, entre 09:00 et 12:40 ; après-midi : minute ∈ {0,30},
  14:00–17:30, **et** formule `journee`.
- **1 RDV max par couple agent↔réceptif** (tout l'événement).
- Anti-chevauchement agent **et** ressource (contraintes base).
- Retirer un jour de venue → **annule** les RDV de ce jour + retire le déjeuner de ce jour.
- Message de chat : non vide, ≤ 4000 caractères ; expéditeur = l'agent OU le proprio du réceptif
  (vérifié en base).
- Déjeuner : seulement un jour où l'agent vient ; 1 demande par (agent, jour).
- Réceptif→agent : créneau matin valide, présence du réceptif ce jour, agent présent ce jour,
  créneau non fermé par l'agent, 1 RDV/agent max.
- Admin : `deplacer_rdv`/`admin_creer_rdv` re-valident le créneau ; refus si cible occupée.
- Annulation : conserve la ligne (`statut='annule'`), libère le créneau.
- E-mail agent = **identifiant de connexion**, non modifiable dans l'UI (ni `/mes-informations`
  côté agent, ni `EditAgent` côté admin).

---

## 11. Ce qui est UNIQUE / astucieux — à préserver

1. **Anti double-booking par contraintes d'exclusion PostgreSQL** (pas applicatif) : robustesse de
   niveau « plateforme pro », infalsifiable même en concurrence. **À conserver absolument.**
2. **`resource_id` unifié (réceptif OU groupe)** → blocage croisé des regroupements « gratuit »,
   d'une seule contrainte. Élégant et générique.
3. **Tout en `SECURITY DEFINER` + RLS stricte** : zéro écriture directe, messages d'erreur métier
   traduits, cloisonnement réel par rôle.
4. **Banc de tests des règles vitales** (`scripts/test-regles.mjs`) : 10 règles (double-booking
   agent/ressource, 1 RDV/réceptif, formules matin/aprem, annulation libère, jour retiré annule,
   chat cloisonné + anti-usurpation) jouées sur la vraie base avec comptes `ZZ-TEST`
   auto-nettoyés. + `scripts/etat-prod.mjs` (sonde des migrations appliquées) + `PROD_STATE.md`.
5. **Créneaux « fermés » plutôt qu'« ouverts »** : agenda agent ouvert par défaut, on ne stocke
   que l'exception (indispo). Peu de lignes, logique simple.
6. **UX pensée terrain** : timeline pleine largeur par jour, engagement moral anti no-show,
   messagerie ouvrable depuis un RDV, filtres/export/masse côté admin.

---

## 12. Points d'attention pour l'intégration au Hub

**Simple :**
- Le modèle de données est propre, normalisé, documenté ; les règles métier sont explicites.
- Le vocabulaire (formules, types de RDV, jours) est centralisé (`lib/jours.ts`, `lib/creneaux.ts`).
- Pas de dépendances lourdes à migrer.

**Délicat (à cadrer) :**
- **Auth** : ici **Supabase Auth** (cookies SSR, trigger `handle_new_agent`, service_role pour
  l'admin). Le Hub a une **auth maison** → il faudra remapper : `profiles`/`agents`/rôles →
  utilisateurs du Hub ; réécrire la création de comptes réceptifs et les server actions
  (`generateLink` recovery, `admin.createUser`, `admin.deleteUser`) vers l'auth du Hub.
- **Accès données** : ici **PostgREST + RPC SQL** ; le Hub utilise **Prisma**. Deux options :
  (a) porter les fonctions SQL `SECURITY DEFINER` telles quelles (Postgres commun) et les appeler
  via Prisma `$queryRaw`, **en conservant les contraintes d'exclusion `btree_gist`** (le vrai
  trésor) ; (b) réimplémenter la logique en TypeScript **en gardant impérativement** les
  contraintes base anti-conflit. **Ne pas** réimplémenter l'anti-conflit uniquement en applicatif.
- **RLS** : le cloisonnement repose sur les policies Supabase (`auth.uid()`). Sous Prisma/auth
  maison, il faudra reproduire ce cloisonnement dans la couche d'accès (ou via des politiques PG
  équivalentes si la session porte l'uid).
- **Realtime/polling** : la messagerie fait du polling ; le Hub peut avoir mieux.
- **Emails** : brancher les transactionnels sur le système d'e-mails du Hub (le projet prévoyait
  Resend/`hello@togezer.travel`, jamais finalisé).
- **Dates/lieu en dur** : dé-hardcoder les 3 dates et le lieu pour un module ré-éditable
  (le Hub a déjà un module « La Station » — c'est le point de fusion naturel).
- **Créneaux fermés agent** : table + prise en compte réceptif présentes, mais **saisie retirée**
  de l'UI agent → décider si on réactive ou on nettoie.
- **Présentations / Z'aprems** : schéma prêt, UI absente → à compléter ou retirer côté fusion.
- **Fichiers** : logos/photos servis en statique (`public/`) ; sous le Hub, prévoir un stockage.

**Priorité de préservation :** (1) contraintes anti-conflit base, (2) modèle `engagements` +
`resource_id`, (3) fonctions SQL métier, (4) le back-office admin (workflow éprouvé), (5) le
banc de tests des règles vitales (garde-fou de non-régression pendant la fusion).

---

## 13. Arborescence complète du projet

```
.claude/launch.json
.env.local
.env.local.example
.github/workflows/ci.yml
.gitignore
DOSSIER_TECHNIQUE.md
README.md
data/exposants.json
next-env.d.ts
next.config.mjs
package-lock.json
package.json
postcss.config.mjs
public/logo-togezer.png
public/logos/african-eagle-namibie.svg
public/logos/algerie-tours.svg
public/logos/alkemia.svg
public/logos/archipel-contact.svg
public/logos/atypique-indonesie.svg
public/logos/atypique-voyages.svg
public/logos/bretzel-travel-gmbh.svg
public/logos/bretzel-travel.svg
public/logos/brightside-travel-ltd.svg
public/logos/brightside-travel.svg
public/logos/contact-voyages-senegal.svg
public/logos/elite-american-voyages.svg
public/logos/escapades-madagascar.svg
public/logos/evasion-tropicale.svg
public/logos/go-beyond.svg
public/logos/mai-globe-travels.svg
public/logos/mozsensations.svg
public/logos/phima-voyages.svg
public/logos/pura-vida-cabo-verde.svg
public/logos/senses-of-siam.svg
public/logos/serengeti-big-cats-safaris.svg
public/logos/serengeti.svg
public/logos/shanti-travel.svg
public/logos/sikiliza.svg
public/logos/swiss-travel-tour.svg
public/logos/tamazirt.svg
public/logos/tanganyika-expeditions.svg
public/logos/terra-australia.svg
public/logos/terra-balka.svg
public/logos/terra-chile.svg
public/logos/terra-dominicana.svg
public/logos/terra-gaia-altiplano.svg
public/logos/terra-gaia-argentina.svg
public/logos/terra-gaia-bolivia.svg
public/logos/terra-gaia-brazil.svg
public/logos/terra-gaia-ecuador-galapagos.svg
public/logos/terra-guatemala.svg
public/logos/terra-maya.svg
public/logos/terra-morocco.svg
public/logos/terra-nicaragua.svg
public/logos/terra-peru.svg
public/logos/tierra-latina-argentine-bresil.svg
public/logos/viasuntours.svg
public/logos/wakiy-tour.svg
public/logos/xplore.svg
public/voie15-acces.png
public/voie15-salle.png
public/voie15-terrasse.png
scripts/diag-admin.mjs
scripts/etat-prod.mjs
scripts/gen-logos.mjs
scripts/gen-seed.mjs
scripts/parse-csv.mjs
scripts/test-regles.mjs
src/app/admin/UserActions.tsx
src/app/admin/actions-users.ts
src/app/admin/agents/EditAgent.tsx
src/app/admin/agents/page.tsx
src/app/admin/layout.tsx
src/app/admin/page.tsx
src/app/admin/planning/Planning.tsx
src/app/admin/planning/page.tsx
src/app/admin/receptifs/AccesReceptif.tsx
src/app/admin/receptifs/EditForm.tsx
src/app/admin/receptifs/[id]/page.tsx
src/app/admin/receptifs/actions.ts
src/app/admin/receptifs/nouveau/page.tsx
src/app/admin/receptifs/page.tsx
src/app/admin/rendez-vous/RdvTable.tsx
src/app/admin/rendez-vous/page.tsx
src/app/annuaire/AnnuaireClient.tsx
src/app/annuaire/page.tsx
src/app/auth/confirm/route.ts
src/app/auth/erreur/page.tsx
src/app/connexion/ConnexionForm.tsx
src/app/connexion/page.tsx
src/app/espace-receptif/SolliciterAgent.tsx
src/app/espace-receptif/page.tsx
src/app/globals.css
src/app/inscription/InscriptionForm.tsx
src/app/inscription/page.tsx
src/app/layout.tsx
src/app/mes-informations/page.tsx
src/app/messages/page.tsx
src/app/mon-espace/Deconnexion.tsx
src/app/mon-espace/ModifierInfos.tsx
src/app/mon-espace/page.tsx
src/app/nouveau-mot-de-passe/page.tsx
src/app/page.tsx
src/app/reservation/Booking.tsx
src/app/reservation/JoursSelector.tsx
src/app/reservation/page.tsx
src/components/AppHeader.tsx
src/components/GalerieVoie15.tsx
src/components/Messagerie.tsx
src/components/Ornaments.tsx
src/components/Wordmark.tsx
src/lib/admin.ts
src/lib/creneaux.ts
src/lib/espace.ts
src/lib/jours.ts
src/lib/supabase/client.ts
src/lib/supabase/middleware.ts
src/lib/supabase/server.ts
src/lib/supabase/service.ts
src/middleware.ts
supabase/PROD_STATE.md
supabase/admin_bootstrap.sql
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_functions.sql
supabase/migrations/0004_agent_signup.sql
supabase/migrations/0005_exposant_admin_fields.sql
supabase/migrations/0007_ville_photo_jours.sql
supabase/migrations/0008_booking_reads.sql
supabase/migrations/0009_admin_rdv.sql
supabase/migrations/0010_un_rdv_par_receptif.sql
supabase/migrations/0011_engagement_agent.sql
supabase/migrations/0012_espace_receptif.sql
supabase/migrations/0013_reset_rdv.sql
supabase/migrations/0014_dispos_agent.sql
supabase/migrations/0015_planning_dnd.sql
supabase/migrations/0016_admin_creer_rdv.sql
supabase/migrations/0017_receptif_reserve_agent.sql
supabase/migrations/0018_chat.sql
supabase/migrations/0019_durcissement.sql
supabase/migrations/0020_dejeuner_agent.sql
supabase/seed.sql
tailwind.config.ts
tsconfig.json
```

---

## 14. Annexe — code source VERBATIM

Reproduit tel quel. **Aucun secret** ne figure dans ces fichiers (les clés vivent dans
`.env.local`, gitignoré). `supabase/seed.sql` (jeu de données factice) n'est pas recopié ici
mais est présent dans le dépôt.

### 14.1 Base de données — migrations SQL (ordre d'application)

#### `supabase/migrations/0001_schema.sql`

```sql
-- =====================================================================
--  La Station TogeZer — Schéma de base + contraintes anti-conflit
--  Palier 0 : socle
-- =====================================================================

create extension if not exists btree_gist;  -- exclusion gist sur uuid + tsrange
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- ---------- Types ----------
do $$ begin
  create type role_type as enum ('admin','receptif','agent','representant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type formule_type as enum ('absent','petits_dej','biz_biz','journee');
exception when duplicate_object then null; end $$;

do $$ begin
  -- rdv_matin (20'), rdv_aprem (30'), presentation_hold (le réceptif occupe sa salle),
  -- presentation_inscription (un agent assiste), dejeuner (networking curé)
  create type engagement_kind as enum
    ('rdv_matin','rdv_aprem','presentation_hold','presentation_inscription','dejeuner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_type as enum ('confirme','en_attente','annule');
exception when duplicate_object then null; end $$;

-- ---------- Profils (adossés à Supabase Auth) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       role_type not null,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

-- ---------- Groupes : agenda partagé (cas Mathilde), générique ----------
create table if not exists groupes (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  representant_id uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ---------- Exposants ----------
create table if not exists exposants (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  nom                 text not null,
  pays_principal      text not null,
  continent_principal text not null,
  description         text,
  logo_path           text,
  email_contact       text,
  groupe_id           uuid references groupes(id) on delete set null,   -- regroupement
  proprietaire_id     uuid references profiles(id) on delete set null,  -- compte réceptif
  created_at          timestamptz not null default now()
);

-- Destinations secondaires (un réceptif couvre souvent plusieurs pays) → filtres
create table if not exists exposant_destinations (
  id          uuid primary key default gen_random_uuid(),
  exposant_id uuid not null references exposants(id) on delete cascade,
  pays        text not null,
  continent   text not null
);

-- ---------- Présence + formule, par jour ----------
create table if not exists presences (
  id                 uuid primary key default gen_random_uuid(),
  exposant_id        uuid not null references exposants(id) on delete cascade,
  jour               date not null,
  formule            formule_type not null default 'absent',
  tient_presentation boolean not null default false,
  theme              text,
  salle              text,          -- attribué par l'admin (rotation)
  presentation_debut timestamptz,   -- attribué par l'admin (rotation)
  unique (exposant_id, jour),
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

-- ---------- Agents ----------
create table if not exists agents (
  id         uuid primary key references profiles(id) on delete cascade,
  agence     text not null,
  prenom     text not null,
  nom        text not null,
  email      text not null,
  telephone  text,
  created_at timestamptz not null default now()
);

create table if not exists agent_jours (
  agent_id uuid not null references agents(id) on delete cascade,
  jour     date not null,
  primary key (agent_id, jour),
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

-- ---------- Déjeuner : capacité globale par jour ----------
create table if not exists dejeuner_config (
  jour     date primary key,
  capacite int not null default 0,
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

create table if not exists demandes_dejeuner (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references agents(id) on delete cascade,
  jour               date not null,
  receptifs_souhaites uuid[] not null default '{}', -- non bloquant
  statut             statut_type not null default 'en_attente',
  created_at         timestamptz not null default now(),
  unique (agent_id, jour),
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

-- =====================================================================
--  ENGAGEMENTS — le cœur anti-conflit
--  Deux contraintes d'exclusion garantissent le zéro double-booking.
-- =====================================================================
create table if not exists engagements (
  id                uuid primary key default gen_random_uuid(),
  kind              engagement_kind not null,
  agent_id          uuid references agents(id) on delete cascade,       -- null pour presentation_hold
  exposant_id       uuid references exposants(id) on delete cascade,    -- fiche concernée
  resource_id       uuid,   -- = groupe_id si regroupé, sinon exposant_id ; null pour dejeuner & presentation_inscription
  jour              date not null,
  plage             tsrange not null,      -- créneau daté (jour + heure) → jamais de chevauchement inter-jours
  statut            statut_type not null default 'confirme',
  message_annulation text,
  created_at        timestamptz not null default now(),
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

-- (1) Un agent ne peut jamais avoir deux engagements qui se chevauchent
--     (RDV matin, RDV après-midi, présentation, déjeuner validé confondus).
alter table engagements drop constraint if exists engagements_agent_no_overlap;
alter table engagements add constraint engagements_agent_no_overlap
  exclude using gist (agent_id with =, plage with &&)
  where (agent_id is not null and statut = 'confirme');

-- (2) Une ressource (réceptif OU groupe) ne peut jamais recevoir deux RDV simultanés.
--     Comme les fiches regroupées partagent resource_id = groupe_id, réserver 9h00
--     sur l'Islande occupe mécaniquement le 9h00 du Maroc et de la Tanzanie.
--     Couvre aussi le blocage des RDV pendant l'heure de présentation (presentation_hold).
alter table engagements drop constraint if exists engagements_resource_no_overlap;
alter table engagements add constraint engagements_resource_no_overlap
  exclude using gist (resource_id with =, plage with &&)
  where (resource_id is not null and statut = 'confirme');

-- Index de confort
create index if not exists idx_eng_agent   on engagements (agent_id);
create index if not exists idx_eng_expo    on engagements (exposant_id);
create index if not exists idx_eng_jour    on engagements (jour);
create index if not exists idx_pres_expo   on presences (exposant_id);
create index if not exists idx_dest_expo   on exposant_destinations (exposant_id);
```

#### `supabase/migrations/0002_rls.sql`

```sql
-- =====================================================================
--  RLS — cloisonnement strict des accès
--  Règle : les écritures d'engagements passent EXCLUSIVEMENT par les
--  fonctions SECURITY DEFINER (0003). Aucune écriture directe côté client.
-- =====================================================================

-- Helpers
create or replace function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function mes_groupes() returns setof uuid language sql stable as $$
  select id from groupes where representant_id = auth.uid();
$$;

-- ---------- profiles ----------
alter table profiles enable row level security;
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for select
  using (id = auth.uid() or is_admin());

-- ---------- Annuaire : lecture ouverte (tous les agents voient tout) ----------
alter table exposants enable row level security;
alter table exposant_destinations enable row level security;
alter table presences enable row level security;
alter table groupes enable row level security;

drop policy if exists p_expo_read on exposants;
create policy p_expo_read on exposants for select using (true);
drop policy if exists p_expo_write on exposants;
create policy p_expo_write on exposants for all using (is_admin()) with check (is_admin());

drop policy if exists p_dest_read on exposant_destinations;
create policy p_dest_read on exposant_destinations for select using (true);
drop policy if exists p_dest_write on exposant_destinations;
create policy p_dest_write on exposant_destinations for all using (is_admin()) with check (is_admin());

drop policy if exists p_pres_read on presences;
create policy p_pres_read on presences for select using (true);
drop policy if exists p_pres_write on presences;
create policy p_pres_write on presences for all using (is_admin()) with check (is_admin());

drop policy if exists p_grp_read on groupes;
create policy p_grp_read on groupes for select using (true);
drop policy if exists p_grp_write on groupes;
create policy p_grp_write on groupes for all using (is_admin()) with check (is_admin());

-- ---------- agents ----------
alter table agents enable row level security;
alter table agent_jours enable row level security;

drop policy if exists p_agents_self on agents;
create policy p_agents_self on agents for select using (id = auth.uid() or is_admin());
drop policy if exists p_agents_upd on agents;
create policy p_agents_upd on agents for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_ajours_self on agent_jours;
create policy p_ajours_self on agent_jours for select using (agent_id = auth.uid() or is_admin());

-- ---------- déjeuner ----------
alter table dejeuner_config enable row level security;
alter table demandes_dejeuner enable row level security;

drop policy if exists p_dcfg_read on dejeuner_config;
create policy p_dcfg_read on dejeuner_config for select using (true);
drop policy if exists p_dcfg_write on dejeuner_config;
create policy p_dcfg_write on dejeuner_config for all using (is_admin()) with check (is_admin());

drop policy if exists p_ddej_self on demandes_dejeuner;
create policy p_ddej_self on demandes_dejeuner for select
  using (agent_id = auth.uid() or is_admin());

-- ---------- engagements : lecture cloisonnée par rôle ----------
alter table engagements enable row level security;

drop policy if exists p_eng_read on engagements;
create policy p_eng_read on engagements for select using (
  is_admin()
  -- l'agent voit ses propres engagements
  or agent_id = auth.uid()
  -- le réceptif propriétaire voit les RDV pris sur sa fiche
  or exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  -- le représentant regroupé voit l'agenda partagé de ses groupes
  or resource_id in (select mes_groupes())
  -- les réceptifs regroupés ont un accès lecture seule sur leur fiche
  or exposant_id in (
      select e.id from exposants e
      where e.proprietaire_id = auth.uid()
  )
);
-- (aucune policy insert/update/delete : les écritures passent par les RPC SECURITY DEFINER)
```

#### `supabase/migrations/0003_functions.sql`

```sql
-- =====================================================================
--  Moteur de réservation — fonctions transactionnelles (SECURITY DEFINER)
--  Toute écriture d'engagement passe par ici. L'anti-conflit est garanti
--  par les contraintes d'exclusion (0001) ; ces fonctions traduisent les
--  règles métier et renvoient des messages clairs.
--  (Chemin RDV confirmés instantanément — matin 20', après-midi 30'.)
-- =====================================================================

create or replace function reserver_rdv(p_exposant_id uuid, p_debut timestamp)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent    uuid := auth.uid();
  v_jour     date := p_debut::date;
  v_time     time := p_debut::time;
  v_formule  formule_type;
  v_resource uuid;
  v_kind     engagement_kind;
  v_duree    interval;
  v_id       uuid;
begin
  if not exists (select 1 from agents where id = v_agent) then
    raise exception 'Seuls les agents inscrits peuvent réserver un rendez-vous.';
  end if;

  if not exists (select 1 from agent_jours where agent_id = v_agent and jour = v_jour) then
    raise exception 'Vous n''êtes pas inscrit ce jour-là. Ajoutez ce jour pour réserver.';
  end if;

  select formule into v_formule from presences
    where exposant_id = p_exposant_id and jour = v_jour;
  if v_formule is null or v_formule = 'absent' then
    raise exception 'Ce réceptif n''est pas présent ce jour-là.';
  end if;

  -- Matin : créneaux de 20 min, 09h00 → 12h40
  if v_time >= time '09:00' and v_time < time '13:00' then
    if (extract(minute from v_time)::int % 20) <> 0 or v_time > time '12:40' then
      raise exception 'Créneau du matin invalide (créneaux de 20 min de 9h00 à 12h40).';
    end if;
    if v_formule not in ('petits_dej','biz_biz','journee') then
      raise exception 'Ce réceptif ne propose pas de petit-déjeuner ce jour-là.';
    end if;
    v_kind := 'rdv_matin'; v_duree := interval '20 minutes';

  -- Après-midi : créneaux de 30 min, 14h00 → 17h30
  elsif v_time >= time '14:00' and v_time < time '18:00' then
    if (extract(minute from v_time)::int) not in (0,30) or v_time > time '17:30' then
      raise exception 'Créneau de l''après-midi invalide (créneaux de 30 min de 14h00 à 17h30).';
    end if;
    if v_formule <> 'journee' then
      raise exception 'Les rendez-vous de l''après-midi sont réservés aux Pass Journée.';
    end if;
    v_kind := 'rdv_aprem'; v_duree := interval '30 minutes';

  else
    raise exception 'Hors plage de rendez-vous individuels.';
  end if;

  -- Ressource = groupe si regroupé, sinon exposant (→ blocage croisé Mathilde)
  select coalesce(groupe_id, id) into v_resource from exposants where id = p_exposant_id;

  begin
    insert into engagements (kind, agent_id, exposant_id, resource_id, jour, plage, statut)
    values (v_kind, v_agent, p_exposant_id, v_resource, v_jour,
            tsrange(p_debut, p_debut + v_duree, '[)'), 'confirme')
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'Créneau indisponible : vous-même ou ce réceptif avez déjà un engagement sur ce créneau.'
        using errcode = '23P01';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
--  Annulation / modification par l'agent (libère le créneau)
-- ---------------------------------------------------------------------
create or replace function annuler_engagement(p_id uuid, p_message text default null)
returns table (exposant_id uuid, resource_id uuid, jour date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
begin
  update engagements e
     set statut = 'annule',
         message_annulation = p_message
   where e.id = p_id
     and (e.agent_id = v_agent or is_admin())
     and e.statut <> 'annule'
  returning e.exposant_id, e.resource_id, e.jour
    into exposant_id, resource_id, jour;

  if not found then
    raise exception 'Rendez-vous introuvable ou non autorisé.';
  end if;
  return next;
end;
$$;

grant execute on function reserver_rdv(uuid, timestamp) to authenticated;
grant execute on function annuler_engagement(uuid, text) to authenticated;
```

#### `supabase/migrations/0004_agent_signup.sql`

```sql
-- =====================================================================
--  Inscription agent : à la création d'un compte Auth, on crée
--  automatiquement le profil (role=agent) et la fiche agent, à partir
--  des métadonnées transmises au signUp.
--  NB : les jours de venue sont choisis APRÈS l'inscription, à la
--  première étape de la prise de rendez-vous (pas ici).
-- =====================================================================

create or replace function handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- On ne traite que les inscriptions agents (métadonnées 'agence' présentes)
  if (new.raw_user_meta_data ? 'agence') then
    insert into profiles (id, role, email, full_name)
      values (
        new.id, 'agent', new.email,
        trim(coalesce(new.raw_user_meta_data->>'prenom','') || ' ' ||
             coalesce(new.raw_user_meta_data->>'nom',''))
      )
      on conflict (id) do nothing;

    insert into agents (id, agence, prenom, nom, email, telephone)
      values (
        new.id,
        new.raw_user_meta_data->>'agence',
        new.raw_user_meta_data->>'prenom',
        new.raw_user_meta_data->>'nom',
        new.email,
        nullif(new.raw_user_meta_data->>'telephone','')
      )
      on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_agent();
```

#### `supabase/migrations/0005_exposant_admin_fields.sql`

```sql
-- =====================================================================
--  Champs additionnels sur les exposants (données d'inscription réelles,
--  utiles à l'administration).
-- =====================================================================
alter table exposants
  add column if not exists contact_nom  text,
  add column if not exists whatsapp     text,
  add column if not exists nb_personnes int,
  add column if not exists notes        text,
  add column if not exists representant text;
```

#### `supabase/migrations/0007_ville_photo_jours.sql`

```sql
-- =====================================================================
--  0007 — Ville de l'agence, photo/bio du représentant réceptif,
--         et fonction de choix des jours (1re étape de la prise de RDV).
-- =====================================================================

-- Ville de l'agence (agent)
alter table agents add column if not exists ville text;

-- Représentant côté réceptif : photo + petite bio (brise-glace humain)
alter table exposants add column if not exists contact_photo text;
alter table exposants add column if not exists contact_bio   text;

-- Trigger d'inscription agent : on stocke aussi la ville
create or replace function handle_new_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.raw_user_meta_data ? 'agence') then
    insert into profiles (id, role, email, full_name)
      values (new.id, 'agent', new.email,
        trim(coalesce(new.raw_user_meta_data->>'prenom','') || ' ' ||
             coalesce(new.raw_user_meta_data->>'nom','')))
      on conflict (id) do nothing;
    insert into agents (id, agence, ville, prenom, nom, email, telephone)
      values (new.id,
        new.raw_user_meta_data->>'agence',
        new.raw_user_meta_data->>'ville',
        new.raw_user_meta_data->>'prenom',
        new.raw_user_meta_data->>'nom',
        new.email,
        nullif(new.raw_user_meta_data->>'telephone',''))
      on conflict (id) do nothing;
  end if;
  return new;
end; $$;

-- 1re étape de la prise de RDV : l'agent choisit / met à jour ses jours de venue.
-- Retirer un jour annule aussi les RDV de l'agent sur ce jour.
create or replace function definir_jours_agent(p_jours date[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Seuls les agents peuvent choisir leurs jours.';
  end if;

  -- Annule les engagements de l'agent sur les jours retirés
  update engagements set statut = 'annule'
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  -- Met à jour la liste des jours
  delete from agent_jours
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  insert into agent_jours (agent_id, jour)
   select v_uid, unnest(coalesce(p_jours, '{}'))
  on conflict do nothing;
end; $$;

grant execute on function definir_jours_agent(date[]) to authenticated;
```

#### `supabase/migrations/0008_booking_reads.sql`

```sql
-- =====================================================================
--  0008 — Lectures pour la prise de RDV (côté agent).
--  Un agent ne peut PAS voir les RDV des autres (RLS). Ces fonctions
--  SECURITY DEFINER exposent juste ce qu'il faut : les créneaux OCCUPÉS
--  d'un réceptif (sans révéler qui), et le programme de l'agent connecté.
-- =====================================================================

-- Créneaux occupés sur la ressource d'un réceptif (gère le blocage croisé
-- des regroupements via resource_id, et le blocage pendant les présentations).
create or replace function creneaux_occupes(p_exposant_id uuid, p_jour date)
returns table (debut timestamp)
language sql
security definer
set search_path = public
as $$
  select lower(plage)::timestamp as debut
  from engagements
  where statut = 'confirme'
    and jour = p_jour
    and resource_id = (select coalesce(groupe_id, id) from exposants where id = p_exposant_id);
$$;
grant execute on function creneaux_occupes(uuid, date) to authenticated;

-- Programme de l'agent connecté (avec nom du réceptif + représentant éventuel,
-- pour révéler « avec Mathilde Quéva » au récapitulatif).
create or replace function mes_engagements()
returns table (
  id uuid,
  exposant_id uuid,
  exposant_nom text,
  representant text,
  jour date,
  kind engagement_kind,
  debut timestamp,
  fin timestamp
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.exposant_id, x.nom, x.representant, e.jour, e.kind,
         lower(e.plage)::timestamp, upper(e.plage)::timestamp
  from engagements e
  left join exposants x on x.id = e.exposant_id
  where e.agent_id = auth.uid() and e.statut = 'confirme'
  order by e.jour, lower(e.plage);
$$;
grant execute on function mes_engagements() to authenticated;
```

#### `supabase/migrations/0009_admin_rdv.sql`

```sql
-- =====================================================================
--  0009 — Vue admin de tous les rendez-vous (confirmés), avec les
--  infos agent + réceptif, pour la supervision et les exports.
-- =====================================================================
create or replace function admin_rendez_vous()
returns table (
  id uuid,
  jour date,
  debut timestamp,
  fin timestamp,
  kind engagement_kind,
  agence text,
  agent_nom text,
  agent_email text,
  receptif text,
  representant text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.jour, lower(e.plage)::timestamp, upper(e.plage)::timestamp, e.kind,
         a.agence, trim(a.prenom || ' ' || a.nom), a.email, x.nom, x.representant
  from engagements e
  left join agents a on a.id = e.agent_id
  left join exposants x on x.id = e.exposant_id
  where e.statut = 'confirme' and (select is_admin())
  order by e.jour, lower(e.plage);
$$;
grant execute on function admin_rendez_vous() to authenticated;
```

#### `supabase/migrations/0010_un_rdv_par_receptif.sql`

```sql
-- =====================================================================
--  0010 — Règle : UN SEUL rendez-vous individuel par réceptif et par
--  agent (matin OU après-midi, pas les deux, pas deux fois).
-- =====================================================================

-- 1) Nettoyage des doublons éventuels : on garde le 1er, on annule les autres.
update engagements e
   set statut = 'annule'
 where kind in ('rdv_matin', 'rdv_aprem')
   and statut = 'confirme'
   and exists (
     select 1 from engagements e2
     where e2.agent_id = e.agent_id
       and e2.resource_id = e.resource_id
       and e2.kind in ('rdv_matin', 'rdv_aprem')
       and e2.statut = 'confirme'
       and (lower(e2.plage) < lower(e.plage)
            or (lower(e2.plage) = lower(e.plage) and e2.id < e.id))
   );

-- 2) Index unique : impossible d'avoir 2 RDV confirmés (agent, réceptif/groupe).
create unique index if not exists uniq_agent_receptif_rdv
  on engagements (agent_id, resource_id)
  where kind in ('rdv_matin', 'rdv_aprem') and statut = 'confirme';

-- 3) reserver_rdv : message clair + vérification explicite.
create or replace function reserver_rdv(p_exposant_id uuid, p_debut timestamp)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent    uuid := auth.uid();
  v_jour     date := p_debut::date;
  v_time     time := p_debut::time;
  v_formule  formule_type;
  v_resource uuid;
  v_kind     engagement_kind;
  v_duree    interval;
  v_id       uuid;
begin
  if not exists (select 1 from agents where id = v_agent) then
    raise exception 'Seuls les agents inscrits peuvent réserver un rendez-vous.';
  end if;
  if not exists (select 1 from agent_jours where agent_id = v_agent and jour = v_jour) then
    raise exception 'Vous n''êtes pas inscrit ce jour-là. Ajoutez ce jour pour réserver.';
  end if;

  select formule into v_formule from presences
    where exposant_id = p_exposant_id and jour = v_jour;
  if v_formule is null or v_formule = 'absent' then
    raise exception 'Ce réceptif n''est pas présent ce jour-là.';
  end if;

  if v_time >= time '09:00' and v_time < time '13:00' then
    if (extract(minute from v_time)::int % 20) <> 0 or v_time > time '12:40' then
      raise exception 'Créneau du matin invalide (créneaux de 20 min de 9h00 à 12h40).';
    end if;
    if v_formule not in ('petits_dej','biz_biz','journee') then
      raise exception 'Ce réceptif ne propose pas de petit-déjeuner ce jour-là.';
    end if;
    v_kind := 'rdv_matin'; v_duree := interval '20 minutes';
  elsif v_time >= time '14:00' and v_time < time '18:00' then
    if (extract(minute from v_time)::int) not in (0,30) or v_time > time '17:30' then
      raise exception 'Créneau de l''après-midi invalide (créneaux de 30 min de 14h00 à 17h30).';
    end if;
    if v_formule <> 'journee' then
      raise exception 'Les rendez-vous de l''après-midi sont réservés aux Pass Journée.';
    end if;
    v_kind := 'rdv_aprem'; v_duree := interval '30 minutes';
  else
    raise exception 'Hors plage de rendez-vous individuels.';
  end if;

  select coalesce(groupe_id, id) into v_resource from exposants where id = p_exposant_id;

  -- UN SEUL RDV par réceptif/groupe et par agent
  if exists (
    select 1 from engagements
    where agent_id = v_agent and resource_id = v_resource
      and kind in ('rdv_matin','rdv_aprem') and statut = 'confirme'
  ) then
    raise exception 'Vous avez déjà un rendez-vous avec ce réceptif (un seul par réceptif).';
  end if;

  begin
    insert into engagements (kind, agent_id, exposant_id, resource_id, jour, plage, statut)
    values (v_kind, v_agent, p_exposant_id, v_resource, v_jour,
            tsrange(p_debut, p_debut + v_duree, '[)'), 'confirme')
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'Vous avez déjà un rendez-vous avec ce réceptif (un seul par réceptif).';
    when exclusion_violation then
      raise exception 'Créneau indisponible : vous-même ou ce réceptif avez déjà un engagement sur ce créneau.'
        using errcode = '23P01';
  end;

  return v_id;
end;
$$;
```

#### `supabase/migrations/0011_engagement_agent.sql`

```sql
-- =====================================================================
--  0011 — Engagement de l'agent (« je m'engage à honorer / annuler »).
-- =====================================================================
alter table agents add column if not exists engagement_at timestamptz;

create or replace function valider_engagement()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Agent introuvable.';
  end if;
  update agents set engagement_at = now() where id = v_uid;
end;
$$;
grant execute on function valider_engagement() to authenticated;
```

#### `supabase/migrations/0012_espace_receptif.sql`

```sql
-- =====================================================================
--  0012 — Espace réceptif : ses rendez-vous (agents qui ont réservé
--  avec lui). SECURITY DEFINER car un réceptif ne voit pas la table
--  agents directement (RLS).
-- =====================================================================
create or replace function receptif_rendez_vous()
returns table (
  id uuid,
  jour date,
  debut timestamp,
  fin timestamp,
  kind engagement_kind,
  receptif text,
  agence text,
  agent_nom text,
  agent_email text,
  agent_ville text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.jour, lower(e.plage)::timestamp, upper(e.plage)::timestamp, e.kind,
         x.nom, a.agence, trim(a.prenom || ' ' || a.nom), a.email, a.ville
  from engagements e
  join exposants x on x.id = e.exposant_id
  left join agents a on a.id = e.agent_id
  where e.statut = 'confirme'
    and x.proprietaire_id = auth.uid()
  order by e.jour, lower(e.plage);
$$;
grant execute on function receptif_rendez_vous() to authenticated;
```

#### `supabase/migrations/0013_reset_rdv.sql`

```sql
-- =====================================================================
--  0013 — L'agent peut réinitialiser (annuler) tous ses rendez-vous.
-- =====================================================================
create or replace function annuler_mes_rdv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update engagements
     set statut = 'annule'
   where agent_id = auth.uid()
     and kind in ('rdv_matin', 'rdv_aprem')
     and statut = 'confirme';
end;
$$;
grant execute on function annuler_mes_rdv() to authenticated;
```

#### `supabase/migrations/0014_dispos_agent.sql`

```sql
-- =====================================================================
--  0014 — Disponibilités de l'agent (Bloc C phase 2).
--  Par défaut, l'agenda de l'agent est OUVERT sur tous les créneaux du
--  matin (9h-13h) de ses jours. On stocke uniquement les créneaux qu'il
--  FERME (se rend indisponible). Sert aux réceptifs (phase 3) pour lui
--  proposer un RDV là où il est ouvert.
-- =====================================================================
create table if not exists agent_creneaux_fermes (
  agent_id uuid not null references agents(id) on delete cascade,
  jour     date not null,
  hhmm     text not null,
  primary key (agent_id, jour, hhmm),
  check (jour in (date '2026-09-15', date '2026-09-16', date '2026-09-17'))
);

alter table agent_creneaux_fermes enable row level security;
drop policy if exists p_acf_self on agent_creneaux_fermes;
create policy p_acf_self on agent_creneaux_fermes for select
  using (agent_id = auth.uid() or is_admin());

create or replace function mes_creneaux_fermes()
returns table (jour date, hhmm text)
language sql security definer set search_path = public as $$
  select jour, hhmm from agent_creneaux_fermes where agent_id = auth.uid();
$$;
grant execute on function mes_creneaux_fermes() to authenticated;

-- Ouvre/ferme un créneau. Retourne true si désormais fermé, false si ouvert.
create or replace function basculer_creneau(p_jour date, p_hhmm text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ferme boolean;
begin
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Agent introuvable.';
  end if;
  if not exists (select 1 from agent_jours where agent_id = v_uid and jour = p_jour) then
    raise exception 'Vous ne venez pas ce jour-là.';
  end if;
  select exists (
    select 1 from agent_creneaux_fermes
    where agent_id = v_uid and jour = p_jour and hhmm = p_hhmm
  ) into v_ferme;
  if v_ferme then
    delete from agent_creneaux_fermes
     where agent_id = v_uid and jour = p_jour and hhmm = p_hhmm;
    return false;
  else
    insert into agent_creneaux_fermes (agent_id, jour, hhmm)
      values (v_uid, p_jour, p_hhmm);
    return true;
  end if;
end;
$$;
grant execute on function basculer_creneau(date, text) to authenticated;
```

#### `supabase/migrations/0015_planning_dnd.sql`

```sql
-- =====================================================================
--  0015 — Planning admin glisser-déposer.
--  (a) admin_rendez_vous renvoie aussi exposant_id + agent_id (filtrage).
--  (b) deplacer_rdv : déplace un RDV individuel vers un nouveau créneau,
--      l'anti-conflit restant garanti par les contraintes d'exclusion.
-- =====================================================================

drop function if exists admin_rendez_vous();
create function admin_rendez_vous()
returns table (
  id uuid,
  jour date,
  debut timestamp,
  fin timestamp,
  kind engagement_kind,
  exposant_id uuid,
  agent_id uuid,
  agence text,
  agent_nom text,
  agent_email text,
  receptif text,
  representant text
)
language sql security definer set search_path = public as $$
  select e.id, e.jour, lower(e.plage)::timestamp, upper(e.plage)::timestamp, e.kind,
         e.exposant_id, e.agent_id,
         a.agence, trim(a.prenom || ' ' || a.nom), a.email, x.nom, x.representant
  from engagements e
  left join agents a on a.id = e.agent_id
  left join exposants x on x.id = e.exposant_id
  where e.statut = 'confirme' and (select is_admin())
  order by e.jour, lower(e.plage);
$$;
grant execute on function admin_rendez_vous() to authenticated;

-- Déplace un RDV individuel (matin/après-midi) vers un nouveau début.
create or replace function deplacer_rdv(p_id uuid, p_nouveau_debut timestamp)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_time  time := p_nouveau_debut::time;
  v_jour  date := p_nouveau_debut::date;
  v_kind  engagement_kind;
  v_duree interval;
  r       record;
begin
  if not (select is_admin()) then raise exception 'Réservé à l''administrateur.'; end if;
  select * into r from engagements where id = p_id and statut = 'confirme';
  if r is null then raise exception 'Rendez-vous introuvable.'; end if;
  if r.kind not in ('rdv_matin', 'rdv_aprem') then
    raise exception 'Seuls les rendez-vous individuels se déplacent ainsi.';
  end if;
  if v_jour not in (date '2026-09-15', date '2026-09-16', date '2026-09-17') then
    raise exception 'Jour invalide.';
  end if;

  if v_time >= time '09:00' and v_time <= time '12:40' and (extract(minute from v_time)::int % 20) = 0 then
    v_kind := 'rdv_matin'; v_duree := interval '20 minutes';
  elsif v_time >= time '14:00' and v_time <= time '17:30' and (extract(minute from v_time)::int) in (0, 30) then
    v_kind := 'rdv_aprem'; v_duree := interval '30 minutes';
  else
    raise exception 'Créneau cible invalide.';
  end if;

  begin
    update engagements
       set jour = v_jour, kind = v_kind,
           plage = tsrange(p_nouveau_debut, p_nouveau_debut + v_duree, '[)')
     where id = p_id;
  exception
    when exclusion_violation then raise exception 'Créneau cible déjà occupé.' using errcode = '23P01';
    when unique_violation then raise exception 'Conflit sur ce créneau.';
  end;
end;
$$;
grant execute on function deplacer_rdv(uuid, timestamp) to authenticated;
```

#### `supabase/migrations/0016_admin_creer_rdv.sql`

```sql
-- =====================================================================
--  0016 — L'admin crée un rendez-vous individuel (agent ↔ réceptif).
--  L'anti-conflit reste garanti par les contraintes (exclusion + unique).
-- =====================================================================
create or replace function admin_creer_rdv(
  p_agent_id uuid,
  p_exposant_id uuid,
  p_debut timestamp
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_time time := p_debut::time;
  v_jour date := p_debut::date;
  v_kind engagement_kind;
  v_duree interval;
  v_resource uuid;
begin
  if not (select is_admin()) then raise exception 'Réservé à l''administrateur.'; end if;
  if v_jour not in (date '2026-09-15', date '2026-09-16', date '2026-09-17') then
    raise exception 'Jour invalide.';
  end if;

  if v_time >= time '09:00' and v_time <= time '12:40' and (extract(minute from v_time)::int % 20) = 0 then
    v_kind := 'rdv_matin'; v_duree := interval '20 minutes';
  elsif v_time >= time '14:00' and v_time <= time '17:30' and (extract(minute from v_time)::int) in (0, 30) then
    v_kind := 'rdv_aprem'; v_duree := interval '30 minutes';
  else
    raise exception 'Créneau invalide.';
  end if;

  select coalesce(groupe_id, id) into v_resource from exposants where id = p_exposant_id;

  begin
    insert into engagements (kind, agent_id, exposant_id, resource_id, jour, plage, statut)
    values (v_kind, p_agent_id, p_exposant_id, v_resource, v_jour,
            tsrange(p_debut, p_debut + v_duree, '[)'), 'confirme');
  exception
    when unique_violation then raise exception 'Cet agent a déjà un rendez-vous avec ce réceptif.';
    when exclusion_violation then raise exception 'Créneau déjà occupé (agent ou réceptif).' using errcode = '23P01';
  end;
end;
$$;
grant execute on function admin_creer_rdv(uuid, uuid, timestamp) to authenticated;
```

#### `supabase/migrations/0017_receptif_reserve_agent.sql`

```sql
-- =====================================================================
--  0017 — Bloc C Phase 3 : le réceptif sollicite un rendez-vous avec un
--  agent, sur un créneau où les DEUX sont disponibles.
-- =====================================================================

-- Agents que ce réceptif peut rencontrer (présents un jour commun).
create or replace function receptif_agents()
returns table (id uuid, agence text, ville text, contact text)
language sql security definer set search_path = public as $$
  select a.id, a.agence, a.ville, trim(a.prenom || ' ' || a.nom)
  from agents a
  where exists (
    select 1 from exposants x
    join presences p on p.exposant_id = x.id and p.formule in ('petits_dej','biz_biz','journee')
    join agent_jours aj on aj.agent_id = a.id and aj.jour = p.jour
    where x.proprietaire_id = auth.uid()
  )
  order by a.agence;
$$;
grant execute on function receptif_agents() to authenticated;

-- Créneaux du matin d'un agent vus par le réceptif connecté, avec statut.
create or replace function creneaux_agent(p_agent_id uuid)
returns table (jour date, hhmm text, statut text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_exposant uuid; v_resource uuid;
begin
  select id into v_exposant from exposants where proprietaire_id = v_uid;
  if v_exposant is null then return; end if;
  select coalesce(groupe_id, id) into v_resource from exposants where id = v_exposant;
  return query
  with jc as (
    select p.jour from presences p
    where p.exposant_id = v_exposant and p.formule in ('petits_dej','biz_biz','journee')
      and exists (select 1 from agent_jours aj where aj.agent_id = p_agent_id and aj.jour = p.jour)
  ),
  slots as (
    select jc.jour, s.hhmm from jc cross join
      (values ('09:00'),('09:20'),('09:40'),('10:00'),('10:20'),('10:40'),
              ('11:00'),('11:20'),('11:40'),('12:00'),('12:20'),('12:40')) s(hhmm)
  ),
  pair as (
    select e.jour as pjour, lower(e.plage)::time as ptime
    from engagements e
    where e.agent_id = p_agent_id and e.resource_id = v_resource and e.statut = 'confirme'
      and e.kind in ('rdv_matin','rdv_aprem') limit 1
  )
  select sl.jour, sl.hhmm,
    case
      when (select pjour from pair) = sl.jour and (select ptime from pair) = sl.hhmm::time then 'ensemble'
      when exists (select 1 from agent_creneaux_fermes f where f.agent_id = p_agent_id and f.jour = sl.jour and f.hhmm = sl.hhmm) then 'indispo'
      when exists (select 1 from engagements e where e.agent_id = p_agent_id and e.statut='confirme' and e.jour = sl.jour and lower(e.plage)::time = sl.hhmm::time) then 'indispo'
      when exists (select 1 from engagements e where e.resource_id = v_resource and e.statut='confirme' and e.jour = sl.jour and lower(e.plage)::time = sl.hhmm::time) then 'indispo'
      else 'libre'
    end
  from slots sl
  order by sl.jour, sl.hhmm;
end; $$;
grant execute on function creneaux_agent(uuid) to authenticated;

-- Le réceptif réserve un RDV avec un agent.
create or replace function receptif_reserver_agent(p_agent_id uuid, p_debut timestamp)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_exposant uuid; v_resource uuid;
  v_jour date := p_debut::date; v_time time := p_debut::time;
begin
  select id into v_exposant from exposants where proprietaire_id = v_uid;
  if v_exposant is null then raise exception 'Aucune fiche réceptif liée à ce compte.'; end if;
  if not (v_time >= time '09:00' and v_time <= time '12:40' and (extract(minute from v_time)::int % 20) = 0) then
    raise exception 'Créneau du matin invalide.';
  end if;
  if not exists (select 1 from presences where exposant_id = v_exposant and jour = v_jour and formule in ('petits_dej','biz_biz','journee')) then
    raise exception 'Vous n''êtes pas présent ce jour-là.';
  end if;
  if not exists (select 1 from agent_jours where agent_id = p_agent_id and jour = v_jour) then
    raise exception 'Cet agent ne vient pas ce jour-là.';
  end if;
  if exists (select 1 from agent_creneaux_fermes where agent_id = p_agent_id and jour = v_jour and hhmm = to_char(v_time,'HH24:MI')) then
    raise exception 'L''agent n''est pas disponible sur ce créneau.';
  end if;
  select coalesce(groupe_id, id) into v_resource from exposants where id = v_exposant;
  if exists (select 1 from engagements where agent_id = p_agent_id and resource_id = v_resource and kind in ('rdv_matin','rdv_aprem') and statut='confirme') then
    raise exception 'Vous avez déjà un rendez-vous avec cet agent.';
  end if;
  begin
    insert into engagements (kind, agent_id, exposant_id, resource_id, jour, plage, statut)
    values ('rdv_matin', p_agent_id, v_exposant, v_resource, v_jour, tsrange(p_debut, p_debut + interval '20 minutes','[)'), 'confirme');
  exception
    when unique_violation then raise exception 'Vous avez déjà un rendez-vous avec cet agent.';
    when exclusion_violation then raise exception 'Créneau déjà occupé.' using errcode = '23P01';
  end;
end; $$;
grant execute on function receptif_reserver_agent(uuid, timestamp) to authenticated;

-- Le réceptif annule un RDV pris sur sa fiche.
create or replace function receptif_annuler(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update engagements e set statut = 'annule'
  where e.id = p_id and e.statut <> 'annule'
    and e.exposant_id in (select id from exposants where proprietaire_id = auth.uid());
  if not found then raise exception 'Rendez-vous introuvable ou non autorisé.'; end if;
end; $$;
grant execute on function receptif_annuler(uuid) to authenticated;
```

#### `supabase/migrations/0018_chat.sql`

```sql
-- =====================================================================
--  0018 — Bloc C Phase 4 : messagerie agent ↔ réceptif.
--  Une conversation = un couple (agent, réceptif). Échange possible
--  qu'il y ait un RDV ou non.
-- =====================================================================
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references agents(id) on delete cascade,
  exposant_id   uuid not null references exposants(id) on delete cascade,
  expediteur_id uuid not null,
  contenu       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_conv on messages (agent_id, exposant_id, created_at);

alter table messages enable row level security;
drop policy if exists p_msg_read on messages;
create policy p_msg_read on messages for select using (
  agent_id = auth.uid()
  or exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  or is_admin()
);

-- Envoi (valide que l'expéditeur est bien l'agent ou le réceptif concerné).
create or replace function envoyer_message(p_agent_id uuid, p_exposant_id uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if trim(coalesce(p_contenu, '')) = '' then raise exception 'Message vide.'; end if;
  if not (v_uid = p_agent_id
          or p_exposant_id in (select id from exposants where proprietaire_id = v_uid)) then
    raise exception 'Non autorisé.';
  end if;
  insert into messages (agent_id, exposant_id, expediteur_id, contenu)
  values (p_agent_id, p_exposant_id, v_uid, trim(p_contenu));
end; $$;
grant execute on function envoyer_message(uuid, uuid, text) to authenticated;

-- Liste des conversations de l'utilisateur connecté.
create or replace function mes_conversations()
returns table (agent_id uuid, exposant_id uuid, agence text, receptif text, dernier text, dernier_at timestamptz)
language sql security definer set search_path = public as $$
  select m.agent_id, m.exposant_id, a.agence, x.nom,
         (array_agg(m.contenu order by m.created_at desc))[1],
         max(m.created_at)
  from messages m
  join agents a on a.id = m.agent_id
  join exposants x on x.id = m.exposant_id
  where m.agent_id = auth.uid()
     or m.exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  group by m.agent_id, m.exposant_id, a.agence, x.nom
  order by max(m.created_at) desc;
$$;
grant execute on function mes_conversations() to authenticated;

-- Fil d'une conversation.
create or replace function fil(p_agent_id uuid, p_exposant_id uuid)
returns table (id uuid, expediteur_id uuid, contenu text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.expediteur_id, m.contenu, m.created_at
  from messages m
  where m.agent_id = p_agent_id and m.exposant_id = p_exposant_id
    and (m.agent_id = auth.uid()
         or m.exposant_id in (select id from exposants where proprietaire_id = auth.uid())
         or (select is_admin()))
  order by m.created_at;
$$;
grant execute on function fil(uuid, uuid) to authenticated;
```

#### `supabase/migrations/0019_durcissement.sql`

```sql
-- =====================================================================
--  0019 — Durcissement (audit juillet 2026).
--  (1) is_admin() passe en SECURITY DEFINER : supprime la fragilité de
--      récursion RLS (la fonction lisait profiles sous la policy qui
--      l'appelle — ça ne tenait que par un court-circuit non garanti).
--  (2) Policies réécrites avec (select is_admin()) : évaluée une fois
--      par requête (InitPlan) au lieu d'une fois par ligne.
--  (3) Les RPC métier ne sont plus exécutables par le rôle anon
--      (par défaut Postgres accorde EXECUTE à PUBLIC).
--  (4) Garde-fou : un message de chat est limité à 4000 caractères.
--  (5) Nettoyage : condition dupliquée dans p_eng_read.
-- =====================================================================

-- ---------- (1) Helpers robustes ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
-- les policies évaluent ces fonctions quel que soit le rôle → grants explicites
grant execute on function is_admin() to anon, authenticated, service_role;

create or replace function mes_groupes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from groupes where representant_id = auth.uid();
$$;
grant execute on function mes_groupes() to anon, authenticated, service_role;

-- ---------- (2) Policies : (select is_admin()) ----------
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for select
  using (id = auth.uid() or (select is_admin()));

drop policy if exists p_expo_write on exposants;
create policy p_expo_write on exposants for all
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists p_dest_write on exposant_destinations;
create policy p_dest_write on exposant_destinations for all
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists p_pres_write on presences;
create policy p_pres_write on presences for all
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists p_grp_write on groupes;
create policy p_grp_write on groupes for all
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists p_agents_self on agents;
create policy p_agents_self on agents for select
  using (id = auth.uid() or (select is_admin()));

drop policy if exists p_ajours_self on agent_jours;
create policy p_ajours_self on agent_jours for select
  using (agent_id = auth.uid() or (select is_admin()));

drop policy if exists p_dcfg_write on dejeuner_config;
create policy p_dcfg_write on dejeuner_config for all
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists p_ddej_self on demandes_dejeuner;
create policy p_ddej_self on demandes_dejeuner for select
  using (agent_id = auth.uid() or (select is_admin()));

-- (5) p_eng_read réécrite sans la condition dupliquée
drop policy if exists p_eng_read on engagements;
create policy p_eng_read on engagements for select using (
  (select is_admin())
  or agent_id = auth.uid()
  or exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  or resource_id in (select mes_groupes())
);

drop policy if exists p_acf_self on agent_creneaux_fermes;
create policy p_acf_self on agent_creneaux_fermes for select
  using (agent_id = auth.uid() or (select is_admin()));

drop policy if exists p_msg_read on messages;
create policy p_msg_read on messages for select using (
  agent_id = auth.uid()
  or exposant_id in (select id from exposants where proprietaire_id = auth.uid())
  or (select is_admin())
);

-- ---------- (3) Les RPC métier ne sont plus appelables par anon ----------
do $$
declare f text;
begin
  foreach f in array array[
    'reserver_rdv(uuid, timestamp)',
    'annuler_engagement(uuid, text)',
    'creneaux_occupes(uuid, date)',
    'mes_engagements()',
    'admin_rendez_vous()',
    'deplacer_rdv(uuid, timestamp)',
    'admin_creer_rdv(uuid, uuid, timestamp)',
    'annuler_mes_rdv()',
    'definir_jours_agent(date[])',
    'valider_engagement()',
    'receptif_rendez_vous()',
    'mes_creneaux_fermes()',
    'basculer_creneau(date, text)',
    'receptif_agents()',
    'creneaux_agent(uuid)',
    'receptif_reserver_agent(uuid, timestamp)',
    'receptif_annuler(uuid)',
    'envoyer_message(uuid, uuid, text)',
    'mes_conversations()',
    'fil(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Les fonctions créées à l'avenir ne seront plus PUBLIC par défaut.
alter default privileges in schema public revoke execute on functions from public;

-- ---------- (4) Taille maximale d'un message ----------
alter table messages drop constraint if exists messages_contenu_max;
alter table messages add constraint messages_contenu_max
  check (char_length(contenu) <= 4000);
```

#### `supabase/migrations/0020_dejeuner_agent.sql`

```sql
-- =====================================================================
--  0020 — Déjeuner réseautage (13h00–14h00) côté agent.
--  L'agent se positionne sur le déjeuner d'un jour où il vient. Non
--  bloquant (capacité globale, curation admin) — on stocke juste la
--  demande + d'éventuels réceptifs souhaités (pour le futur meet & match).
-- =====================================================================

-- L'agent rejoint (ou met à jour) le déjeuner d'un jour.
create or replace function demander_dejeuner(p_jour date, p_receptifs uuid[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Agent introuvable.';
  end if;
  if not exists (select 1 from agent_jours where agent_id = v_uid and jour = p_jour) then
    raise exception 'Vous ne venez pas ce jour-là.';
  end if;
  insert into demandes_dejeuner (agent_id, jour, receptifs_souhaites)
  values (v_uid, p_jour, coalesce(p_receptifs, '{}'))
  on conflict (agent_id, jour)
    do update set receptifs_souhaites = excluded.receptifs_souhaites, statut = 'en_attente';
end; $$;
grant execute on function demander_dejeuner(date, uuid[]) to authenticated;

-- L'agent se retire du déjeuner d'un jour.
create or replace function annuler_dejeuner(p_jour date)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from demandes_dejeuner where agent_id = auth.uid() and jour = p_jour;
end; $$;
grant execute on function annuler_dejeuner(date) to authenticated;

-- Les déjeuners de l'agent connecté.
create or replace function mes_dejeuners()
returns table (jour date, receptifs_souhaites uuid[], statut statut_type)
language sql security definer set search_path = public as $$
  select jour, receptifs_souhaites, statut
  from demandes_dejeuner where agent_id = auth.uid();
$$;
grant execute on function mes_dejeuners() to authenticated;

-- Retirer un jour de venue retire aussi la demande de déjeuner de ce jour.
create or replace function definir_jours_agent(p_jours date[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Seuls les agents peuvent choisir leurs jours.';
  end if;
  update engagements set statut = 'annule'
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  delete from demandes_dejeuner
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  delete from agent_jours
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  insert into agent_jours (agent_id, jour)
   select v_uid, unnest(coalesce(p_jours, '{}'))
  on conflict do nothing;
end; $$;
grant execute on function definir_jours_agent(date[]) to authenticated;
```

#### `supabase/admin_bootstrap.sql`

```sql
-- =====================================================================
--  Prépare le compte admin martin@togezer.travel.
--  À lancer APRÈS avoir créé l'utilisateur dans Supabase :
--  Authentication → Users → Add user → « Create new user »
--  (email martin@togezer.travel + mot de passe).
--
--  Ce script (1) confirme l'e-mail si besoin, (2) attribue le rôle admin.
-- =====================================================================

-- (1) Confirme l'adresse e-mail (au cas où elle ne le serait pas déjà)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'martin@togezer.travel';

-- (2) Donne le rôle admin
insert into profiles (id, role, email, full_name)
select id, 'admin', email, 'Martin'
from auth.users
where email = 'martin@togezer.travel'
on conflict (id) do update set role = 'admin';
```

### 14.2 Cœur de la prise de rendez-vous (front)

#### `src/app/reservation/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import JoursSelector from "./JoursSelector";
import Booking, { type Receptif } from "./Booking";

export const dynamic = "force-dynamic";

export default async function Reservation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: agent } = await supabase
    .from("agents")
    .select("prenom, engagement_at")
    .eq("id", user.id)
    .single();
  if (!agent) redirect("/mon-espace");

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  let receptifs: Receptif[] = [];
  if (jours.length > 0) {
    const { data } = await supabase
      .from("exposants")
      .select(
        "id, nom, logo_path, representant, pays_principal, continent_principal, exposant_destinations(pays, continent), presences(jour, formule)",
      )
      .order("nom");
    receptifs = (data ?? []) as unknown as Receptif[];
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-titre text-4xl font-600 text-encre">
        Prendre mes rendez-vous
      </h1>

      {/* Étape 1 */}
      <section className="mt-8 rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Étape 1
        </p>
        <h2 className="mt-1 font-titre text-2xl font-600 text-encre">
          Quels jours venez-vous&nbsp;?
        </h2>
        <p className="mb-5 mt-1 font-corps text-sm text-encreDoux">
          Vous ne pourrez réserver qu'avec les réceptifs présents sur vos jours.
          Vous pourrez ajuster ce choix à tout moment.
        </p>
        <JoursSelector initial={jours} />
      </section>

      {/* Étape 2 */}
      <section className="mt-6">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Étape 2
        </p>
        <h2 className="mt-1 font-titre text-2xl font-600 text-encre">
          Réserver mes créneaux
          <span className="ml-3 font-corps text-sm font-400 text-encreDoux">
            (Pensez à valider en dernière étape, en bas de cette page)
          </span>
        </h2>
        {jours.length === 0 ? (
          <p className="mt-1 font-corps text-sm text-encreDoux">
            Choisissez d'abord vos jours ci-dessus.
          </p>
        ) : (
          <div className="mt-4">
            <Booking receptifs={receptifs} joursAgent={jours} engagementAt={agent.engagement_at as string | null} />
          </div>
        )}
      </section>
      </main>
    </div>
  );
}
```

#### `src/app/reservation/Booking.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";
import { CRENEAUX_MATIN, CRENEAUX_APREM, affiche, normDebut } from "@/lib/creneaux";

export type Presence = { jour: string; formule: string };
export type Receptif = {
  id: string;
  nom: string;
  logo_path: string | null;
  representant: string | null;
  pays_principal: string;
  continent_principal: string;
  exposant_destinations: { pays: string; continent: string }[];
  presences: Presence[];
};
type Engagement = {
  id: string;
  exposant_id: string;
  exposant_nom: string;
  representant: string | null;
  jour: string;
  kind: string;
  debut: string;
  fin: string;
};
type Dejeuner = { jour: string };

const BREAKFAST = new Set(["petits_dej", "biz_biz", "journee"]);

export default function Booking({
  receptifs,
  joursAgent,
  engagementAt,
}: {
  receptifs: Receptif[];
  joursAgent: string[];
  engagementAt: string | null;
}) {
  const supabase = createClient();
  const [sel, setSel] = useState<string | null>(null);
  const [mes, setMes] = useState<Engagement[]>([]);
  const [dej, setDej] = useState<Dejeuner[]>([]);
  const [occ, setOcc] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [continent, setContinent] = useState("");
  const [pays, setPays] = useState("");
  const [engage, setEngage] = useState<string | null>(engagementAt);
  const [coche, setCoche] = useState(false);
  const [vue, setVue] = useState<"timeline" | "liste">("timeline");

  const loadMes = useCallback(async () => {
    const { data } = await supabase.rpc("mes_engagements");
    setMes((data ?? []) as Engagement[]);
  }, [supabase]);

  const loadDej = useCallback(async () => {
    const { data } = await supabase.rpc("mes_dejeuners");
    setDej((data ?? []) as Dejeuner[]);
  }, [supabase]);

  const loadOcc = useCallback(
    async (expoId: string, jour: string) => {
      const { data } = await supabase.rpc("creneaux_occupes", {
        p_exposant_id: expoId,
        p_jour: jour,
      });
      const set = new Set<string>(
        (data ?? []).map((r: { debut: string }) => normDebut(r.debut)),
      );
      setOcc((o) => ({ ...o, [`${expoId}_${jour}`]: set }));
    },
    [supabase],
  );

  useEffect(() => {
    loadMes();
    loadDej();
  }, [loadMes, loadDej]);

  const destinations = (r: Receptif) => [
    { pays: r.pays_principal, continent: r.continent_principal },
    ...r.exposant_destinations,
  ];

  const surMesJours = receptifs.filter((r) =>
    r.presences.some((p) => joursAgent.includes(p.jour) && BREAKFAST.has(p.formule)),
  );
  const continents = [...new Set(surMesJours.flatMap((r) => destinations(r).map((d) => d.continent)))].sort();
  const paysList = [...new Set(surMesJours.flatMap((r) => destinations(r).map((d) => d.pays)))]
    .filter((p) => !continent || surMesJours.some((r) => destinations(r).some((d) => d.pays === p && d.continent === continent)))
    .sort();
  const bookables = surMesJours
    .filter((r) => {
      const ds = destinations(r);
      if (continent && !ds.some((d) => d.continent === continent)) return false;
      if (pays && !ds.some((d) => d.pays === pays)) return false;
      return true;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  const paysDe = (exposantId: string) =>
    receptifs.find((r) => r.id === exposantId)?.pays_principal ?? "";

  async function validerEngagement() {
    const { error } = await supabase.rpc("valider_engagement");
    if (!error) setEngage(new Date().toISOString());
  }

  const selReceptif = bookables.find((r) => r.id === sel) ?? null;
  const joursDuReceptif = selReceptif
    ? JOURS.filter(
        (j) =>
          joursAgent.includes(j.iso) &&
          selReceptif.presences.some((p) => p.jour === j.iso),
      )
    : [];
  const formuleJour = (iso: string) =>
    selReceptif?.presences.find((p) => p.jour === iso)?.formule ?? "absent";

  useEffect(() => {
    if (selReceptif) joursDuReceptif.forEach((j) => loadOcc(selReceptif.id, j.iso));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const monEngagementA = (jour: string, hhmm: string) =>
    mes.find((e) => e.debut && normDebut(e.debut) === `${jour} ${hhmm}`);

  async function reserver(expoId: string, jour: string, hhmm: string) {
    setErreur(null);
    setBusy(`${expoId}_${jour}_${hhmm}`);
    const { error } = await supabase.rpc("reserver_rdv", {
      p_exposant_id: expoId,
      p_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(null);
    if (error) {
      setErreur(traduire(error.message));
      return;
    }
    await Promise.all([loadMes(), loadOcc(expoId, jour)]);
  }

  async function annuler(id: string, expoId: string, jour: string) {
    setErreur(null);
    setBusy(id);
    const { error } = await supabase.rpc("annuler_engagement", { p_id: id, p_message: null });
    setBusy(null);
    if (error) {
      setErreur("L'annulation a échoué. Réessayez.");
      return;
    }
    await Promise.all([loadMes(), loadOcc(expoId, jour)]);
  }

  async function toggleDejeuner(jour: string) {
    setBusy(`dej_${jour}`);
    const present = dej.some((d) => d.jour === jour);
    const { error } = present
      ? await supabase.rpc("annuler_dejeuner", { p_jour: jour })
      : await supabase.rpc("demander_dejeuner", { p_jour: jour, p_receptifs: [] });
    setBusy(null);
    if (error) {
      setErreur("Action sur le déjeuner impossible. Réessayez.");
      return;
    }
    await loadDej();
  }

  // Un créneau de la grille de réservation (matin ou après-midi)
  const renderSlot = (hhmm: string, jourIso: string, taken: Set<string>) => {
    if (!selReceptif) return null;
    const slotKey = `${jourIso} ${hhmm}`;
    const mien = monEngagementA(jourIso, hhmm);
    const estMien = mien && mien.exposant_id === selReceptif.id;
    const prisAilleurs = mien && mien.exposant_id !== selReceptif.id;
    const occupe = taken.has(slotKey);
    const b = `${selReceptif.id}_${jourIso}_${hhmm}`;

    if (estMien)
      return (
        <button key={hhmm} onClick={() => annuler(mien!.id, selReceptif.id, jourIso)}
          disabled={busy === mien!.id} title="Votre rendez-vous — cliquez pour annuler"
          className="rounded-lg border border-brique bg-brique px-1.5 py-2 font-corps text-xs font-600 text-creme">
          {affiche(hhmm)} ✓
        </button>
      );
    if (prisAilleurs)
      return (
        <span key={hhmm} title={`Déjà pris : ${mien!.exposant_nom}`}
          className="rounded-lg border border-ligne bg-creme px-1.5 py-2 text-center font-corps text-xs text-encre/30">
          {affiche(hhmm)}
        </span>
      );
    if (occupe)
      return (
        <span key={hhmm} title="Créneau déjà réservé"
          className="rounded-lg border border-ligne bg-creme px-1.5 py-2 text-center font-corps text-xs text-encre/25 line-through">
          {affiche(hhmm)}
        </span>
      );
    return (
      <button key={hhmm} onClick={() => reserver(selReceptif.id, jourIso, hhmm)}
        disabled={busy === b}
        className="rounded-lg border border-encre/20 bg-white px-1.5 py-2 font-corps text-xs text-encre transition hover:border-brique hover:bg-brique/5">
        {affiche(hhmm)}
      </button>
    );
  };

  const joursVenue = JOURS.filter((j) => joursAgent.includes(j.iso));

  // ---------------- « Mon programme » : tableau de bord pleine largeur ----------------
  const Programme = () => (
    <div className="rounded-xl border-2 border-double border-brique/40 bg-carte p-5 shadow-carte sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-titre text-2xl font-600 text-encre">
          Mon programme
          <span className="ml-2 font-corps text-sm font-400 text-encreDoux">
            {mes.length} rendez-vous{dej.length > 0 ? ` · ${dej.length} déjeuner${dej.length > 1 ? "s" : ""}` : ""}
          </span>
        </h3>
        <div className="flex rounded-full border border-encre/15 p-0.5">
          {(["timeline", "liste"] as const).map((v) => (
            <button key={v} onClick={() => setVue(v)}
              className={`rounded-full px-4 py-1 font-corps text-xs font-600 capitalize transition ${
                vue === v ? "bg-encre text-creme" : "text-encreDoux hover:text-encre"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {joursVenue.map((j) => {
          const duJour = mes
            .filter((e) => e.jour === j.iso)
            .sort((a, b) => a.debut.localeCompare(b.debut));
          const lunch = dej.some((d) => d.jour === j.iso);
          return (
            <div key={j.iso} className="border-t border-ligne/60 pt-4 first:border-0 first:pt-0">
              <div className="mb-2 flex items-baseline gap-3">
                <p className="font-titre text-xl font-600 text-encre">{j.label}</p>
                <span className="font-corps text-xs text-encreDoux">
                  {duJour.length === 0 && !lunch
                    ? "journée libre"
                    : `${duJour.length} rendez-vous${lunch ? " + déjeuner" : ""}`}
                </span>
              </div>

              {vue === "timeline" && <TimelineJour items={duJour} hasLunch={lunch} />}

              {/* Chips des rendez-vous */}
              {duJour.length > 0 && (
                <div className={`mt-3 grid gap-2 ${vue === "timeline" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {duJour.map((e) => (
                    <div key={e.id}
                      className="flex items-center gap-2 rounded-lg border border-ligne bg-white/60 px-3 py-2 font-corps text-sm">
                      <span className="font-700 text-brique">{affiche(normDebut(e.debut).slice(11))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-encre">{e.exposant_nom}</span>
                        <span className="block truncate text-xs text-encreDoux">
                          {paysDe(e.exposant_id)}
                          {e.representant ? ` · avec ${e.representant}` : ""}
                        </span>
                      </span>
                      <Link href={`/messages?receptif=${e.exposant_id}`} title="Écrire à ce réceptif"
                        className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-creme hover:text-brique">
                        💬
                      </Link>
                      <button onClick={() => annuler(e.id, e.exposant_id, e.jour)} disabled={busy === e.id}
                        title="Annuler ce rendez-vous"
                        className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-red-50 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Déjeuner réseautage — toujours proposé */}
              <div className="mt-2">
                {lunch ? (
                  <div className="flex items-center gap-2 rounded-lg border border-zMoutarde/50 bg-zMoutarde/10 px-3 py-2 font-corps text-sm">
                    <span className="text-base">🍽️</span>
                    <span className="flex-1 text-encre">
                      <span className="font-600">13h00 – 14h00 · Déjeuner réseautage</span>
                      <span className="block text-xs text-encreDoux">Vous êtes positionné — l'organisation reviendra vers vous.</span>
                    </span>
                    <button onClick={() => toggleDejeuner(j.iso)} disabled={busy === `dej_${j.iso}`}
                      title="Me retirer du déjeuner"
                      className="shrink-0 rounded p-1 text-encreDoux transition hover:bg-red-50 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => toggleDejeuner(j.iso)} disabled={busy === `dej_${j.iso}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zMoutarde/60 px-3 py-2 font-corps text-sm text-encreDoux transition hover:bg-zMoutarde/10 hover:text-encre">
                    🍽️ Me positionner sur le déjeuner réseautage (13h00 – 14h00)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-corps text-xs text-encreDoux">
        Pour <strong>déplacer</strong> un rendez-vous&nbsp;: annulez-le (✕) puis choisissez un
        nouveau créneau dans la grille ci-dessous — l'ancien créneau est libéré aussitôt.
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      {joursVenue.length > 0 && <Programme />}

      {/* Ajout / modification des rendez-vous */}
      <div>
        <h3 className="font-titre text-2xl font-600 text-encre">
          Ajouter ou modifier mes rendez-vous
        </h3>
        <p className="mb-4 mt-1 font-corps text-sm text-encreDoux">
          Choisissez un réceptif, puis cliquez sur un créneau libre.
        </p>

        {erreur && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 font-corps text-sm text-red-700">{erreur}</p>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Liste des réceptifs réservables */}
          <div className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
            <p className="px-1 pb-2 font-corps text-xs text-encreDoux">
              Seuls les réceptifs présents sur <strong className="text-encre">vos jours</strong> s'affichent.
            </p>
            <div className="flex gap-2">
              <select value={continent} onChange={(e) => { setContinent(e.target.value); setPays(""); }}
                className="min-w-0 flex-1 rounded-lg border border-encre/20 bg-white px-2 py-1.5 font-corps text-xs">
                <option value="">Tous continents</option>
                {continents.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={pays} onChange={(e) => setPays(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-encre/20 bg-white px-2 py-1.5 font-corps text-xs">
                <option value="">Tous pays</option>
                {paysList.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <p className="px-1 pt-2 font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
              {bookables.length} réceptif{bookables.length > 1 ? "s" : ""}
            </p>
            <div className="mt-1 max-h-[560px] space-y-1 overflow-y-auto">
              {bookables.map((r) => {
                const sec = r.exposant_destinations.map((d) => d.pays);
                const sousTitre = [r.pays_principal, ...sec].join(", ");
                const on = sel === r.id;
                const dejaRdv = mes.some((e) => e.exposant_id === r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSel(r.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                      on ? "bg-brique text-creme" : "text-encre hover:bg-creme"
                    }`}
                  >
                    {r.logo_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.logo_path} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-corps text-sm font-600">{r.nom}</span>
                      <span className={`block truncate font-corps text-xs ${on ? "text-creme/80" : "text-encreDoux"}`}>
                        {sousTitre}
                      </span>
                    </span>
                    {dejaRdv && (
                      <span title="Vous avez déjà un rendez-vous avec ce réceptif"
                        className={`shrink-0 font-corps text-xs font-700 ${on ? "text-creme" : "text-brique"}`}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grille de créneaux — jours côte à côte */}
          <div>
            {!selReceptif ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-ligne p-8 text-center font-corps text-encreDoux">
                ← Sélectionnez un réceptif pour voir ses créneaux.
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-titre text-2xl font-600 text-encre">
                  {selReceptif.nom}
                  <span className="ml-2 font-corps text-sm text-encreDoux">
                    cliquez un créneau pour le réserver
                  </span>
                </h4>
                <div className={`grid gap-4 ${joursDuReceptif.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
                  {joursDuReceptif.map((j) => {
                    const taken = occ[`${selReceptif.id}_${j.iso}`] ?? new Set<string>();
                    const formule = formuleJour(j.iso);
                    const showMatin = BREAKFAST.has(formule);
                    const showAprem = formule === "journee";
                    return (
                      <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                        <p className="mb-3 text-center font-titre text-lg font-600 text-encre">{j.label}</p>
                        {showMatin && (
                          <div className="mb-4">
                            <p className="mb-2 font-corps text-[11px] font-600 uppercase tracking-wide text-encreDoux">
                              Petit-déjeuner · 20 min
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {CRENEAUX_MATIN.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                            </div>
                          </div>
                        )}
                        {showAprem && (
                          <div>
                            <p className="mb-2 font-corps text-[11px] font-600 uppercase tracking-wide text-encreDoux">
                              Après-midi · 30 min
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {CRENEAUX_APREM.map((hhmm) => renderSlot(hhmm, j.iso, taken))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation de l'engagement */}
      {mes.length > 0 && (
        <div className="rounded-xl border-2 border-double border-brique/50 bg-carte p-5 shadow-carte">
          {engage ? (
            <p className="font-corps text-sm text-encre">
              ✓ <strong>Programme confirmé.</strong> Merci&nbsp;! Pensez à revenir
              l'ajuster ici si votre agenda change — annuler un créneau libère la
              place pour un autre agent.
            </p>
          ) : (
            <>
              <p className="font-titre text-lg font-600 text-encre">
                Dernière étape&nbsp;: je valide mon programme
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 font-corps text-sm text-encre">
                <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-brique" />
                <span>
                  Je m'engage à honorer mes rendez-vous, et à revenir les{" "}
                  <strong>annuler ou modifier</strong> sans tarder si un changement
                  dans mon agenda m'en empêche — afin de libérer le créneau pour un confrère.
                </span>
              </label>
              <button onClick={validerEngagement} disabled={!coche}
                className="mt-4 rounded-full bg-brique px-7 py-2.5 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-40">
                Je valide mon programme
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const minutesOf = (ts: string) => {
  const [h, m] = normDebut(ts).slice(11).split(":").map(Number);
  return h * 60 + m;
};

// Frise horaire d'une journée, pleine largeur (9h → 18h).
function TimelineJour({
  items,
  hasLunch,
}: {
  items: { debut: string; fin: string; exposant_nom: string }[];
  hasLunch: boolean;
}) {
  const START = 9 * 60,
    SPAN = 9 * 60; // 9h → 18h
  const pct = (min: number) => ((min - START) / SPAN) * 100;
  const LUNCH_L = pct(13 * 60),
    LUNCH_W = (60 / SPAN) * 100;

  return (
    <div className="w-full">
      <div className="relative h-12 w-full overflow-hidden rounded-lg border border-ligne bg-creme">
        {/* zone déjeuner (13-14h) */}
        <div className="absolute inset-y-0 bg-zMoutarde/10"
          style={{ left: `${LUNCH_L}%`, width: `${LUNCH_W}%` }} />
        {/* lignes des heures */}
        {[10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
          <div key={h} className="absolute inset-y-0 border-l border-ligne/40"
            style={{ left: `${pct(h * 60)}%` }} />
        ))}
        {/* bloc déjeuner */}
        {hasLunch && (
          <div className="absolute inset-y-2 flex items-center justify-center rounded bg-zMoutarde text-[11px]"
            style={{ left: `${LUNCH_L}%`, width: `${LUNCH_W}%` }}
            title="Déjeuner réseautage · 13h00 – 14h00">
            🍽️
          </div>
        )}
        {/* blocs rendez-vous */}
        {items.map((it, i) => {
          const s = minutesOf(it.debut),
            e = minutesOf(it.fin);
          return (
            <div key={i}
              className="absolute inset-y-2 rounded bg-brique transition hover:brightness-110"
              style={{ left: `${pct(s)}%`, width: `${Math.max(1.3, ((e - s) / SPAN) * 100)}%` }}
              title={`${affiche(normDebut(it.debut).slice(11))} · ${it.exposant_nom}`} />
          );
        })}
      </div>
      {/* légende des heures */}
      <div className="relative mt-1 h-4">
        {[9, 11, 13, 15, 17].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 font-corps text-[10px] text-encreDoux"
            style={{ left: `${pct(h * 60)}%` }}>
            {h}h
          </span>
        ))}
        <span className="absolute right-0 font-corps text-[10px] text-encreDoux">18h</span>
      </div>
    </div>
  );
}

function traduire(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("déjà un rendez-vous avec ce réceptif"))
    return "Vous avez déjà un rendez-vous avec ce réceptif (un seul par réceptif).";
  if (m.includes("indisponible") || m.includes("23p01")) return "Ce créneau vient d'être pris. Choisissez-en un autre.";
  if (m.includes("inscrit ce jour")) return "Vous n'êtes pas inscrit ce jour-là.";
  if (m.includes("présent ce jour")) return "Ce réceptif n'est pas présent ce jour-là.";
  return "Réservation impossible. Réessayez.";
}
```

#### `src/app/reservation/JoursSelector.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";

export default function JoursSelector({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [jours, setJours] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const toggle = (iso: string) =>
    setJours((p) => (p.includes(iso) ? p.filter((j) => j !== iso) : [...p, iso]));

  async function save() {
    setErreur(null);
    if (jours.length === 0) {
      setErreur("Choisissez au moins un jour de venue.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_jours_agent", { p_jours: jours });
    setBusy(false);
    if (error) {
      setErreur("Une erreur est survenue. Réessayez.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {JOURS.map((j) => {
          const on = jours.includes(j.iso);
          return (
            <button
              key={j.iso}
              type="button"
              onClick={() => { toggle(j.iso); setOk(false); }}
              className={`rounded-xl border px-6 py-4 font-corps transition ${
                on
                  ? "border-brique bg-brique text-creme"
                  : "border-ligne bg-carte text-encre hover:border-brique/50"
              }`}
            >
              <span className="block font-titre text-xl font-600">{j.label}</span>
              <span className="text-xs opacity-80">Septembre 2026</span>
            </button>
          );
        })}
      </div>

      {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}

      <div className="mt-5 flex items-center gap-4">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-brique px-7 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50"
        >
          {busy ? "Validation…" : "Valider mes jours"}
        </button>
        {ok && <span className="font-corps text-sm text-brique">✓ Jours enregistrés</span>}
      </div>
    </div>
  );
}
```

#### `src/lib/creneaux.ts`

```ts
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
```

#### `src/lib/jours.ts`

```ts
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
```

### 14.3 Messagerie & espaces connectés

#### `src/components/Messagerie.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conv = {
  agent_id: string;
  exposant_id: string;
  agence: string;
  receptif: string;
  dernier: string;
  dernier_at: string;
};
type Msg = { id: string; expediteur_id: string; contenu: string; created_at: string };
type Partner = { id: string; nom: string };
type Sel = { agent_id: string; exposant_id: string; titre: string };

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Messagerie({
  role,
  agentId,
  exposantId,
  initialPartnerId,
}: {
  role: "agent" | "receptif";
  agentId?: string;
  exposantId?: string;
  initialPartnerId?: string;
}) {
  const supabase = createClient();
  const [uid, setUid] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [fil, setFil] = useState<Msg[]>([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const titreConv = (c: Conv) => (role === "agent" ? c.receptif : c.agence);

  async function chargerConvs() {
    const { data } = await supabase.rpc("mes_conversations");
    setConvs((data ?? []) as Conv[]);
  }
  async function chargerFil(a: string, e: string) {
    const { data } = await supabase.rpc("fil", { p_agent_id: a, p_exposant_id: e });
    setFil((data ?? []) as Msg[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    chargerConvs();
    if (role === "agent") {
      supabase
        .from("exposants")
        .select("id, nom")
        .order("nom")
        .then(({ data }) =>
          setPartners(((data ?? []) as { id: string; nom: string }[]).map((x) => ({ id: x.id, nom: x.nom }))),
        );
    } else {
      supabase
        .rpc("receptif_agents")
        .then(({ data }) =>
          setPartners(
            ((data ?? []) as { id: string; agence: string }[]).map((x) => ({ id: x.id, nom: x.agence })),
          ),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharge le fil ouvert (+ léger rafraîchissement pour voir les réponses).
  useEffect(() => {
    if (!sel) return;
    chargerFil(sel.agent_id, sel.exposant_id);
    const t = setInterval(() => chargerFil(sel.agent_id, sel.exposant_id), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.agent_id, sel?.exposant_id]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [fil]);

  // Arrivée via un lien « 💬 » : ouvre directement la conversation demandée.
  useEffect(() => {
    if (!initialPartnerId || sel || partners.length === 0) return;
    ouvrirNouveau(initialPartnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners]);

  function ouvrirNouveau(id: string) {
    const p = partners.find((x) => x.id === id);
    if (!p) return;
    setSel({
      agent_id: role === "agent" ? agentId! : p.id,
      exposant_id: role === "receptif" ? exposantId! : p.id,
      titre: p.nom,
    });
  }

  async function envoyer() {
    if (!sel || !texte.trim() || envoi) return;
    setEnvoi(true);
    setErreurEnvoi(null);
    const { error } = await supabase.rpc("envoyer_message", {
      p_agent_id: sel.agent_id,
      p_exposant_id: sel.exposant_id,
      p_contenu: texte.trim(),
    });
    setEnvoi(false);
    if (error) {
      setErreurEnvoi("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
      return;
    }
    setTexte("");
    await chargerFil(sel.agent_id, sel.exposant_id);
    chargerConvs();
  }

  const dejaOuverts = new Set(convs.map((c) => (role === "agent" ? c.exposant_id : c.agent_id)));
  const nouveaux = partners.filter((p) => !dejaOuverts.has(p.id));

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Colonne conversations */}
      <div className="rounded-xl border border-ligne bg-carte p-3 shadow-carte">
        <label className="block">
          <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
            Nouvelle conversation
          </span>
          <select
            value=""
            onChange={(e) => e.target.value && ouvrirNouveau(e.target.value)}
            className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
          >
            <option value="">— {role === "agent" ? "Choisir un réceptif" : "Choisir un agent"} —</option>
            {nouveaux.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 space-y-1">
          {convs.length === 0 && (
            <p className="px-1 py-4 font-corps text-sm text-encreDoux">Aucune conversation pour l'instant.</p>
          )}
          {convs.map((c) => {
            const actif = sel?.agent_id === c.agent_id && sel?.exposant_id === c.exposant_id;
            return (
              <button
                key={`${c.agent_id}-${c.exposant_id}`}
                onClick={() => setSel({ agent_id: c.agent_id, exposant_id: c.exposant_id, titre: titreConv(c) })}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  actif ? "bg-brique/10" : "hover:bg-creme"
                }`}
              >
                <p className="font-corps text-sm font-600 text-encre">{titreConv(c)}</p>
                <p className="truncate font-corps text-xs text-encreDoux">{c.dernier}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colonne fil */}
      <div className="flex min-h-[420px] flex-col rounded-xl border border-ligne bg-carte shadow-carte">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center font-corps text-encreDoux">
            Sélectionnez une conversation ou démarrez-en une.
          </div>
        ) : (
          <>
            <div className="border-b border-ligne px-5 py-3">
              <p className="font-titre text-lg font-600 text-encre">{sel.titre}</p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {fil.length === 0 && (
                <p className="py-8 text-center font-corps text-sm text-encreDoux">
                  Démarrez la conversation ci-dessous.
                </p>
              )}
              {fil.map((m) => {
                const moi = m.expediteur_id === uid;
                return (
                  <div key={m.id} className={`flex ${moi ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 font-corps text-sm ${
                        moi ? "bg-brique text-creme" : "bg-creme text-encre"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.contenu}</p>
                      <p className={`mt-1 text-[10px] ${moi ? "text-creme/70" : "text-encreDoux"}`}>
                        {quand(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>
            {erreurEnvoi && (
              <p className="border-t border-ligne px-3 pt-2 font-corps text-xs text-red-600">
                {erreurEnvoi}
              </p>
            )}
            <div className="flex items-end gap-2 border-t border-ligne p-3">
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    envoyer();
                  }
                }}
                rows={2}
                placeholder="Votre message…"
                className="flex-1 resize-none rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
              />
              <button
                onClick={envoyer}
                disabled={!texte.trim() || envoi}
                className="rounded-full bg-brique px-5 py-2.5 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

#### `src/app/messages/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import Messagerie from "@/components/Messagerie";

export const dynamic = "force-dynamic";

export default async function MessagesAgent({
  searchParams,
}: {
  searchParams: Promise<{ receptif?: string }>;
}) {
  const { receptif } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inscription");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "receptif") redirect("/espace-receptif");

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-titre text-4xl font-600 text-encre">Messagerie</h1>
        <p className="mb-6 mt-1 font-corps text-encreDoux">
          Échangez avec les réceptifs — avant ou après un rendez-vous.
        </p>
        <Messagerie role="agent" agentId={user.id} initialPartnerId={receptif} />
      </div>
    </div>
  );
}
```

#### `src/app/espace-receptif/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Deconnexion from "@/app/mon-espace/Deconnexion";
import { JOURS, labelJour, FORMULE_LABEL } from "@/lib/jours";
import { affiche, normDebut } from "@/lib/creneaux";
import { GlobeGrid } from "@/components/Ornaments";
import SolliciterAgent from "./SolliciterAgent";
import Messagerie from "@/components/Messagerie";

export const dynamic = "force-dynamic";

type Rdv = {
  id: string;
  jour: string;
  debut: string;
  fin: string;
  kind: string;
  agence: string | null;
  agent_nom: string | null;
  agent_email: string | null;
  agent_ville: string | null;
};

export default async function EspaceReceptif() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "receptif") redirect("/mon-espace");

  const { data: fiche } = await supabase
    .from("exposants")
    .select("id, nom, pays_principal, continent_principal, logo_path, presences(jour, formule)")
    .eq("proprietaire_id", user.id)
    .maybeSingle();

  const { data: rdvData } = await supabase.rpc("receptif_rendez_vous");
  const rdv = (rdvData ?? []) as Rdv[];

  const heure = (ts: string) => affiche(normDebut(ts).slice(11));

  return (
    <div className="min-h-screen">
      <header className="border-b border-ligne bg-carte/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/espace-receptif" aria-label="La Station TogeZer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-togezer.png" alt="La Station TogeZer" className="h-11 w-auto" />
          </Link>
          <Deconnexion />
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-ligne">
        <GlobeGrid className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 text-ligne/50" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.28em] text-brique">
            Espace réceptif
          </p>
          <h1 className="mt-2 font-titre text-5xl font-600 text-encre">
            {fiche?.nom ?? "Votre espace"}
          </h1>
          {fiche && (
            <p className="mt-2 font-corps text-encreDoux">
              {fiche.pays_principal} · {fiche.continent_principal}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Présence */}
        {fiche && (
          <div className="mb-8 flex flex-wrap gap-3">
            {JOURS.map((j) => {
              const p = fiche.presences?.find((x: { jour: string; formule: string }) => x.jour === j.iso);
              return (
                <div key={j.iso}
                  className={`rounded-lg border px-4 py-2 font-corps text-sm ${
                    p ? "border-ligne bg-carte text-encre" : "border-dashed border-ligne text-encre/30"
                  }`}>
                  <span className="font-600">{j.label}</span>
                  <span className="ml-2 text-encreDoux">{p ? FORMULE_LABEL[p.formule] : "Absent"}</span>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="font-titre text-2xl font-600 text-encre">
          Vos rendez-vous ({rdv.length})
        </h2>

        {rdv.length === 0 ? (
          <p className="mt-4 font-corps text-encreDoux">
            Aucun rendez-vous pour l'instant. Les agents peuvent en réserver avec
            vous depuis leur espace.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {JOURS.filter((j) => rdv.some((r) => r.jour === j.iso)).map((j) => (
              <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-5 shadow-carte">
                <p className="font-titre text-lg font-600 text-encre">{labelJour(j.iso)}</p>
                <table className="mt-3 w-full text-left font-corps text-sm">
                  <tbody>
                    {rdv
                      .filter((r) => r.jour === j.iso)
                      .sort((a, b) => a.debut.localeCompare(b.debut))
                      .map((r) => (
                        <tr key={r.id} className="border-t border-ligne/60">
                          <td className="py-2 pr-4 font-600 text-brique">
                            {heure(r.debut)}–{heure(r.fin)}
                          </td>
                          <td className="py-2 pr-4 font-600 text-encre">{r.agence ?? "—"}</td>
                          <td className="py-2 pr-4 text-encreDoux">{r.agent_nom ?? ""}</td>
                          <td className="py-2 text-encreDoux">{r.agent_ville ?? ""}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <SolliciterAgent />

        {fiche && (
          <div className="mt-10">
            <h2 className="font-titre text-2xl font-600 text-encre">Messagerie</h2>
            <p className="mb-4 mt-1 font-corps text-sm text-encreDoux">
              Échangez directement avec les agents de voyage.
            </p>
            <Messagerie role="receptif" exposantId={fiche.id} />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### `src/app/espace-receptif/SolliciterAgent.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS, labelJour } from "@/lib/jours";
import { affiche } from "@/lib/creneaux";

type Agent = { id: string; agence: string; ville: string | null; contact: string | null };
type Slot = { jour: string; hhmm: string; statut: string };

export default function SolliciterAgent() {
  const supabase = createClient();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sel, setSel] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("receptif_agents").then(({ data }) => setAgents((data ?? []) as Agent[]));
  }, [supabase]);

  const loadSlots = useCallback(
    async (agentId: string) => {
      const { data } = await supabase.rpc("creneaux_agent", { p_agent_id: agentId });
      setSlots((data ?? []) as Slot[]);
    },
    [supabase],
  );

  useEffect(() => {
    if (sel) loadSlots(sel);
    else setSlots([]);
  }, [sel, loadSlots]);

  async function reserver(jour: string, hhmm: string) {
    setBusy(`${jour} ${hhmm}`);
    setErreur(null);
    const { error } = await supabase.rpc("receptif_reserver_agent", {
      p_agent_id: sel,
      p_debut: `${jour} ${hhmm}:00`,
    });
    setBusy(null);
    if (error) {
      setErreur(
        error.message.includes("déjà un rendez-vous")
          ? "Vous avez déjà un rendez-vous avec cet agent."
          : error.message.includes("disponible")
            ? "L'agent n'est plus disponible sur ce créneau."
            : "Réservation impossible.",
      );
      return;
    }
    await loadSlots(sel);
    router.refresh();
  }

  async function annuler(jour: string, hhmm: string) {
    // On retrouve l'engagement via une annulation ciblée : on recharge après.
    setBusy(`${jour} ${hhmm}`);
    const { data } = await supabase.rpc("receptif_rendez_vous");
    const rdv = (data ?? []).find(
      (r: { id: string; jour: string; debut: string }) =>
        r.jour === jour && r.debut.replace("T", " ").slice(11, 16) === hhmm,
    );
    if (rdv) await supabase.rpc("receptif_annuler", { p_id: rdv.id });
    setBusy(null);
    await loadSlots(sel);
    router.refresh();
  }

  const joursDuSlot = JOURS.filter((j) => slots.some((s) => s.jour === j.iso));

  return (
    <div className="mt-10">
      <h2 className="font-titre text-2xl font-600 text-encre">Solliciter un rendez-vous</h2>
      <p className="mb-4 mt-1 font-corps text-sm text-encreDoux">
        Choisissez une agence : vous verrez ses créneaux <strong>disponibles</strong>
        (là où vos présences et ses disponibilités coïncident) et pourrez lui proposer un rendez-vous.
      </p>

      <select value={sel} onChange={(e) => setSel(e.target.value)}
        className="min-w-[260px] rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps text-sm">
        <option value="">— Choisir une agence —</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.agence}{a.ville ? ` — ${a.ville}` : ""}</option>
        ))}
      </select>

      {erreur && <p className="mt-3 font-corps text-sm text-red-600">{erreur}</p>}

      {sel && (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {joursDuSlot.length === 0 ? (
            <p className="font-corps text-sm text-encreDoux">
              Aucun créneau commun avec cette agence.
            </p>
          ) : (
            joursDuSlot.map((j) => (
              <div key={j.iso} className="rounded-xl border border-ligne bg-carte p-4 shadow-carte">
                <p className="mb-3 font-titre text-lg font-600 text-encre">{j.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {slots
                    .filter((s) => s.jour === j.iso)
                    .map((s) => {
                      if (s.statut === "ensemble")
                        return (
                          <button key={s.hhmm} onClick={() => annuler(s.jour, s.hhmm)}
                            disabled={busy === `${s.jour} ${s.hhmm}`}
                            title="Votre RDV — cliquez pour annuler"
                            className="rounded-lg border border-brique bg-brique px-2 py-2 font-corps text-sm text-creme">
                            {affiche(s.hhmm)} ✓
                          </button>
                        );
                      if (s.statut === "indispo")
                        return (
                          <span key={s.hhmm}
                            className="rounded-lg border border-ligne bg-creme px-2 py-2 text-center font-corps text-sm text-encre/25 line-through">
                            {affiche(s.hhmm)}
                          </span>
                        );
                      return (
                        <button key={s.hhmm} onClick={() => reserver(s.jour, s.hhmm)}
                          disabled={busy === `${s.jour} ${s.hhmm}`}
                          className="rounded-lg border border-encre/20 bg-white px-2 py-2 font-corps text-sm text-encre transition hover:border-brique hover:bg-brique/5">
                          {affiche(s.hhmm)}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

#### `src/app/mon-espace/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import AppHeader from "@/components/AppHeader";
import { GlobeGrid } from "@/components/Ornaments";

export const dynamic = "force-dynamic";

export default async function MonEspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inscription");

  const { data: agent } = await supabase
    .from("agents")
    .select("agence, ville, prenom, nom, email, telephone")
    .eq("id", user.id)
    .single();

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  const { count: nbRdv } = await supabase
    .from("engagements")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .eq("statut", "confirme");

  return (
    <div className="min-h-screen">
      <AppHeader />

      {/* Bienvenue */}
      <section className="relative overflow-hidden border-b border-ligne">
        <GlobeGrid className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 text-ligne/50" />
        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.28em] text-brique">
            Votre espace agent
          </p>
          <h1 className="mt-2 font-titre text-5xl font-600 text-encre">
            Bonjour {agent?.prenom ?? ""} 👋
          </h1>
          <p className="mt-3 max-w-xl font-corps text-lg text-encreDoux">
            Ravis de vous accueillir à La Station TogeZer. Composez votre
            programme de rendez-vous avec nos réceptifs partenaires — vous pouvez
            revenir l'ajuster autant de fois que vous le souhaitez.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/reservation"
              className="rounded-full bg-brique px-7 py-3 font-corps font-600 text-creme shadow-carte transition hover:bg-briqueFonce"
            >
              Prendre mes rendez-vous
            </Link>
            <Link
              href="/annuaire"
              className="rounded-full border border-encre/20 px-7 py-3 font-corps font-500 text-encre transition hover:bg-encre/5"
            >
              Voir les réceptifs
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10 md:grid-cols-3">
        {/* Rappel de l'événement (billet) */}
        <div className="rounded-xl border-2 border-double border-brique/50 bg-carte p-6 shadow-carte">
          <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
            Votre rendez-vous
          </p>
          <p className="mt-2 font-titre text-2xl font-600 leading-tight text-encre">
            15, 16 &amp; 17 septembre 2026
          </p>
          <p className="mt-1 font-corps text-sm text-encreDoux">De 9h00 à 18h00</p>
          <hr className="my-4 border-ligne" />
          <p className="font-titre text-lg font-600 text-encre">Voie 15</p>
          <p className="font-corps text-sm text-encreDoux">
            397 bis rue de Vaugirard, 75015 Paris
            <br />
            Porte de Versailles (M12 / T2)
          </p>
        </div>

        {/* Compteur RDV */}
        <div className="flex flex-col justify-center rounded-xl border border-ligne bg-carte p-6 text-center shadow-carte">
          <p className="font-titre text-6xl font-700 text-brique">{nbRdv ?? 0}</p>
          <p className="mt-1 font-corps text-sm text-encreDoux">
            rendez-vous programmé{(nbRdv ?? 0) > 1 ? "s" : ""}
          </p>
          <Link
            href="/reservation"
            className="mt-4 font-corps text-sm text-brique underline underline-offset-2"
          >
            {(nbRdv ?? 0) > 0 ? "Voir / modifier mon programme" : "En prendre un premier"}
          </Link>
        </div>

        {/* Mes informations — résumé + lien vers la page dédiée */}
        <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
          <div className="flex items-center justify-between">
            <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
              Mes informations
            </p>
            <Link href="/mes-informations" className="font-corps text-sm text-brique underline underline-offset-2">
              Modifier
            </Link>
          </div>
          <dl className="mt-3 space-y-2 font-corps text-sm">
            <Ligne k="Agence" v={agent?.agence} />
            <Ligne k="Ville" v={agent?.ville} />
            <Ligne k="Contact" v={`${agent?.prenom ?? ""} ${agent?.nom ?? ""}`} />
            <Ligne k="E-mail" v={agent?.email} />
            {agent?.telephone && <Ligne k="Téléphone" v={agent.telephone} />}
            <Ligne k="Jours" v={jours.length ? jours.map(labelJour).join(", ") : "À choisir"} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Ligne({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-encreDoux">{k}</dt>
      <dd className="text-right font-500 text-encre">{v || "—"}</dd>
    </div>
  );
}
```

#### `src/app/mon-espace/ModifierInfos.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Infos = {
  agence: string;
  ville: string;
  prenom: string;
  nom: string;
  telephone: string;
};

export default function ModifierInfos({
  initial,
  email,
  joursLabel,
}: {
  initial: Infos;
  email: string;
  joursLabel: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Infos>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: keyof Infos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function enregistrer() {
    if (!form.agence.trim() || !form.prenom.trim() || !form.nom.trim()) {
      setErreur("Agence, prénom et nom sont obligatoires.");
      return;
    }
    setBusy(true);
    setErreur(null);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("agents")
      .update({
        agence: form.agence.trim(),
        ville: form.ville.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
      })
      .eq("id", u.user?.id ?? "");
    setBusy(false);
    if (error) {
      setErreur("Enregistrement impossible. Réessayez.");
      return;
    }
    setEdit(false);
    setOk(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
      <div className="flex items-center justify-between">
        <p className="font-corps text-xs font-600 uppercase tracking-[0.2em] text-brique">
          Votre inscription
        </p>
        {!edit && (
          <button
            onClick={() => { setEdit(true); setOk(false); }}
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Modifier
          </button>
        )}
      </div>

      {!edit ? (
        <dl className="mt-3 space-y-2 font-corps text-sm">
          <Ligne k="Agence" v={form.agence} />
          <Ligne k="Ville" v={form.ville} />
          <Ligne k="Contact" v={`${form.prenom} ${form.nom}`} />
          <Ligne k="E-mail" v={email} />
          {form.telephone && <Ligne k="Téléphone" v={form.telephone} />}
          <Ligne k="Jours" v={joursLabel} />
          {ok && <p className="pt-1 font-corps text-xs text-green-700">Infos mises à jour ✓</p>}
        </dl>
      ) : (
        <div className="mt-4 space-y-3">
          <Champ label="Agence" value={form.agence} onChange={set("agence")} />
          <Champ label="Ville" value={form.ville} onChange={set("ville")} />
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Prénom" value={form.prenom} onChange={set("prenom")} />
            <Champ label="Nom" value={form.nom} onChange={set("nom")} />
          </div>
          <Champ label="Téléphone" value={form.telephone} onChange={set("telephone")} />
          <div>
            <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
              E-mail (identifiant de connexion)
            </span>
            <input
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-ligne bg-creme px-3 py-2 font-corps text-sm text-encreDoux"
            />
            <p className="mt-1 font-corps text-[11px] text-encreDoux">
              L'e-mail sert d'identifiant et ne peut pas être modifié ici.
            </p>
          </div>

          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => { setEdit(false); setForm(initial); setErreur(null); }}
              className="rounded-full border border-encre/20 px-5 py-2 font-corps text-sm text-encre"
            >
              Annuler
            </button>
            <button
              onClick={enregistrer}
              disabled={busy}
              className="rounded-full bg-brique px-5 py-2 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Ligne({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-encreDoux">{k}</dt>
      <dd className="text-right font-500 text-encre">{v || "—"}</dd>
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux">
        {label}
      </span>
      <input
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm"
      />
    </label>
  );
}
```

#### `src/app/mon-espace/Deconnexion.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Deconnexion() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-lg border border-encre/20 px-4 py-2 text-sm text-encre/70 hover:bg-creme"
    >
      Se déconnecter
    </button>
  );
}
```

#### `src/app/mes-informations/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import AppHeader from "@/components/AppHeader";
import ModifierInfos from "@/app/mon-espace/ModifierInfos";

export const dynamic = "force-dynamic";

export default async function MesInformations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inscription");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "receptif") redirect("/espace-receptif");

  const { data: agent } = await supabase
    .from("agents")
    .select("agence, ville, prenom, nom, email, telephone")
    .eq("id", user.id)
    .single();

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-titre text-4xl font-600 text-encre">Mes informations</h1>
        <p className="mb-6 mt-1 font-corps text-encreDoux">
          Modifiez les coordonnées de votre agence. Votre e-mail sert d'identifiant de
          connexion et n'est pas modifiable ici.
        </p>
        <ModifierInfos
          initial={{
            agence: agent?.agence ?? "",
            ville: agent?.ville ?? "",
            prenom: agent?.prenom ?? "",
            nom: agent?.nom ?? "",
            telephone: agent?.telephone ?? "",
          }}
          email={agent?.email ?? ""}
          joursLabel={jours.length ? jours.map(labelJour).join(", ") : "À choisir"}
        />
      </div>
    </div>
  );
}
```

### 14.4 Pages publiques & authentification

#### `src/app/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import { FiletGare } from "@/components/Ornaments";
import GalerieVoie15 from "@/components/GalerieVoie15";
import { espaceUtilisateur } from "@/lib/espace";

export const dynamic = "force-dynamic";

const MAPS_URL = "https://maps.app.goo.gl/u6fRgKjAh7WwCScH9";

const PROGRAMME = [
  {
    h: "09h00 – 13h00",
    t: "Les Petits-Dejs TogeZer",
    d: "Nos fameux rendez-vous en tête-à-tête de 20 minutes, toute la matinée de 9h00 à 13h00.",
  },
  {
    h: "13h00 – 14h00",
    t: "Dejs Biz Biz",
    d: "Une heure de déjeuner dans une ambiance conviviale, avec un ou plusieurs réceptifs — assis ou debout, c'est vous qui décidez.",
  },
  {
    h: "14h00 – 18h00",
    t: "Les Z'aprems",
    d: "Des formations d'une heure par destination, et des rendez-vous en tête-à-tête avec les réceptifs.",
  },
];

const IMAGES_VOIE15 = ["voie15-salle.png", "voie15-terrasse.png", "voie15-acces.png"];

const ETAPES = [
  {
    n: "1",
    titre: "Je m'inscris",
    desc: "Je crée mon accès en une minute — c'est gratuit.",
  },
  {
    n: "2",
    titre: "Je prends mes rendez-vous",
    desc: "Je choisis mes jours de venue, puis mes rendez-vous avec les réceptifs. Je reviens autant de fois que je veux pour ajuster mon programme.",
  },
];

export default async function Home() {
  // Déjà connecté ? On reste dans l'espace connecté, jamais sur l'accueil public.
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);

  return (
    <main className="min-h-screen">
      {/* En-tête — logo cliquable (retour accueil) */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <Link href="/" aria-label="Accueil La Station TogeZer">
          <Wordmark className="h-auto w-[175px]" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="/annuaire"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden font-corps text-sm text-encreDoux underline-offset-4 hover:text-encre hover:underline sm:inline"
          >
            Voir la liste des réceptifs participants
          </a>
          <Link
            href="/connexion"
            className="rounded-full border border-encre/25 px-5 py-2 font-corps text-sm font-500 text-encre transition hover:bg-encre/5"
          >
            <span className="hidden text-encreDoux sm:inline">Vous avez déjà un compte&nbsp;? </span>
            <span className="font-600">Se connecter</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-12 text-center sm:pt-16">
        <h1 className="font-titre text-4xl font-600 uppercase leading-[1.1] tracking-wide text-encre sm:text-5xl">
          Bienvenue à bord de la station des réceptifs&nbsp;!
        </h1>

        <p className="mx-auto mt-7 max-w-xl font-corps text-lg leading-relaxed text-encreDoux">
          <span className="mb-1 block font-600 text-encre">Chers Agents de Voyages,</span>
          La Station TogeZer réunit pour la première fois tous nos formats phares en
          un seul événement&nbsp;: Petits-Déjeuners, déjeuners de réseautage et
          après-midis de rendez-vous, rythmés par des formations dédiées à chaque
          destination.
          <span className="mt-2 block">
            Trois jours pour rencontrer nos réceptifs, découvrir des nouveautés et
            repartir avec des projets concrets.
          </span>
        </p>

        {/* Appel à l'action + gratuité (remonté) */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="/annuaire"
            target="_blank"
            rel="noopener noreferrer"
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Voir les réceptifs
          </a>
          <Link
            href="/inscription"
            className="rounded-full bg-brique px-8 py-3 font-corps font-600 tracking-wide text-creme shadow-carte transition hover:bg-briqueFonce"
          >
            Je m'inscris en tant qu'agent de voyages
          </Link>
          <p className="font-corps text-sm text-encreDoux">
            Accès <span className="font-600 text-brique">gratuit</span> pour les agents
            de voyage — sur simple inscription.
          </p>
          <Link
            href="/connexion"
            className="rounded-full border border-encre/20 px-8 py-3 font-corps font-500 tracking-wide text-encre transition hover:bg-encre/5"
          >
            J'ai déjà un compte, je me connecte
          </Link>
        </div>

        {/* Le Programme */}
        <h2 className="mt-16 font-titre text-4xl font-600 text-encre">Le Programme</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {PROGRAMME.map((p) => (
            <div
              key={p.t}
              className="rounded-xl border-2 border-double border-brique/40 bg-carte px-5 py-6 text-center shadow-carte"
            >
              <p className="font-corps text-sm font-700 tracking-[0.15em] text-brique">{p.h}</p>
              <p className="mt-2 font-titre text-2xl font-600 leading-tight text-encre">{p.t}</p>
              <p className="mt-3 font-corps text-sm leading-relaxed text-encreDoux">{p.d}</p>
            </div>
          ))}
        </div>

        {/* Dates + lieu */}
        <p className="mt-10 font-titre text-2xl font-500 tracking-wide text-encre">
          Mardi 15, mercredi 16 &amp; jeudi 17 septembre 2026
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="inline-block rounded-lg border-[3px] border-double border-brique/55 bg-carte px-6 py-2 font-corps text-sm tracking-wide text-encre">
            Voie 15 — 397 bis rue de Vaugirard, 75015 Paris · Porte de Versailles
          </span>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Voir la carte
          </a>
        </div>

        {/* Images du lieu — clic pour agrandir */}
        <GalerieVoie15 images={IMAGES_VOIE15} />
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <FiletGare />
      </div>

      {/* Comment ça marche — 2 étapes */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center font-titre text-4xl font-500 text-encre">
          Comment ça marche&nbsp;?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center font-corps text-encreDoux">
          Deux étapes, et vous revenez autant de fois que vous le souhaitez pour ajuster
          vos rendez-vous.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {ETAPES.map((e) => (
            <div key={e.n} className="rounded-xl border border-ligne bg-carte p-7 shadow-carte">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brique/60 font-titre text-xl font-600 text-brique">
                {e.n}
              </div>
              <h3 className="mt-5 font-titre text-2xl font-600 text-encre">{e.titre}</h3>
              <p className="mt-2 font-corps text-sm leading-relaxed text-encreDoux">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rappel pratique */}
      <section className="border-t border-ligne">
        <div className="mx-auto grid max-w-3xl gap-10 px-6 py-14 sm:grid-cols-3">
          <InfoPratique titre="Quand" lignes={["15, 16 & 17 septembre 2026", "De 9h00 à 18h00"]} />
          <InfoPratique
            titre="Où"
            lignes={["Voie 15 — Paris 15ᵉ", "Porte de Versailles (M12 / T2)"]}
            lien={{ href: MAPS_URL, label: "Voir la carte" }}
          />
          <InfoPratique
            titre="Pour qui"
            lignes={["Les agents de voyage", "Participation gratuite, sur inscription"]}
          />
        </div>
      </section>

      <footer className="border-t border-ligne py-9 text-center font-corps text-sm text-encreDoux">
        La Station TogeZer — hello@togezer.travel
        <span className="mx-2 text-ligne">·</span>
        <Link href="/connexion" className="underline underline-offset-2 hover:text-encre">
          Se connecter
        </Link>
      </footer>
    </main>
  );
}

function InfoPratique({
  titre,
  lignes,
  lien,
}: {
  titre: string;
  lignes: string[];
  lien?: { href: string; label: string };
}) {
  return (
    <div>
      <p className="font-corps text-[0.7rem] uppercase tracking-[0.28em] text-brique">{titre}</p>
      <p className="mt-2 font-titre text-xl font-600 text-encre">{lignes[0]}</p>
      {lignes.slice(1).map((l) => (
        <p key={l} className="font-corps text-sm text-encreDoux">{l}</p>
      ))}
      {lien && (
        <a href={lien.href} target="_blank" rel="noopener noreferrer"
          className="mt-1 inline-block font-corps text-sm text-brique underline underline-offset-2">
          {lien.label}
        </a>
      )}
    </div>
  );
}
```

#### `src/app/annuaire/page.tsx`

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AnnuaireClient, { type ExposantAnnuaire } from "./AnnuaireClient";

export const dynamic = "force-dynamic";

export default async function AnnuairePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exposants")
    .select(
      "id, slug, nom, pays_principal, continent_principal, description, logo_path, groupe_id, exposant_destinations(pays, continent), presences(jour, formule, tient_presentation, theme)",
    )
    .order("nom");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-titre text-2xl text-encre">Annuaire indisponible</h1>
        <p className="mt-3 text-sm text-red-600">{error.message}</p>
        <Link href="/" className="mt-6 inline-block text-brique underline">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  const exposants = (data ?? []) as unknown as ExposantAnnuaire[];

  return (
    <main className="min-h-screen">
      <header className="border-b border-ligne">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <Link
            href="/"
            className="font-corps text-sm text-encreDoux hover:text-encre"
          >
            ← Accueil
          </Link>
          <h1 className="mt-4 font-titre text-5xl font-600 text-encre">
            Nos réceptifs partenaires
          </h1>
          <p className="mt-3 max-w-2xl font-corps text-encreDoux">
            Parcourez les réceptifs présents. Filtrez par continent, pays ou jour.
            La liste est consultable en entier ; vous réservez avec ceux présents
            sur vos jours d'inscription.
          </p>
        </div>
      </header>
      <AnnuaireClient exposants={exposants} />
    </main>
  );
}
```

#### `src/app/annuaire/AnnuaireClient.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { JOURS, FORMULE_LABEL } from "@/lib/jours";

export type ExposantAnnuaire = {
  id: string;
  slug: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  description: string | null;
  logo_path: string | null;
  groupe_id: string | null;
  exposant_destinations: { pays: string; continent: string }[];
  presences: {
    jour: string;
    formule: string;
    tient_presentation: boolean;
    theme: string | null;
  }[];
};

function destinations(e: ExposantAnnuaire) {
  return [
    { pays: e.pays_principal, continent: e.continent_principal, principal: true },
    ...e.exposant_destinations.map((d) => ({ ...d, principal: false })),
  ];
}

export default function AnnuaireClient({
  exposants,
}: {
  exposants: ExposantAnnuaire[];
}) {
  const [continent, setContinent] = useState("");
  const [pays, setPays] = useState("");
  const [jours, setJours] = useState<string[]>([]);

  // Listes déroulantes construites à partir des destinations (principale + secondaires)
  const continents = useMemo(
    () =>
      [...new Set(exposants.flatMap((e) => destinations(e).map((d) => d.continent)))].sort(),
    [exposants],
  );
  const paysList = useMemo(
    () =>
      [...new Set(exposants.flatMap((e) => destinations(e).map((d) => d.pays)))]
        .filter((p) => !continent || exposants.some((e) => destinations(e).some((d) => d.pays === p && d.continent === continent)))
        .sort(),
    [exposants, continent],
  );

  const toggleJour = (iso: string) =>
    setJours((prev) =>
      prev.includes(iso) ? prev.filter((j) => j !== iso) : [...prev, iso],
    );

  const filtres = useMemo(() => {
    return exposants.filter((e) => {
      const dests = destinations(e);
      if (continent && !dests.some((d) => d.continent === continent)) return false;
      if (pays && !dests.some((d) => d.pays === pays)) return false;
      if (jours.length && !e.presences.some((p) => jours.includes(p.jour)))
        return false;
      return true;
    });
  }, [exposants, continent, pays, jours]);

  const reset = () => {
    setContinent("");
    setPays("");
    setJours([]);
  };
  const actif = continent || pays || jours.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Barre de filtres */}
      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-encre/10 bg-carte p-5 shadow-carte">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Continent</span>
          <select
            value={continent}
            onChange={(e) => {
              setContinent(e.target.value);
              setPays("");
            }}
            className="rounded-lg border border-encre/20 px-3 py-2"
          >
            <option value="">Tous</option>
            {continents.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Pays</span>
          <select
            value={pays}
            onChange={(e) => setPays(e.target.value)}
            className="rounded-lg border border-encre/20 px-3 py-2"
          >
            <option value="">Tous</option>
            {paysList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-encre/70">Jour de présence</span>
          <div className="flex gap-2">
            {JOURS.map((j) => (
              <button
                key={j.iso}
                onClick={() => toggleJour(j.iso)}
                className={`rounded-lg border px-3 py-2 transition ${
                  jours.includes(j.iso)
                    ? "border-brique bg-brique text-white"
                    : "border-encre/20 text-encre/70 hover:border-brique/50"
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-encre/50">
            {filtres.length} réceptif{filtres.length > 1 ? "s" : ""}
          </span>
          {actif && (
            <button
              onClick={reset}
              className="rounded-lg border border-encre/20 px-3 py-2 text-sm text-encre/70 hover:bg-creme"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Grille */}
      {filtres.length === 0 ? (
        <p className="py-16 text-center text-encre/50">
          Aucun réceptif ne correspond à ces filtres.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtres.map((e) => (
            <ExposantCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExposantCard({ e }: { e: ExposantAnnuaire }) {
  const secondaires = e.exposant_destinations.map((d) => d.pays);
  return (
    <article className="flex flex-col rounded-xl border border-ligne bg-carte p-5 shadow-carte">
      <div className="flex items-center gap-3">
        {e.logo_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.logo_path} alt="" className="h-14 w-14 shrink-0 rounded-lg" />
        )}
        <div className="min-w-0">
          <h3 className="font-titre text-xl font-600 leading-tight text-encre">
            {e.nom}
          </h3>
          <p className="mt-0.5 font-corps text-xs font-600 uppercase tracking-[0.15em] text-encreDoux">
            {e.continent_principal}
          </p>
        </div>
      </div>

      {/* Destinations : principale en rouge, secondaires en virgules */}
      <p className="mt-4 font-corps text-sm leading-relaxed">
        <span className="font-700 text-brique">{e.pays_principal}</span>
        {secondaires.length > 0 && (
          <span className="text-encre">{", " + secondaires.join(", ")}</span>
        )}
      </p>

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-ligne pt-4">
        {JOURS.map((j) => {
          const p = e.presences.find((pr) => pr.jour === j.iso);
          return (
            <span
              key={j.iso}
              className={`rounded-md px-2.5 py-1 text-xs font-500 ${
                p
                  ? "bg-encre text-creme"
                  : "bg-creme text-encre/25 line-through"
              }`}
              title={p ? FORMULE_LABEL[p.formule] : "Absent"}
            >
              {j.courtDate}
            </span>
          );
        })}
      </div>
    </article>
  );
}
```

#### `src/app/inscription/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { espaceUtilisateur } from "@/lib/espace";
import InscriptionForm from "./InscriptionForm";

export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);
  return <InscriptionForm />;
}
```

#### `src/app/inscription/InscriptionForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function InscriptionForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    agence: "",
    ville: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    password: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (form.password.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/mon-espace`,
        data: {
          agence: form.agence.trim(),
          ville: form.ville.trim(),
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          telephone: form.telephone.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      setErreur(messageErreurFr(error.message));
      return;
    }
    if (data.session) {
      router.push("/mon-espace");
      router.refresh();
    } else {
      setMessage(
        `Un e-mail de confirmation vient d'être envoyé à ${form.email.trim()}. Cliquez sur le lien qu'il contient pour valider votre compte et accéder à vos réservations.`,
      );
    }
  }

  if (message) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-titre text-2xl text-encre">Vérifiez votre boîte mail</h1>
        <p className="mt-3 text-encre/70">{message}</p>
        <Link href="/" className="mt-6 text-brique underline">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-encre/50 hover:text-encre">
        ← Accueil
      </Link>
      <h1 className="mt-3 font-titre text-3xl text-encre">Inscription</h1>
      <p className="mt-2 text-encre/70">
        Créez votre accès en une minute — c'est gratuit. Vous choisirez vos jours
        et vos rendez-vous juste après.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Champ name="agence" label="Nom de l'agence" value={form.agence} onChange={set("agence")} required />
        <Champ name="ville" label="Ville de l'agence" value={form.ville} onChange={set("ville")} required />
        <div className="grid grid-cols-2 gap-4">
          <Champ name="prenom" label="Prénom" value={form.prenom} onChange={set("prenom")} required />
          <Champ name="nom" label="Nom" value={form.nom} onChange={set("nom")} required />
        </div>
        <Champ name="email" label="E-mail professionnel" type="email" value={form.email} onChange={set("email")} required />
        <Champ name="telephone" label="Téléphone (facultatif)" value={form.telephone} onChange={set("telephone")} />
        <Champ
          name="password"
          label="Mot de passe (8 caractères min.)"
          type="password"
          value={form.password}
          onChange={set("password")}
          required
        />

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-encre px-6 py-3 font-medium text-creme transition hover:brightness-125 disabled:opacity-50"
        >
          {loading ? "Validation…" : "Je valide mon inscription"}
        </button>
      </form>
    </main>
  );
}

// Traduit les messages d'erreur Supabase Auth (anglais) en français.
function messageErreurFr(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cette adresse e-mail.";
  if (m.includes("invalid") && m.includes("email"))
    return "Cette adresse e-mail n'est pas valide.";
  if (m.includes("password") && m.includes("least"))
    return "Le mot de passe est trop court.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("for security purposes"))
    return "Trop de tentatives. Merci de réessayer dans quelques minutes.";
  if (m.includes("unable to validate email") || m.includes("email address") && m.includes("invalid"))
    return "Cette adresse e-mail n'est pas valide.";
  return "Une erreur est survenue. Vérifiez vos informations et réessayez.";
}

function Champ({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-encre/70">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-encre/20 px-3 py-2 outline-none focus:border-brique"
      />
    </label>
  );
}
```

#### `src/app/connexion/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { espaceUtilisateur } from "@/lib/espace";
import ConnexionForm from "./ConnexionForm";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);
  return <ConnexionForm />;
}
```

#### `src/app/connexion/ConnexionForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";
import { FiletGare } from "@/components/Ornaments";

export default function ConnexionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    const supabase = createClient();
    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !signIn.user) {
      setLoading(false);
      setErreur("E-mail ou mot de passe incorrect.");
      return;
    }
    // On oriente selon le rôle (filtré sur l'utilisateur : un admin voit
    // tous les profils, il faut donc cibler explicitement le sien).
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signIn.user.id)
      .single();
    const dest =
      prof?.role === "admin"
        ? "/admin"
        : prof?.role === "receptif"
          ? "/espace-receptif"
          : "/mon-espace";
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" aria-label="Retour à l'accueil" className="mx-auto">
        <Wordmark className="h-auto w-[210px] transition hover:opacity-80" />
      </Link>

      <div className="mt-8 rounded-xl border-2 border-double border-brique/40 bg-carte p-8 shadow-carte">
        <h1 className="text-center font-titre text-4xl font-600 text-encre">
          Bon retour à bord&nbsp;!
        </h1>
        <p className="mt-2 text-center font-corps text-encreDoux">
          Connectez-vous pour retrouver vos rendez-vous.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2.5 font-corps outline-none focus:border-brique"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-encre/20 bg-white px-3 py-2.5 font-corps outline-none focus:border-brique"
            />
          </label>
          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brique px-6 py-3 font-corps font-600 text-creme transition hover:bg-briqueFonce disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>

      <div className="my-2">
        <FiletGare />
      </div>

      <p className="mt-3 text-center font-corps text-sm text-encreDoux">
        Pas encore de compte&nbsp;?{" "}
        <Link href="/inscription" className="font-600 text-brique underline underline-offset-2">
          Je m'inscris en tant qu'agent de voyages
        </Link>
        <span className="mx-2 text-ligne">·</span>
        <Link href="/" className="underline underline-offset-2 hover:text-encre">
          Retour à l'accueil
        </Link>
      </p>
    </main>
  );
}
```

#### `src/app/auth/confirm/route.ts`

```ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Confirmation d'e-mail. Gère les deux formats de lien Supabase :
//  - token_hash + type (recommandé, indépendant de l'appareil)
//  - code (PKCE, lien par défaut)
// Puis redirige l'agent vers sa page de réservation (?next=...).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Seuls les chemins internes sont autorisés (pas de redirection externe).
  const brut = searchParams.get("next") ?? "/mon-espace";
  const next = brut.startsWith("/") && !brut.startsWith("//") ? brut : "/mon-espace";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/erreur`);
}
```

#### `src/app/auth/erreur/page.tsx`

```tsx
import Link from "next/link";

export default function AuthErreur() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-titre text-2xl text-encre">Lien de confirmation invalide</h1>
      <p className="mt-3 text-encre/70">
        Ce lien a peut-être expiré ou a déjà été utilisé. Réessayez de vous
        connecter, ou refaites une demande d'inscription.
      </p>
      <Link href="/inscription" className="mt-6 text-brique underline">
        Retour à l'inscription
      </Link>
    </main>
  );
}
```

#### `src/app/nouveau-mot-de-passe/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NouveauMotDePasse() {
  const supabase = createClient();
  const [pret, setPret] = useState(false);
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Le lien de récupération établit une session ; on attend qu'elle soit là.
    supabase.auth.getSession().then(({ data }) => setPret(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPret(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (password.length < 8) {
      setErreur("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErreur("Lien expiré ou invalide. Demandez-en un nouveau.");
      return;
    }
    setOk(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-titre text-4xl font-600 text-encre">Nouveau mot de passe</h1>
      {ok ? (
        <div className="mt-4">
          <p className="font-corps text-encreDoux">
            ✓ Mot de passe mis à jour. Vous pouvez vous connecter.
          </p>
          <Link href="/connexion" className="mt-4 inline-block font-corps text-brique underline">
            Se connecter
          </Link>
        </div>
      ) : !pret ? (
        <p className="mt-4 font-corps text-encreDoux">
          Ouvrez cette page depuis le lien de réinitialisation reçu. Si vous y êtes
          déjà, patientez une seconde…
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block font-corps text-sm font-500 text-encre/70">
              Choisissez un mot de passe (8 caractères min.)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-encre/20 bg-carte px-3 py-2 font-corps outline-none focus:border-brique"
            />
          </label>
          {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brique px-6 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
    </main>
  );
}
```

### 14.5 Infrastructure, thème & configuration

#### `src/middleware.ts`

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // tout sauf les assets statiques et les images
    "/((?!_next/static|_next/image|favicon.ico|logos/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
```

#### `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

#### `src/lib/supabase/server.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieList = { name: string; value: string; options: CookieOptions }[];

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieList) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // appelé depuis un Server Component : ignoré (middleware gère le refresh)
          }
        },
      },
    },
  );
}
```

#### `src/lib/supabase/middleware.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieList = { name: string; value: string; options: CookieOptions }[];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieList) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Rafraîchit la session (obligatoire dans le middleware)
  await supabase.auth.getUser();
  return response;
}
```

#### `src/lib/supabase/service.ts`

```ts
import { createClient } from "@supabase/supabase-js";

// Client "service_role" — SERVEUR UNIQUEMENT. Contourne la RLS.
// À n'utiliser que dans des server actions protégées par requireAdmin().
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

#### `src/lib/espace.ts`

```ts
import { createClient } from "@/lib/supabase/server";

// Retourne le chemin de l'espace connecté de l'utilisateur courant,
// ou null s'il n'est pas connecté. Sert à empêcher un utilisateur déjà
// connecté de retomber sur l'accueil public / la connexion / l'inscription.
export async function espaceUtilisateur(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return prof?.role === "admin"
    ? "/admin"
    : prof?.role === "receptif"
      ? "/espace-receptif"
      : "/mon-espace";
}
```

#### `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Station TogeZer",
  description:
    "Rendez-vous entre agents de voyage et réceptifs partenaires — 15, 16 & 17 septembre 2026, Voie 15, Paris.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

#### `src/app/globals.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Mulish:wght@300;400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

body {
  @apply bg-creme text-encre antialiased;
  font-family: "Mulish", ui-sans-serif, system-ui, sans-serif;
}

/* Grain de sérigraphie subtil (tasteful, pas grunge) */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  opacity: 0.03;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@layer components {
  /* Filet double façon panneau émaillé */
  .filet-double {
    border-top: 1px solid theme("colors.ligne");
    box-shadow: 0 3px 0 -2px theme("colors.ligne");
  }
}
```

#### `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base papier — ivoire doux, chaleureux
        creme: "#F5EFE2",
        carte: "#FBF7EE", // intérieur émaillé des cartouches
        ligne: "#D8C6A8", // filets fins
        // Encre — brun espresso chaud (élégant, jamais noir dur)
        encre: "#3B2F26",
        encreDoux: "#7C6C5B",
        // Accent lead — terracotta / brique, désaturé pour l'élégance
        brique: "#B0503C",
        briqueFonce: "#8E3E2E",
        // Palette du Z UNIQUEMENT (désaturée)
        zBrique: "#B0503C",
        zMoutarde: "#C79A46",
        zSarcelle: "#4E827D",
        zSauge: "#93A079",
      },
      fontFamily: {
        titre: ['"Cormorant Garamond"', "Georgia", "serif"],
        corps: ['"Mulish"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        carte: "0 1px 2px rgba(59,47,38,0.04), 0 10px 30px rgba(59,47,38,0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

#### `src/components/AppHeader.tsx`

```tsx
import Link from "next/link";
import Deconnexion from "@/app/mon-espace/Deconnexion";

// En-tête des espaces connectés (agent) : logo + navigation + déconnexion.
export default function AppHeader() {
  return (
    <header className="border-b border-ligne bg-carte/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/mon-espace" aria-label="La Station TogeZer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-togezer.png" alt="La Station TogeZer" className="h-11 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/mon-espace"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Mon espace
          </Link>
          <Link
            href="/reservation"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Mes rendez-vous
          </Link>
          <Link
            href="/messages"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Messagerie
          </Link>
          <Link
            href="/mes-informations"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Mes informations
          </Link>
          <Link
            href="/annuaire"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Réceptifs
          </Link>
          <Deconnexion />
        </nav>
      </div>
    </header>
  );
}
```

#### `src/components/Wordmark.tsx`

```tsx
// Le logotype officiel « La Station TogeZer » — plaque émaillée avec le
// Z-pinceau signature. (L'ancienne version SVG texte est remplacée par l'asset.)

export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-togezer.png"
      alt="La Station TogeZer"
      width={677}
      height={369}
      className={className}
    />
  );
}
```

#### `src/components/Ornaments.tsx`

```tsx
// Iconographie fine au trait — un seul détail par composition, jamais lourde.

export function HorlogeQuai({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      {/* horloge de quai suspendue */}
      <path d="M24 4v4" />
      <circle cx="24" cy="24" r="15" />
      <circle cx="24" cy="24" r="1" fill="currentColor" stroke="none" />
      <path d="M24 15v9l6 4" />
    </svg>
  );
}

export function FiletRail({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 12"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden
      preserveAspectRatio="none"
    >
      {/* rail unique + traverses */}
      <line x1="0" y1="4" x2="200" y2="4" />
      <line x1="0" y1="8" x2="200" y2="8" />
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={i} x1={8 + i * 16} y1="2" x2={8 + i * 16} y2="10" />
      ))}
    </svg>
  );
}

// Globe au trait (méridiens/parallèles) — évoque la dimension internationale,
// en fond discret.
export function GlobeGrid({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden>
      <circle cx="100" cy="100" r="88" />
      <ellipse cx="100" cy="100" rx="88" ry="30" />
      <ellipse cx="100" cy="100" rx="88" ry="58" />
      <ellipse cx="100" cy="100" rx="30" ry="88" />
      <ellipse cx="100" cy="100" rx="58" ry="88" />
      <line x1="12" y1="100" x2="188" y2="100" />
      <line x1="100" y1="12" x2="100" y2="188" />
    </svg>
  );
}

// Séparateur « panneau émaillé » : filet double avec un petit repère central.
export function FiletGare({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-ligne ${className}`}>
      <span className="h-px flex-1 bg-ligne" />
      <span className="block h-1.5 w-1.5 rotate-45 border border-ligne" />
      <span className="h-px flex-1 bg-ligne" />
    </div>
  );
}
```

#### `src/components/GalerieVoie15.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

export default function GalerieVoie15({ images }: { images: string[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  // Fermeture au clavier (Échap)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {images.map((f) => (
          <button
            key={f}
            onClick={() => setOuvert(f)}
            aria-label="Agrandir la photo"
            className="group overflow-hidden rounded-lg shadow-carte"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/${f}`}
              alt="Voie 15"
              className="h-24 w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-105 sm:h-36"
            />
          </button>
        ))}
      </div>

      {ouvert && (
        <div
          onClick={() => setOuvert(null)}
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-encre/80 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/${ouvert}`}
            alt="Voie 15"
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-carte"
          />
          <button
            onClick={() => setOuvert(null)}
            aria-label="Fermer"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-creme/90 font-corps text-xl text-encre shadow-carte"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
```

#### `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

#### `package.json`

```json
{
  "name": "station-togezer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "gen:logos": "node scripts/gen-logos.mjs",
    "test:regles": "node scripts/test-regles.mjs",
    "etat:prod": "node scripts/etat-prod.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "next": "^15.5.20",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.4",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3"
  }
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `README.md`

```markdown
# La Station TogeZer — outil meet & match

Plateforme de prise de rendez-vous (agents de voyage ↔ réceptifs) — La Station TogeZer, Voie 15, Paris — **15, 16 & 17 septembre 2026**.

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
npm run dev                         # http://localhost:3000
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
```

#### `supabase/PROD_STATE.md`

```markdown
# État de la base de production

Une seule source de vérité : `supabase/migrations/`. Les copies `apply_*.sql` ont été
supprimées (audit du 5 juillet 2026). Chaque migration se colle telle quelle dans
Supabase → SQL Editor → Run, **dans l'ordre**, puis se coche ici.

## Vérifier l'état réel à tout moment

```bash
node scripts/etat-prod.mjs    # sonde la base (lecture seule)
node scripts/test-regles.mjs  # vérifie les 10 règles vitales (données ZZ-TEST, auto-nettoyage)
```

## Migrations appliquées

| Migration | Contenu | Appliquée | Vérifiée le |
|---|---|---|---|
| 0001 → 0016 | Schéma, RLS, moteur de réservation, admin | ✅ | 05/07/2026 (sonde) |
| 0017 | Réceptif réserve un agent | ✅ | 05/07/2026 (sonde) |
| 0018 | Messagerie agent ↔ réceptif | ✅ | 05/07/2026 (sonde) |
| 0019 | Durcissement (is_admin definer, revoke anon, taille messages) | ✅ | 05/07/2026 (10/10 tests + verrouillage anon confirmé) |
| 0020 | Déjeuner réseautage agent (demander/annuler/mes_dejeuners) | ✅ | 06/07/2026 (5/5 déjeuner + 10/10 règles) |

> Après application d'une migration : relancer les deux scripts ci-dessus,
> puis mettre à jour ce tableau.
```

*Fin du dossier technique — La Station TogeZer.*
