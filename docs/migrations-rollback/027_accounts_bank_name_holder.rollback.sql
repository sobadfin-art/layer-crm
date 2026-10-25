-- Retour arrière de backend/migrations/027_accounts_bank_name_holder.sql.
-- NE PAS placer dans backend/migrations/ (le runner l'appliquerait).
--
-- Prérequis : redéployer d'abord la version du code ANTÉRIEURE au point 1
-- (elle n'utilise pas ces colonnes), puis exécuter ce script.
-- Effet : supprime uniquement les deux colonnes ajoutées par 027. Perte
-- assumée : les noms d'agence et titulaires saisis entre-temps (à relever
-- avant si besoin, en clair, via l'application, par un rôle autorisé).
-- IBAN et BIC ne sont PAS touchés (colonnes préexistantes).
BEGIN;
ALTER TABLE accounts DROP COLUMN IF EXISTS bank_name;
ALTER TABLE accounts DROP COLUMN IF EXISTS account_holder;
DELETE FROM schema_migrations WHERE name = '027_accounts_bank_name_holder.sql';
COMMIT;
