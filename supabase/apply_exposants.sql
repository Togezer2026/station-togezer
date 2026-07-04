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

-- =====================================================================
--  Seed exposants — liste RÉELLE des inscrits (généré par scripts/gen-seed.mjs)
--  SÉCURITÉ : aucun e-mail réel. Tous les contacts = martin@togezer.travel.
--  NE PAS éditer à la main.
-- =====================================================================
begin;

delete from engagements;
delete from exposant_destinations;
delete from presences;
delete from exposants;

insert into dejeuner_config (jour, capacite) values
  ('2026-09-15', 20), ('2026-09-16', 20), ('2026-09-17', 20)
on conflict (jour) do update set capacite = excluded.capacite;

-- Serengeti Big Cats Safaris
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'serengeti-big-cats-safaris', 'Serengeti Big Cats Safaris', 'TANZANIE', 'Afrique', 'TANZANIE', '/logos/serengeti-big-cats-safaris.svg', 'martin@togezer.travel', 'CECILE', '+255767070880', 2, 'J''accompagnerai Mathilde', 'Mathilde Quéva');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'serengeti-big-cats-safaris'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'serengeti-big-cats-safaris'), '2026-09-16', 'petits_dej');

-- African Eagle Namibie
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'african-eagle-namibie', 'African Eagle Namibie', 'NAMIBIE', 'Afrique', 'NAMIBIE', '/logos/african-eagle-namibie.svg', 'martin@togezer.travel', 'CHRISTIAN MUTONJI', '+264813268386', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'african-eagle-namibie'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'african-eagle-namibie'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'african-eagle-namibie'), '2026-09-17', 'petits_dej');

-- Algerie Tours
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'algerie-tours', 'Algerie Tours', 'ALGERIE', 'Afrique', 'ALGERIE', '/logos/algerie-tours.svg', 'martin@togezer.travel', 'Amine LAGOUNE', '+33615325916', 1, 'Le tarif est bien pour les 03 Matinées ?', null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'algerie-tours'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'algerie-tours'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'algerie-tours'), '2026-09-17', 'petits_dej');

-- archipel contact
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'archipel-contact', 'archipel contact', 'indonésie', 'Asie', 'indonésie', '/logos/archipel-contact.svg', 'martin@togezer.travel', 'sylvie ponte', '+33659884894', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'archipel-contact'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'archipel-contact'), '2026-09-16', 'petits_dej');

-- Atypique Indonésie
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'atypique-indonesie', 'Atypique Indonésie', 'Indonésie', 'Asie', 'Indonésie', '/logos/atypique-indonesie.svg', 'martin@togezer.travel', 'Gauthier Touraine', '+6281238110668', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-indonesie'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-indonesie'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-indonesie'), '2026-09-17', 'petits_dej');

-- Atypique Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'atypique-voyages', 'Atypique Voyages', 'Sri Lanka', 'Asie', 'Sri Lanka, Maldives, Vietnam et Philippines', '/logos/atypique-voyages.svg', 'martin@togezer.travel', 'Chamika Kathri Arachchige', '+94766451002', 2, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Maldives', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'atypique-voyages'), 'Vietnam et Philippines', 'Asie');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'atypique-voyages'), '2026-09-17', 'petits_dej');

-- BRETZEL Travel GmbH
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'bretzel-travel-gmbh', 'BRETZEL Travel GmbH', 'Allemagne', 'Europe', 'Allemagne, Autriche', '/logos/bretzel-travel-gmbh.svg', 'martin@togezer.travel', 'Léna Schneider', 'celui d''Hugo pour le moment +4915290088286', 2, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'bretzel-travel-gmbh'), 'Autriche', 'Europe');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'bretzel-travel-gmbh'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'bretzel-travel-gmbh'), '2026-09-16', 'petits_dej');

-- Brightside Travel LTD
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'brightside-travel-ltd', 'Brightside Travel LTD', 'Grande Bretagne et Irlande', 'Europe', 'Grande Bretagne et Irlande', '/logos/brightside-travel-ltd.svg', 'martin@togezer.travel', 'Loic Acosta', '+447447013109', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'brightside-travel-ltd'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'brightside-travel-ltd'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'brightside-travel-ltd'), '2026-09-17', 'petits_dej');

-- Contact Voyages SÉNÉGal
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'contact-voyages-senegal', 'Contact Voyages SÉNÉGal', 'Sénégal', 'Afrique', 'Sénégal', '/logos/contact-voyages-senegal.svg', 'martin@togezer.travel', 'Abou BA', '00221766836438', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'contact-voyages-senegal'), '2026-09-17', 'biz_biz');

