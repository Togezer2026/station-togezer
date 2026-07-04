-- =====================================================================
--  0012 — Espace réceptif : ses rendez-vous (agents qui ont réservé
--  avec lui). SECURITY DEFINER car un réceptif ne voit pas la table
--  agents directement (RLS).
-- =====================================================================
create or replace function receptif_rendez_vous()
returns table (
  id uuid,
  jour date,
  debut timestamp,
  fin timestamp,
  kind engagement_kind,
  receptif text,
  agence text,
  agent_nom text,
  agent_email text,
  agent_ville text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.jour, lower(e.plage)::timestamp, upper(e.plage)::timestamp, e.kind,
         x.nom, a.agence, trim(a.prenom || ' ' || a.nom), a.email, a.ville
  from engagements e
  join exposants x on x.id = e.exposant_id
  left join agents a on a.id = e.agent_id
  where e.statut = 'confirme'
    and x.proprietaire_id = auth.uid()
  order by e.jour, lower(e.plage);
$$;
grant execute on function receptif_rendez_vous() to authenticated;
