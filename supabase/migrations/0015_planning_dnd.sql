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