-- elite american voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'elite-american-voyages', 'elite american voyages', 'USA CANADA BAHAMAS', 'Amériques', 'USA CANADA BAHAMAS', '/logos/elite-american-voyages.svg', 'martin@togezer.travel', 'JOHAN MIQUEL', '+33669064338', 1, 'Tara, notre cheffe de production, sera présente lors des petit-déj.', null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'elite-american-voyages'), '2026-09-16', 'petits_dej');

-- Escapades Madagascar
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'escapades-madagascar', 'Escapades Madagascar', 'MADAGASCAR', 'Afrique', 'MADAGASCAR', '/logos/escapades-madagascar.svg', 'martin@togezer.travel', 'Mbola RASOANAIVO', '+261320512626', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'escapades-madagascar'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'escapades-madagascar'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'escapades-madagascar'), '2026-09-17', 'petits_dej');

-- Evasion Tropicale
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'evasion-tropicale', 'Evasion Tropicale', 'les Philippines', 'Asie', 'les Philippines', '/logos/evasion-tropicale.svg', 'martin@togezer.travel', 'Kevin Labbe', '+639291387468', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'evasion-tropicale'), '2026-09-17', 'petits_dej');

-- Go Beyond
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'go-beyond', 'Go Beyond', 'Thaïlande', 'Asie', 'Thaïlande, Vietnam, Chine, Sri Lanka', '/logos/go-beyond.svg', 'martin@togezer.travel', 'Marc Ruffet', '+41799112502', 1, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'go-beyond'), 'Vietnam', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'go-beyond'), 'Chine', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'go-beyond'), 'Sri Lanka', 'Asie');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'go-beyond'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'go-beyond'), '2026-09-16', 'petits_dej');

-- Mai Globe Travels
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'mai-globe-travels', 'Mai Globe Travels', 'Sri Lanka', 'Asie', 'Sri Lanka, Vietnam', '/logos/mai-globe-travels.svg', 'martin@togezer.travel', 'Catherine Lebouille', '0094773240190', 1, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'mai-globe-travels'), 'Vietnam', 'Asie');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'mai-globe-travels'), '2026-09-16', 'petits_dej');

-- MozSensations
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'mozsensations', 'MozSensations', 'Mozambique', 'Afrique', 'Moz Zam Zim', '/logos/mozsensations.svg', 'martin@togezer.travel', 'Laurence Caille', '258848344738', 1, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'mozsensations'), 'Zambie', 'Afrique');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'mozsensations'), 'Zimbabwe', 'Afrique');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'mozsensations'), '2026-09-15', 'petits_dej');

-- Phima Voyages
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'phima-voyages', 'Phima Voyages', 'Nord du Pérou', 'Amériques', 'Nord du Pérou', '/logos/phima-voyages.svg', 'martin@togezer.travel', 'Martina Capel', '(068) 037-0580', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'phima-voyages'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'phima-voyages'), '2026-09-16', 'petits_dej');

-- Pura Vida Cabo Verde
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'pura-vida-cabo-verde', 'Pura Vida Cabo Verde', 'Cap Vert', 'Afrique', 'Cap Vert', '/logos/pura-vida-cabo-verde.svg', 'martin@togezer.travel', 'Stan Brun', '33687852280', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'pura-vida-cabo-verde'), '2026-09-16', 'petits_dej');

-- Senses of Siam
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'senses-of-siam', 'Senses of Siam', 'Thaïlande', 'Asie', 'Thaïlande', '/logos/senses-of-siam.svg', 'martin@togezer.travel', 'Charles Dubost', '+66880928136', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'senses-of-siam'), '2026-09-16', 'journee');

-- Shanti Travel
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'shanti-travel', 'Shanti Travel', 'Inde Indo Japon SL Vietnam Philippines', 'Asie', 'Inde Indo Japon SL Vietnam Philippines', '/logos/shanti-travel.svg', 'martin@togezer.travel', 'Melissa', '(065) 277-8609', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'shanti-travel'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'shanti-travel'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'shanti-travel'), '2026-09-17', 'petits_dej');

-- Sikiliza
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'sikiliza', 'Sikiliza', 'ZIMBABWE BOTSWANA', 'Afrique', 'ZIMBABWE BOTSWANA', '/logos/sikiliza.svg', 'martin@togezer.travel', 'Nathalie CALONNE', '+263772261831', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'sikiliza'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'sikiliza'), '2026-09-16', 'biz_biz');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'sikiliza'), '2026-09-17', 'petits_dej');

