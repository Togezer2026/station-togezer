-- =====================================================================
--  0009 — Vue admin de tous les rendez-vous (confirmés), avec les
--  infos agent + réceptif, pour la supervision et les exports.
-- =====================================================================
create or replace function admin_rendez_vous()
returns table (
  id uuid,
  jour date,
  debut timestamp,
  fin timestamp,
  kind engagement_kind,
  agence text,
  agent_nom text,
  agent_email text,
  receptif text,
  representant text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.jour, lower(e.plage)::timestamp, upper(e.plage)::timestamp, e.kind,
         a.agence, trim(a.prenom || ' ' || a.nom), a.email, x.nom, x.representant
  from engagements e
  left join agents a on a.id = e.agent_id
  left join exposants x on x.id = e.exposant_id
  where e.statut = 'confirme' and (select is_admin())
  order by e.jour, lower(e.plage);
$$;
grant execute on function admin_rendez_vous() to authenticated;
