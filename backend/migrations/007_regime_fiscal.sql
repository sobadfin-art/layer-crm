-- Régime fiscal de la fiche client — indépendant de la typologie commerciale
-- (Opticien, Surf Shop... reste un champ marketing distinct, aucun lien entre
-- les deux). Base pour le calcul de TVA à l'export Dolibarr ; à valider par
-- l'expert-comptable du client avant mise en production — tout reste
-- configurable (taux en base, pas en dur dans le code).

CREATE TYPE regime_fiscal AS ENUM (
  'FRANCE_STANDARD',        -- TVA française normale (défaut pour la France)
  'INTRACOMMUNAUTAIRE_HT',  -- UE hors France, facturé HT par défaut
  'RECARGO_EQUIVALENCIA',   -- Espagne, régime spécifique — jamais automatique
  'EXPORT_HORS_UE_HT'       -- Suisse, Royaume-Uni — export, facturé HT
);

ALTER TABLE accounts ADD COLUMN regime_fiscal regime_fiscal NOT NULL DEFAULT 'FRANCE_STANDARD';

COMMENT ON COLUMN accounts.regime_fiscal IS
  'Défaut dérivé du pays à la création (voir lib/taxRegime.js), toujours '
  'modifiable manuellement cas par cas. RECARGO_EQUIVALENCIA ne se sélectionne '
  'jamais automatiquement. Base non définitive pour le calcul de TVA export '
  'Dolibarr — à valider par l''expert-comptable.';

-- Backfill des comptes existants selon leur pays (même règle que
-- lib/taxRegime.js — à garder synchronisée si la règle évolue).
UPDATE accounts a SET regime_fiscal = 'INTRACOMMUNAUTAIRE_HT'
  FROM countries c WHERE c.id = a.country_id AND c.code IN ('ES','DE','IT','PT','BE','NL');
UPDATE accounts a SET regime_fiscal = 'EXPORT_HORS_UE_HT'
  FROM countries c WHERE c.id = a.country_id AND c.code IN ('CH','GB');
-- FR (et tout pays non listé, cas non prévu par les 9 pays seedés) reste sur le
-- défaut FRANCE_STANDARD déjà posé par la colonne.

-- ---------------------------------------------------------------------------
-- Taux de TVA configurables pour l'export Dolibarr, dérivés du regime_fiscal
-- (pas du pays seul, pas de la typologie). Les régimes HT sont toujours à 0%,
-- calculé en code (pas besoin de colonne) ; seuls FRANCE_STANDARD et
-- RECARGO_EQUIVALENCIA ont un taux réel à configurer.
-- ---------------------------------------------------------------------------
ALTER TABLE dolibarr_settings ADD COLUMN vat_rate_france_standard NUMERIC(5,2) NOT NULL DEFAULT 20.00;
ALTER TABLE dolibarr_settings ADD COLUMN vat_rate_recargo_equivalencia NUMERIC(5,2); -- NULL = non configuré, jamais deviné

COMMENT ON COLUMN dolibarr_settings.vat_rate_france_standard IS
  'Taux de TVA appliqué aux comptes en régime FRANCE_STANDARD. 20% par défaut, '
  'modifiable par front desk/directeur — à confirmer avec l''expert-comptable.';
COMMENT ON COLUMN dolibarr_settings.vat_rate_recargo_equivalencia IS
  'Taux de TVA pour le régime RECARGO_EQUIVALENCIA (Espagne). Volontairement '
  'NULL par défaut — jamais deviné. La check-list export avertit (sans '
  'bloquer) tant qu''il n''est pas configuré.';
