-- =====================================================================
--  Prépare le compte admin martin@togezer.travel.
--  À lancer APRÈS avoir créé l'utilisateur dans Supabase :
--  Authentication → Users → Add user → « Create new user »
--  (email martin@togezer.travel + mot de passe).
--
--  Ce script (1) confirme l'e-mail si besoin, (2) attribue le rôle admin.
-- =====================================================================

-- (1) Confirme l'adresse e-mail (au cas où elle ne le serait pas déjà)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'martin@togezer.travel';

-- (2) Donne le rôle admin
insert into profiles (id, role, email, full_name)
select id, 'admin', email, 'Martin'
from auth.users
where email = 'martin@togezer.travel'
on conflict (id) do update set role = 'admin';
