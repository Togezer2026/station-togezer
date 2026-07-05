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
