-- =====================================================================
--  Seed de test — 8 exposants factices (dont le groupe « Table Mathilde Quéva »)
--  Généré par scripts/gen-seed.mjs — NE PAS éditer à la main.
-- =====================================================================
begin;

-- Réinitialisation des données de test (idempotent)
delete from engagements;
delete from exposant_destinations;
delete from presences;
delete from exposants;
delete from groupes;

-- Capacité déjeuner (globale par jour) — à ajuster par l'admin
insert into dejeuner_config (jour, capacite) values
  ('2026-09-15', 20), ('2026-09-16', 20), ('2026-09-17', 20)
on conflict (jour) do update set capacite = excluded.capacite;

insert into groupes (id, nom) values (gen_random_uuid(), 'Table Mathilde Quéva');

-- Atypique Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'atypique-voyages', 'Atypique Voyages', 'Sri Lanka', 'Asie', 'Réceptif spécialiste du Sri Lanka authentique — trains de montagne, plantations de thé et plages du Sud. Propose aussi des extensions balnéaires aux Maldives et des circuits culturels en Inde du Sud.', '/logos/atypique-voyages.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Maldives', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Inde du Sud', 'Asie');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-15', 'journee', true, 'Le Sri Lanka au-delà des sentiers battus');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-16', 'journee', false, null);

-- BRETZEL Travel GmbH
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'bretzel-travel', 'BRETZEL Travel GmbH', 'Allemagne', 'Europe', 'DMC germanophone couvrant l''Allemagne (routes romantiques, Bavière, Berlin) ainsi que l''Autriche et la Suisse. Marchés de Noël, randonnées alpines et city-breaks culturels.', '/logos/bretzel-travel.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'bretzel-travel'), 'Autriche', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'bretzel-travel'), 'Suisse', 'Europe');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'bretzel-travel'), '2026-09-15', 'biz_biz', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'bretzel-travel'), '2026-09-17', 'journee', false, null);

-- Brightside Travel LTD
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'brightside-travel', 'Brightside Travel LTD', 'Royaume-Uni', 'Europe', 'Réceptif britannique basé à Londres, expert des îles Britanniques : Angleterre, Écosse des Highlands et Irlande verdoyante. Autotours, châteaux et pubs de charme.', '/logos/brightside-travel.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'brightside-travel'), 'Irlande', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'brightside-travel'), 'Écosse', 'Europe');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'brightside-travel'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'brightside-travel'), '2026-09-16', 'petits_dej', false, null);

-- Contact Voyages Sénégal
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'contact-voyages-senegal', 'Contact Voyages Sénégal', 'Sénégal', 'Afrique', 'Réceptif sénégalais ancré à Dakar : Lac Rose, Saint-Louis et Sine-Saloum. Étend son savoir-faire à la Gambie fluviale et aux îles du Cap-Vert.', '/logos/contact-voyages-senegal.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), 'Gambie', 'Afrique');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), 'Cap-Vert', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), '2026-09-16', 'petits_dej', false, null);

-- Elite American Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'elite-american-voyages', 'Elite American Voyages', 'États-Unis', 'Amériques', 'Réceptif nord-américain : parcs de l''Ouest américain, road-trips Route 66 et villes mythiques. Propose aussi l''Ouest canadien et les plages du Mexique.', '/logos/elite-american-voyages.svg', 'martin@togezer.travel', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'elite-american-voyages'), 'Canada', 'Amériques');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'elite-american-voyages'), 'Mexique', 'Amériques');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-16', 'petits_dej', false, null);

-- Alkémia
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'alkemia', 'Alkémia', 'Islande', 'Europe', 'Spécialiste des terres de feu et de glace : Islande volcanique, aurores boréales, Îles Féroé et Groenland. Petits groupes et logements de caractère.', '/logos/alkemia.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'alkemia'), 'Îles Féroé', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'alkemia'), 'Groenland', 'Amériques');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'alkemia'), '2026-09-17', 'petits_dej', false, null);

-- Tamazirt
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'tamazirt', 'Tamazirt', 'Maroc', 'Afrique', 'Réceptif marocain du grand Sud : dunes de Merzouga, médinas impériales et vallées de l''Atlas. Ouvre aussi ses pistes vers les déserts de Mauritanie.', '/logos/tamazirt.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'tamazirt'), 'Mauritanie', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'tamazirt'), '2026-09-17', 'petits_dej', false, null);

-- Serengeti
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, groupe_id)
  values (gen_random_uuid(), 'serengeti', 'Serengeti', 'Tanzanie', 'Afrique', 'Réceptif safari en Afrique de l''Est : grande migration du Serengeti, cratère du Ngorongoro, réserves du Kenya et plages de Zanzibar.', '/logos/serengeti.svg', 'martin@togezer.travel', (select id from groupes where nom = 'Table Mathilde Quéva'));
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'serengeti'), 'Kenya', 'Afrique');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'serengeti'), 'Zanzibar', 'Afrique');
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-15', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-16', 'petits_dej', false, null);
insert into presences (exposant_id, jour, formule, tient_presentation, theme)
  values ((select id from exposants where slug = 'serengeti'), '2026-09-17', 'petits_dej', false, null);

commit;
