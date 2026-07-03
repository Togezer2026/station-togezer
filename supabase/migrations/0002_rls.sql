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