-- Swiss Travel Tour
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'swiss-travel-tour', 'Swiss Travel Tour', 'Suisse', 'Europe', 'Suisse', '/logos/swiss-travel-tour.svg', 'martin@togezer.travel', 'Elsa Barrault', '+41775228980', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'swiss-travel-tour'), '2026-09-15', 'petits_dej');

-- Tanganyika Expeditions
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'tanganyika-expeditions', 'Tanganyika Expeditions', 'TANZANIE', 'Afrique', 'TANZANIE/ZANZIBAR', '/logos/tanganyika-expeditions.svg', 'martin@togezer.travel', 'Laurent Gavache', '+33619398800', 1, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'tanganyika-expeditions'), 'ZANZIBAR', 'Afrique');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'tanganyika-expeditions'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'tanganyika-expeditions'), '2026-09-16', 'petits_dej');

-- Terra Australia
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-australia', 'Terra Australia', 'Australie', 'Océanie', 'Australie', '/logos/terra-australia.svg', 'martin@togezer.travel', 'Christophe Napierai', '+61405217169', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-australia'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-australia'), '2026-09-16', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-australia'), '2026-09-17', 'journee');

-- Terra Balka
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-balka', 'Terra Balka', 'Balkans', 'Europe', 'Balkans (Croatie, Slovénie, Monténégro, Bosnie Herzégovine, Albanie, Macédoine, Kosovo)', '/logos/terra-balka.svg', 'martin@togezer.travel', 'Hugo DIMOFF', '+33 6 45 56 83 12', 2, 'Hugo et John seront présents.', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Croatie', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Slovénie', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Monténégro', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Bosnie Herzégovine', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Albanie', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Macédoine', 'Europe');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'terra-balka'), 'Kosovo', 'Europe');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-balka'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-balka'), '2026-09-16', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-balka'), '2026-09-17', 'journee');

-- Terra Chile
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-chile', 'Terra Chile', 'Chili', 'Amériques', 'Chili', '/logos/terra-chile.svg', 'martin@togezer.travel', 'Océane Vigné', '+33672145147', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-chile'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-chile'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-chile'), '2026-09-17', 'petits_dej');

-- Terra Dominicana
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-dominicana', 'Terra Dominicana', 'République Dominicaine', 'Amériques', 'République Dominicaine', '/logos/terra-dominicana.svg', 'martin@togezer.travel', 'Laura grenouillet', '+50688631070', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-dominicana'), '2026-09-16', 'petits_dej');

-- Terra Gaïa Altiplano
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-gaia-altiplano', 'Terra Gaïa Altiplano', 'Argentine : Nord ouest Argentine & Altiplano', 'Amériques', 'Argentine : Nord ouest Argentine & Altiplano', '/logos/terra-gaia-altiplano.svg', 'martin@togezer.travel', 'antoine dekyvere', '+5493874872449', 1, 'c''est quoi la salle de conference ? different du bureau l''apres midi ?', null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-altiplano'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-altiplano'), '2026-09-16', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-altiplano'), '2026-09-17', 'journee');

-- Terra Gaïa Argentina
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-gaia-argentina', 'Terra Gaïa Argentina', 'Argentine', 'Amériques', 'Argentine', '/logos/terra-gaia-argentina.svg', 'martin@togezer.travel', 'Emilie Pinel', '+5492944925934', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-argentina'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-argentina'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-argentina'), '2026-09-17', 'petits_dej');

-- Terra Gaia Bolivia
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-gaia-bolivia', 'Terra Gaia Bolivia', 'La Bolivie', 'Amériques', 'La Bolivie', '/logos/terra-gaia-bolivia.svg', 'martin@togezer.travel', 'Antoine Mayer', '+33 6 95 18 14 18', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-bolivia'), '2026-09-15', 'biz_biz');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-bolivia'), '2026-09-16', 'biz_biz');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-bolivia'), '2026-09-17', 'biz_biz');

-- Terra Gaïa Brazil
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-gaia-brazil', 'Terra Gaïa Brazil', 'Brésil', 'Amériques', 'Brésil', '/logos/terra-gaia-brazil.svg', 'martin@togezer.travel', 'Alice Prevot', '''+55 (21) 99696-4039', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-brazil'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-brazil'), '2026-09-16', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-brazil'), '2026-09-17', 'journee');

