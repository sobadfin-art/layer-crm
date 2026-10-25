-- Point 7 (2026-10-25) — Prix Suisse en CHF. Migration STRICTEMENT ADDITIVE.
--
-- Ce qui n'a PAS besoin de migration : orders.currency existe déjà depuis
-- 001_init.sql (TEXT NOT NULL DEFAULT 'EUR') et vaut 'EUR' sur toutes les
-- commandes existantes (le code ne l'a jamais renseignée autrement) — c'est
-- leur réalité, rien à réécrire. Le code renseigne désormais 'CHF' pour les
-- nouvelles commandes d'un client suisse (cf. lib/currency.js).
--
-- 1. Objectifs en CHF à part (décision client) : devise de l'objectif. Les
--    objectifs existants prennent la valeur par défaut 'EUR' — leur réalité,
--    aucune autre colonne n'est lue ni réécrite. Un objectif ne compte que les
--    commandes de SA devise (lib/objectiveProgress.js).
ALTER TABLE objectives ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'
  CHECK (currency IN ('EUR', 'CHF'));

-- 2. Frais de port "à définir" : une commande suisse passée tant qu'aucune
--    règle de frais de port "Pays : Suisse" n'existe n'a pas de montant de
--    port connu — on n'invente rien (jamais les 9,60 € par défaut renommés en
--    CHF). FALSE sur toutes les commandes existantes : leur port est connu.
ALTER TABLE orders ADD COLUMN shipping_to_define BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN objectives.currency IS
  'Devise de l''objectif (EUR ou CHF). Un objectif ne compte que les commandes de la même devise — jamais de mélange EUR/CHF (point 7, 2026-10-25).';
COMMENT ON COLUMN orders.shipping_to_define IS
  'TRUE = frais de port non définis à la commande (client suisse sans règle de frais de port Suisse configurée) ; shipping_fee_ht vaut alors 0 et ne doit pas être lu comme un montant réel.';
