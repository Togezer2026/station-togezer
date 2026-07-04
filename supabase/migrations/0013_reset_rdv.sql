-- =====================================================================
--  0013 — L'agent peut réinitialiser (annuler) tous ses rendez-vous.
-- =====================================================================
create or replace function annuler_mes_rdv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update engagements
     set statut = 'annule'
   where agent_id = auth.uid()
     and kind in ('rdv_matin', 'rdv_aprem')
     and statut = 'confirme';
end;
$$;
grant execute on function annuler_mes_rdv() to authenticated;