-- Terra Gaia Ecuador & Galápagos
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-gaia-ecuador-galapagos', 'Terra Gaia Ecuador & Galápagos', 'Équateur et Galapagos', 'Amériques', 'Équateur et Galapagos', '/logos/terra-gaia-ecuador-galapagos.svg', 'martin@togezer.travel', 'Nicolas Goronflot', '+593987159732', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-ecuador-galapagos'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-ecuador-galapagos'), '2026-09-16', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-gaia-ecuador-galapagos'), '2026-09-17', 'journee');

-- Terra Guatemala
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-guatemala', 'Terra Guatemala', 'Guatemala Belize', 'Amériques', 'Guatemala Belize', '/logos/terra-guatemala.svg', 'martin@togezer.travel', 'Tristan Reger', '(502) 3684 7687', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-guatemala'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-guatemala'), '2026-09-16', 'petits_dej');

-- Terra Maya
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-maya', 'Terra Maya', 'MEXIQUE', 'Amériques', 'MEXIQUE', '/logos/terra-maya.svg', 'martin@togezer.travel', 'Adelind Chambrier', '(999) 366-7552', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-maya'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-maya'), '2026-09-16', 'petits_dej');

-- terra morocco
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-morocco', 'terra morocco', 'maroc', 'Afrique', 'maroc', '/logos/terra-morocco.svg', 'martin@togezer.travel', 'laura', '00212662343381', 2, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-morocco'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-morocco'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-morocco'), '2026-09-17', 'petits_dej');

-- Terra Nicaragua
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-nicaragua', 'Terra Nicaragua', 'NICARAGUA', 'Amériques', 'NICARAGUA', '/logos/terra-nicaragua.svg', 'martin@togezer.travel', 'Daphné de Vautibault', '+502 35897157', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-nicaragua'), '2026-09-16', 'petits_dej');

-- Terra Peru
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'terra-peru', 'Terra Peru', 'Peru', 'Amériques', 'Peru', '/logos/terra-peru.svg', 'martin@togezer.travel', 'Vicky Minaya', '+51 940203741', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-peru'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-peru'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'terra-peru'), '2026-09-17', 'petits_dej');

-- Tierra Latina Argentine / Brésil
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'tierra-latina-argentine-bresil', 'Tierra Latina Argentine / Brésil', 'Argentine', 'Amériques', 'Argentine / Brésil / Mexique', '/logos/tierra-latina-argentine-bresil.svg', 'martin@togezer.travel', 'Chloé Proust', '+33628229162', 2, null, null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'tierra-latina-argentine-bresil'), 'Brésil', 'Amériques');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'tierra-latina-argentine-bresil'), 'Mexique', 'Amériques');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'tierra-latina-argentine-bresil'), '2026-09-16', 'petits_dej');

-- Viasuntours
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'viasuntours', 'Viasuntours', 'Grèce', 'Europe', 'Grèce', '/logos/viasuntours.svg', 'martin@togezer.travel', 'Charles', '00306936021114', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'viasuntours'), '2026-09-15', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'viasuntours'), '2026-09-16', 'petits_dej');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'viasuntours'), '2026-09-17', 'petits_dej');

-- Wakiy Tour
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'wakiy-tour', 'Wakiy Tour', 'Equateur', 'Amériques', 'Equateur', '/logos/wakiy-tour.svg', 'martin@togezer.travel', 'Olivia Baine', '0033648393511', 1, null, null);
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'wakiy-tour'), '2026-09-15', 'journee');

-- Xplore
insert into exposants (id, slug, nom, pays_principal, continent_principal, description, logo_path, email_contact, contact_nom, whatsapp, nb_personnes, notes, representant)
  values (gen_random_uuid(), 'xplore', 'Xplore', 'Mexique', 'Amériques', 'Mexique, Oman, Brésil, Indonésie', '/logos/xplore.svg', 'martin@togezer.travel', 'Benjamin SENOUSSI', '+33683112966', 2, 'Hola, Nous nous mettrons sur la desti sur laquelle vous pourrez nous trouver une petite place :)', null);
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'xplore'), 'Oman', 'Asie');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'xplore'), 'Brésil', 'Amériques');
insert into exposant_destinations (exposant_id, pays, continent)
  values ((select id from exposants where slug = 'xplore'), 'Indonésie', 'Asie');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'xplore'), '2026-09-15', 'journee');
insert into presences (exposant_id, jour, formule)
  values ((select id from exposants where slug = 'xplore'), '2026-09-16', 'petits_dej');

commit;
