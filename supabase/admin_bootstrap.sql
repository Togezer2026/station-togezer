-- =====================================================================
--  Donne le rôle admin à martin@togezer.travel.
--  À lancer APRÈS avoir créé l'utilisateur dans Supabase :
--  Authentication → Users → Add user → martin@togezer.travel + mot de passe
--  (coche « Auto Confirm User »).
-- =====================================================================
insert into profiles (id, role, email, full_name)
select id, 'admin', email, 'Martin'
from auth.users
where email = 'martin@togezer.travel'
on conflict (id) do update set role = 'admin';
