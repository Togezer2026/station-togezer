-- La Station TogeZer — application complète (migrations + seed)
-- À coller dans Supabase → SQL Editor → Run

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

-- =====================================================================
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

insert into groupes (id, nom) values (gen_random_uuid(), 'Table Mathilde Quéva');

-- Atypique Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'atypique-voyages', 'Atypique Voyages', 'Sri Lanka', 'Asie', 'Réceptif spécialiste du Sri Lanka authentique — trains de montagne, plantations de thé et plages du Sud. Propose aussi des extensions balnéaires aux Maldives et des circuits culturels en Inde du Sud.', '/logos/atypique-voyages.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Maldives', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Inde du Sud', 'Asie');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-15', 'journee', true, 'Le Sri Lanka au-delà des sentiers battus');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-16', 'journee', false, null);

-- BRETZEL Travel GmbH
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'bretzel-travel', 'BRETZEL Travel GmbH', 'Allemagne', 'Europe', 'DMC germanophone couvrant l''Allemagne (routes romantiques, Bavière, Berlin) ainsi que l''Autriche et la Suisse. Marchés de Noël, randonnées alpines et city-breaks culturels.', '/logos/bretzel-travel.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'bretzel-travel'), 'Autriche', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'bretzel-travel'), 'Suisse', 'Europe');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'bretzel-travel'), '2026-09-15', 'biz_biz', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'bretzel-travel'), '2026-09-17', 'journee', false, null);

-- Brightside Travel LTD
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'brightside-travel', 'Brightside Travel LTD', 'Royaume-Uni', 'Europe', 'Réceptif britannique basé à Londres, expert des îles Britanniques : Angleterre, Écosse des Highlands et Irlande verdoyante. Autotours, châteaux et pubs de charme.', '/logos/brightside-travel.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'brightside-travel'), 'Irlande', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'brightside-travel'), 'Écosse', 'Europe');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'brightside-travel'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'brightside-travel'), '2026-09-16', 'petits_dej', false, null);

-- Contact Voyages Sénégal
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'contact-voyages-senegal', 'Contact Voyages Sénégal', 'Sénégal', 'Afrique', 'Réceptif sénégalais ancré à Dakar : Lac Rose, Saint-Louis et Sine-Saloum. Étend son savoir-faire à la Gambie fluviale et aux îles du Cap-Vert.', '/logos/contact-voyages-senegal.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), 'Gambie', 'Afrique');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), 'Cap-Vert', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), '2026-09-16', 'petits_dej', false, null);

-- Elite American Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'elite-american-voyages', 'Elite American Voyages', 'États-Unis', 'Amériques', 'Réceptif nord-américain : parcs de l''Ouest américain, road-trips Route 66 et villes mythiques. Propose aussi l''Ouest canadien et les plages du Mexique.', '/logos/elite-american-voyages.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'elite-american-voyages'), 'Canada', 'Amériques');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'elite-american-voyages'), 'Mexique', 'Amériques');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-16', 'petits_dej', false, null);

-- Alkémia
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'alkemia', 'Alkémia', 'Islande', 'Europe', 'Spécialiste des terres de feu et de glace : Islande volcanique, aurores boréales, Îles Féroé et Groenland. Petits groupes et logements de caractère.', '/logos/alkemia.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'alkemia'), 'Îles Féroé', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'alkemia'), 'Groenland', 'Amériques');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-17', 'petits_dej', false, null);

-- Tamazirt
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'tamazirt', 'Tamazirt', 'Maroc', 'Afrique', 'Réceptif marocain du grand Sud : dunes de Merzouga, médinas impériales et vallées de l''Atlas. Ouvre aussi ses pistes vers les déserts de Mauritanie.', '/logos/tamazirt.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'tamazirt'), 'Mauritanie', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-17', 'petits_dej', false, null);

-- Serengeti
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'serengeti', 'Serengeti', 'Tanzanie', 'Afrique', 'Réceptif safari en Afrique de l''Est : grande migration du Serengeti, cratère du Ngorongoro, réserves du Kenya et plages de Zanzibar.', '/logos/serengeti.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'serengeti'), 'Kenya', 'Afrique');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'serengeti'), 'Zanzibar', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-17', 'petits_dej', false, null);

commit;
