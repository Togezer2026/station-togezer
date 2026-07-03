-- =====================================================================
--  Inscription agent : à la création d'un compte Auth, on crée
--  automatiquement le profil (role=agent) et la fiche agent, à partir
--  des métadonnées transmises au signUp.
--  NB : les jours de venue sont choisis APRÈS l'inscription, à la
--  première étape de la prise de rendez-vous (pas ici).
-- =====================================================================

create or replace function handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- On ne traite que les inscriptions agents (métadonnées 'agence' présentes)
  if (new.raw_user_meta_data ? 'agence') then
    insert into profiles (id, role, email, full_name)
      values (
        new.id, 'agent', new.email,
        trim(coalesce(new.raw_user_meta_data->>'prenom','') || ' ' ||
             coalesce(new.raw_user_meta_data->>'nom',''))
      )
      on conflict (id) do nothing;

    insert into agents (id, agence, prenom, nom, email, telephone)
      values (
        new.id,
        new.raw_user_meta_data->>'agence',
        new.raw_user_meta_data->>'prenom',
        new.raw_user_meta_data->>'nom',
        new.email,
        nullif(new.raw_user_meta_data->>'telephone','')
      )
      on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_agent();
