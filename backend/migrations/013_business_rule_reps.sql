-- 013 — Remise catégorie : sélection multiple de représentants concernés.
--
-- Demande explicite du client : "le plus simple est d'avoir une sélection
-- lors de la création de la règle (remise) avec une sélection multiple des
-- représentants concernés. Ils auront par la suite le bouton de remise
-- catégorie correspondant qui s'affichera en haut de la catégorie sur le
-- récap de commande. Ce sera à eux de l'activer ou non en fonction de la
-- commande." Jusqu'ici, business_rules.rep_id ne permettait de cibler qu'UN
-- seul représentant par règle (scope REPRESENTANT) — on remplace ça par une
-- table de jonction many-to-many, pour qu'une même règle REMISE_CATEGORIE
-- s'applique à plusieurs représentants à la fois.

CREATE TABLE business_rule_reps (
  business_rule_id UUID NOT NULL REFERENCES business_rules(id) ON DELETE CASCADE,
  rep_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (business_rule_id, rep_id)
);

-- Reprise des règles existantes qui ciblaient déjà un représentant via
-- l'ancienne colonne unique : on les fait apparaître dans la nouvelle table
-- de jonction pour ne rien casser en production, plutôt que de perdre
-- silencieusement leur ciblage.
INSERT INTO business_rule_reps (business_rule_id, rep_id)
SELECT id, rep_id FROM business_rules WHERE rep_id IS NOT NULL;

-- La colonne rep_id reste en base (jamais de suppression de donnée
-- existante, cf. conventions du projet) mais n'est plus écrite ni lue par le
-- code applicatif à partir de cette migration : tout le ciblage
-- représentant passe désormais par business_rule_reps (voir
-- lib/businessRules.js, routes/business-rules.js, lib/pricing.js).
COMMENT ON COLUMN business_rules.rep_id IS
  'Obsolète depuis la migration 013 — conservée pour historique uniquement, plus lue par le code. Le ciblage représentant (scope REPRESENTANT) passe désormais par la table business_rule_reps (sélection multiple).';
