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
