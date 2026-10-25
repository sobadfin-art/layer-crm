-- Retour arrière de backend/migrations/026_suisse_chf.sql.
-- NE PAS placer dans backend/migrations/ (le runner l'appliquerait).
--
-- Prérequis : redéployer d'abord la version du code ANTÉRIEURE au point 7
-- (elle n'utilise aucune de ces deux colonnes), puis exécuter ce script.
-- Effet : supprime uniquement les deux colonnes ajoutées par 026. Perte
-- assumée : la devise des objectifs CHF créés entre-temps et l'indicateur
-- "port à définir" des commandes suisses passées entre-temps (à relever
-- avant si besoin : SELECT id, currency FROM objectives WHERE currency <> 'EUR';
-- SELECT id FROM orders WHERE shipping_to_define).
-- orders.currency n'est PAS touchée (elle préexistait à 026).
BEGIN;
ALTER TABLE objectives DROP COLUMN IF EXISTS currency;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_to_define;
DELETE FROM schema_migrations WHERE name = '026_suisse_chf.sql';
COMMIT;
