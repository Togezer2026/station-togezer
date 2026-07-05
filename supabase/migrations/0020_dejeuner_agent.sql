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
