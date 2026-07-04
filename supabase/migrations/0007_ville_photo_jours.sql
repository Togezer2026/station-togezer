-- =====================================================================
--  0007 — Ville de l'agence, photo/bio du représentant réceptif,
--         et fonction de choix des jours (1re étape de la prise de RDV).
-- =====================================================================

-- Ville de l'agence (agent)
alter table agents add column if not exists ville text;

-- Représentant côté réceptif : photo + petite bio (brise-glace humain)
alter table exposants add column if not exists contact_photo text;
alter table exposants add column if not exists contact_bio   text;

-- Trigger d'inscription agent : on stocke aussi la ville
create or replace function handle_new_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.raw_user_meta_data ? 'agence') then
    insert into profiles (id, role, email, full_name)
      values (new.id, 'agent', new.email,
        trim(coalesce(new.raw_user_meta_data->>'prenom','') || ' ' ||
             coalesce(new.raw_user_meta_data->>'nom','')))
      on conflict (id) do nothing;
    insert into agents (id, agence, ville, prenom, nom, email, telephone)
      values (new.id,
        new.raw_user_meta_data->>'agence',
        new.raw_user_meta_data->>'ville',
        new.raw_user_meta_data->>'prenom',
        new.raw_user_meta_data->>'nom',
        new.email,
        nullif(new.raw_user_meta_data->>'telephone',''))
      on conflict (id) do nothing;
  end if;
  return new;
end; $$;

-- 1re étape de la prise de RDV : l'agent choisit / met à jour ses jours de venue.
-- Retirer un jour annule aussi les RDV de l'agent sur ce jour.
create or replace function definir_jours_agent(p_jours date[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Seuls les agents peuvent choisir leurs jours.';
  end if;

  -- Annule les engagements de l'agent sur les jours retirés
  update engagements set statut = 'annule'
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  -- Met à jour la liste des jours
  delete from agent_jours
   where agent_id = v_uid and not (jour = any(coalesce(p_jours, '{}')));
  insert into agent_jours (agent_id, jour)
   select v_uid, unnest(coalesce(p_jours, '{}'))
  on conflict do nothing;
end; $$;

grant execute on function definir_jours_agent(date[]) to authenticated;
