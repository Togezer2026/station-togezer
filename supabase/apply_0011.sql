-- =====================================================================
--  0011 — Engagement de l'agent (« je m'engage à honorer / annuler »).
-- =====================================================================
alter table agents add column if not exists engagement_at timestamptz;

create or replace function valider_engagement()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from agents where id = v_uid) then
    raise exception 'Agent introuvable.';
  end if;
  update agents set engagement_at = now() where id = v_uid;
end;
$$;
grant execute on function valider_engagement() to authenticated;
