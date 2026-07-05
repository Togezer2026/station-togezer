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
