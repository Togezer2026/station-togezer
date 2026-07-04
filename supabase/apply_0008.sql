-- =====================================================================
--  0008 — Lectures pour la prise de RDV (côté agent).
--  Un agent ne peut PAS voir les RDV des autres (RLS). Ces fonctions
--  SECURITY DEFINER exposent juste ce qu'il faut : les créneaux OCCUPÉS
--  d'un réceptif (sans révéler qui), et le programme de l'agent connecté.
-- =====================================================================

-- Créneaux occupés sur la ressource d'un réceptif (gère le blocage croisé
-- des regroupements via resource_id, et le blocage pendant les présentations).
create or replace function creneaux_occupes(p_exposant_id uuid, p_jour date)
returns table (debut timestamp)
language sql
security definer
set search_path = public
as $$
  select lower(plage)::timestamp as debut
  from engagements
  where statut = 'confirme'
    and jour = p_jour
    and resource_id = (select coalesce(groupe_id, id) from exposants where id = p_exposant_id);
$$;
grant execute on function creneaux_occupes(uuid, date) to authenticated;

-- Programme de l'agent connecté (avec nom du réceptif + représentant éventuel,
-- pour révéler « avec Mathilde Quéva » au récapitulatif).
create or replace function mes_engagements()
returns table (
  id uuid,
  exposant_id uuid,
  exposant_nom text,
  representant text,
  jour date,
  kind engagement_kind,
  debut timestamp,
  fin timestamp
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.exposant_id, x.nom, x.representant, e.jour, e.kind,
         lower(e.plage)::timestamp, upper(e.plage)::timestamp
  from engagements e
  left join exposants x on x.id = e.exposant_id
  where e.agent_id = auth.uid() and e.statut = 'confirme'
  order by e.jour, lower(e.plage);
$$;
grant execute on function mes_engagements() to authenticated;
