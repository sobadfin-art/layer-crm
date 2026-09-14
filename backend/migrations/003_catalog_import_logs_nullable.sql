-- La suppression d'un catalogue (section 11 cahier des charges import) ne doit
-- jamais faire perdre l'historique des imports déjà réalisés dessus : on relâche
-- la contrainte pour que catalog_id passe à NULL plutôt que de bloquer/supprimer
-- la ligne d'audit.
ALTER TABLE catalog_import_logs ALTER COLUMN catalog_id DROP NOT NULL;
ALTER TABLE catalog_import_logs DROP CONSTRAINT catalog_import_logs_catalog_id_fkey;
ALTER TABLE catalog_import_logs
  ADD CONSTRAINT catalog_import_logs_catalog_id_fkey
  FOREIGN KEY (catalog_id) REFERENCES catalogs(id) ON DELETE SET NULL;
