-- Ajustements demandés après revue (retour client détaillé, 6 points) :
--   1. Objectifs : période (déjà period_start/period_end, non générique — rien à
--      changer ici niveau schéma, cf. validation applicative dans objectives.js).
--   2. Master Rep ne peut pas réaffecter un compte — déjà appliqué (scope.js),
--      passé de hypothèse à règle définitive (commentaire uniquement).
--   3. Statut client Actif -> Inactif -> Archivé, jamais de suppression.
--   4. Suppression complète de la remise Combo.
--   5. Configuration Dolibarr simplifiée (fichier uniquement, pas de TVA, pas de
--      fk_user, entrepôt par défaut connu, conditions/mode de paiement avec de
--      vraies valeurs par défaut).
--   6. Correspondance produit CRM <-> Dolibarr (code produit dédié).

-- ---------------------------------------------------------------------------
-- 3. Statut du compte client (Actif / Inactif / Archivé)
-- ---------------------------------------------------------------------------
CREATE TYPE account_status AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE');

ALTER TABLE accounts ADD COLUMN status account_status NOT NULL DEFAULT 'ACTIF';
ALTER TABLE accounts ADD COLUMN archived_at TIMESTAMPTZ;

COMMENT ON COLUMN accounts.status IS
  'Cycle de vie confirmé : ACTIF -> INACTIF -> ARCHIVE. Jamais de suppression de '
  'compte ni de son historique (interactions, commandes, SAV) — voir '
  'PATCH /api/accounts/:id/status.';

-- ---------------------------------------------------------------------------
-- 4. Suppression complète de la remise Combo (recréation propre de l'enum, pas
--    seulement un blocage applicatif) — plus aucune règle Combo possible.
-- ---------------------------------------------------------------------------
DELETE FROM business_rules WHERE type = 'REMISE_COMBO';

ALTER TYPE business_rule_type RENAME TO business_rule_type_old;
CREATE TYPE business_rule_type AS ENUM (
  'REMISE_CATEGORIE', 'FRAIS_DE_PORT', 'CONDITIONS_PAIEMENT', 'TAXE', 'EXPORT_DOLIBARR'
);
ALTER TABLE business_rules ALTER COLUMN type TYPE business_rule_type USING type::text::business_rule_type;
DROP TYPE business_rule_type_old;

-- ---------------------------------------------------------------------------
-- 5. Configuration Dolibarr — version confirmée 23.0.3, intégration par fichier
--    uniquement (pas d'API), pas de gestion de TVA, entrepôt et conditions de
--    règlement avec de vraies valeurs par défaut désormais connues.
-- ---------------------------------------------------------------------------
ALTER TABLE dolibarr_settings DROP COLUMN default_vat_rate_id;

ALTER TABLE dolibarr_settings ADD COLUMN dolibarr_version TEXT NOT NULL DEFAULT '23.0.3';
ALTER TABLE dolibarr_settings ADD COLUMN payment_term_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE dolibarr_settings ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'PRELEVEMENT_SEPA'
  CHECK (payment_mode IN ('PRELEVEMENT_SEPA', 'LCR'));

ALTER TABLE dolibarr_settings ALTER COLUMN default_warehouse_id SET DEFAULT 'Entrepôt principal';
UPDATE dolibarr_settings SET default_warehouse_id = 'Entrepôt principal'
  WHERE id = 'default' AND default_warehouse_id IS NULL;

COMMENT ON COLUMN dolibarr_settings.payment_term_days IS
  'Confirmé : 30 jours par défaut. Modifiable uniquement par front desk/directeur.';
COMMENT ON COLUMN dolibarr_settings.payment_mode IS
  'Confirmé : seuls PRELEVEMENT_SEPA (Prélèvement SEPA) et LCR sont proposés.';
COMMENT ON COLUMN dolibarr_settings.default_payment_term_id IS
  'Optionnel/avancé : ID interne Dolibarr du mode de règlement, si un jour '
  'communiqué. Ne bloque plus rien — payment_term_days porte la vraie valeur '
  'métier connue (30 jours).';
COMMENT ON COLUMN dolibarr_settings.default_payment_mode_id IS
  'Optionnel/avancé : ID interne Dolibarr de la condition de règlement, si un '
  'jour communiqué. Ne bloque plus rien — payment_mode porte la vraie valeur '
  'métier connue (SEPA/LCR).';

-- fk_user des représentants explicitement écarté du périmètre (intégration par
-- fichier, pas par API Dolibarr) — supprimé plutôt que laissé orphelin.
ALTER TABLE users DROP COLUMN dolibarr_user_id;

-- ---------------------------------------------------------------------------
-- 6. Correspondance produit CRM <-> Dolibarr
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN dolibarr_ref TEXT;
COMMENT ON COLUMN products.dolibarr_ref IS
  'Code Dolibarr optionnel, utilisé pour le fichier d''export uniquement si la '
  'référence produit existante (ref) ne suffit pas à la correspondance.';
