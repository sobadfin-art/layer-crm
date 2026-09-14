-- Import en masse des fiches client depuis Dolibarr — cf.
-- docs/cahier-des-charges-import-fiches-client.md.
--
-- 1. Nom du magasin ("Nom alternatif" dans l'export Dolibarr, distinct du nom
--    de l'enseigne — ex. Nom = "Pierre LE GALL", Nom alternatif = "LAYER
--    AGENCY"). Aucun champ équivalent n'existait avant ce document.
ALTER TABLE accounts ADD COLUMN store_name TEXT;

COMMENT ON COLUMN accounts.store_name IS
  'Nom du magasin ("Nom alternatif" dans l''export Dolibarr), distinct du nom '
  'de l''enseigne (accounts.name). Alimenté par l''import fiches client, '
  'modifiable ensuite sur la fiche.';

-- 2. Journal des imports fiches client, sur le modèle de catalog_import_logs
--    (cf. 001_init.sql) — un import ne rattache pas les comptes à un
--    "catalogue" comme pour les produits, donc pas de colonne équivalente à
--    catalog_id ici.
CREATE TABLE account_import_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_count  INTEGER NOT NULL,
  updated_count  INTEGER NOT NULL,
  error_count    INTEGER NOT NULL,
  imported_by_id UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE account_import_logs IS
  'Historique des imports en masse de fiches client (Administrateur), cf. '
  'docs/cahier-des-charges-import-fiches-client.md section 9.';
