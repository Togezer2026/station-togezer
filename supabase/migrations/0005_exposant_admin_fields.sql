-- =====================================================================
--  Champs additionnels sur les exposants (données d'inscription réelles,
--  utiles à l'administration).
-- =====================================================================
alter table exposants
  add column if not exists contact_nom  text,
  add column if not exists whatsapp     text,
  add column if not exists nb_personnes int,
  add column if not exists notes        text,
  add column if not exists representant text;
