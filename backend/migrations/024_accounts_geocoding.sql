-- Correctif 2026-09-23 (demande client — "Intègre une vraie carte interactive
-- qui positionne tous les clients/prospects, en remplacement de l'écran
-- Carte existant") : coordonnées géographiques de la fiche client, calculées
-- automatiquement (jamais saisies à la main) et invisibles pour
-- l'utilisateur — cf. lib/geocoding.js pour le détail du calcul (adresse de
-- livraison en priorité, repli sur la facturation si absente) et
-- scripts/geocode-existing-accounts.mjs pour le rattrapage des fiches déjà
-- en base au moment de ce correctif.
--
-- Fournisseur de géocodage : Nominatim/OpenStreetMap (jamais Mapbox pour
-- cette partie — leur API de géocodage exige une carte bancaire enregistrée
-- pour autoriser le stockage durable des résultats, ce que le client a
-- explicitement refusé ; Nominatim est gratuit, sans compte ni carte, et
-- leur politique d'usage autorise/recommande explicitement de mettre en
-- cache les résultats côté application — cf. commentaire lib/geocoding.js).
-- Mapbox GL JS reste utilisé uniquement pour l'AFFICHAGE de la carte
-- (frontend/src/components/AccountsMap.jsx), pas pour le géocodage.
--
-- DOUBLE PRECISION (pas NUMERIC) : precision largement suffisante pour un
-- pointeur de carte (~1cm), et évite toute conversion manuelle côté
-- driver pg (NUMERIC reviendrait en JS sous forme de chaîne de caractères
-- sans configuration supplémentaire du parseur de types).
ALTER TABLE accounts ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE accounts ADD COLUMN longitude DOUBLE PRECISION;

COMMENT ON COLUMN accounts.latitude IS
  'Latitude calculée automatiquement par géocodage (Nominatim/OpenStreetMap) '
  'à partir de l''adresse de livraison (repli facturation) — jamais saisie '
  'manuellement, NULL si aucune correspondance trouvée. Utilisée uniquement '
  'par l''écran Carte (AccountsMap.jsx).';
COMMENT ON COLUMN accounts.longitude IS
  'Longitude — voir commentaire de la colonne latitude.';
