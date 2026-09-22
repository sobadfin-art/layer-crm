-- Correctif 2026-09-22 (demande client — "Recherche client par nom commercial
-- ET raison sociale"), évolution 1/3.
--
-- Champ dédié, distinct de `name` (raison sociale) et de `store_name` (nom
-- du magasin / "nom alternatif" côté import Dolibarr, migration 014 — usage
-- documenté différent : mapping d'import en masse uniquement, jamais
-- recherché nulle part dans l'application actuellement). `nom_commercial`
-- est un troisième champ, à vocation propre : recherche client par nom
-- d'usage/enseigne commerciale, indépendamment de la raison sociale légale.
-- Reste vide sur toutes les fiches existantes — aucune valeur devinée ni
-- copiée depuis `name` ou `store_name`, à compléter manuellement ensuite.
ALTER TABLE accounts ADD COLUMN nom_commercial TEXT;

COMMENT ON COLUMN accounts.nom_commercial IS
  'Nom commercial / nom d''usage du client, distinct de la raison sociale '
  '(name) et du nom de magasin import Dolibarr (store_name) — utilisé '
  'notamment par la recherche client. Optionnel, jamais déduit automatiquement.';
