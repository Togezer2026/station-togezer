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
