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
