-- Lot 7 — Conformité maquette (PDF de recette 2026-09-15, tous rôles).
--
-- 1. Objectifs : le cadrage initial ne prévoyait que 2 "secteurs" au sens
--    large (OPTICIEN / MODE_SURF_SPORT, cf. objectives.sectors). Les PDF de
--    recette du 15/09/2026 (Directeur commercial section 4, Représentant
--    section 0/1) sont explicites : un objectif doit se filtrer par une
--    sélection MULTIPLE parmi les 11 typologies client réelles (Opticien,
--    Surf Shop, Fashion Store, Skate Shop, Ski Shop, Concept Store, Uship,
--    Bike Store, Key Account, Distributor, Autre), pas par un secteur agrégé
--    à 2 valeurs. On ajoute donc `typologies` sans supprimer `sectors`
--    (aucune donnée existante perdue, cf. conventions du projet) : le code
--    applicatif bascule sur `typologies` à partir de cette migration,
--    `sectors` n'est plus écrit ni lu par les nouvelles requêtes.
ALTER TABLE objectives ADD COLUMN typologies typology[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN objectives.sectors IS
  'Obsolète depuis la migration 015 — conservée pour historique uniquement, plus lue par le code. Le filtrage par typologie(s) client passe désormais par objectives.typologies (sélection multiple parmi les 11 typologies, cf. PDF de recette Directeur/Représentant du 15/09/2026).';

-- 2. Référentiel des types d'interaction / de rendez-vous. Deux PDF donnent
--    deux listes minimales différentes pour le même besoin ("Ajouter une
--    interaction" sur la fiche client) : le PDF Directeur veut "rendez-vous
--    planifié, rendez-vous téléphonique, rendez-vous de courtoisie", le PDF
--    Représentant veut au minimum "Appel, Email, SAV, Autre" (avec "Visite"
--    en exemple maquette) — et précise lui-même : "Le référentiel final peut
--    intégrer les deux ensembles si nécessaire." Décision retenue : liste
--    fusionnée unique, réutilisée à la fois pour le type d'interaction et
--    pour le sous-type de RDV lors de la planification (cf.
--    lib/interactionTypes.js). Colonnes nullable : les lignes existantes ne
--    sont jamais rétroactivement classées (jamais de devinette).
ALTER TABLE interactions ADD COLUMN type TEXT;
ALTER TABLE tasks ADD COLUMN rdv_subtype TEXT;

COMMENT ON COLUMN interactions.type IS
  'Type d''interaction (référentiel fusionné, cf. lib/interactionTypes.js : VISITE, APPEL, EMAIL, RDV_COURTOISIE, SAV, AUTRE). Nullable : les interactions créées avant cette migration, ou sans type précisé, restent NULL plutôt que classées au hasard.';
COMMENT ON COLUMN tasks.rdv_subtype IS
  'Sous-type du rendez-vous planifié (uniquement pertinent si tasks.type = ''RDV''), même référentiel fusionné que interactions.type. Nullable pour la même raison.';
