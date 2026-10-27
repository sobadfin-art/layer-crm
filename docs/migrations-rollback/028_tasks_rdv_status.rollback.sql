-- Retour arrière de backend/migrations/028_tasks_rdv_status.sql.
-- NE PAS placer dans backend/migrations/ (le runner l'appliquerait).
--
-- Prérequis : redéployer d'abord la version du code ANTÉRIEURE à cette
-- fonctionnalité (elle n'utilise pas ces colonnes), puis exécuter ce script.
-- ATTENTION : après ce retour arrière, les RDV annulés entre-temps
-- redeviendraient visibles comme des RDV normaux (le statut disparaît). Les
-- relever avant si besoin :
--   SELECT id, title, due_date, cancelled_at FROM tasks WHERE status = 'ANNULE';
-- Leur annulation reste de toute façon tracée dans l'historique des fiches
-- client (interactions) et dans audit_logs, qui ne sont pas touchés.
BEGIN;
ALTER TABLE tasks DROP COLUMN IF EXISTS cancelled_by_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS status;
DELETE FROM schema_migrations WHERE name = '028_tasks_rdv_status.sql';
COMMIT;
