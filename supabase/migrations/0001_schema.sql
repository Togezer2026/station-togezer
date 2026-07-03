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
