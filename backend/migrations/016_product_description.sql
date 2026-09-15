-- Descriptif produit — champ "Identification" listé dans le PDF de cadrage
-- Administrateur (2026-09-15, section 2 "Création et modification d'une
-- référence produit") mais absent du schéma initial. Nullable, jamais
-- alimenté par l'import en masse (colonne non listée dans le cahier des
-- charges d'import catalogue) — uniquement par la création/modification
-- manuelle d'une référence (routes/products.js).
ALTER TABLE products ADD COLUMN description TEXT;
