-- Règle définitive (revue de cohérence post-durcissement auth) : une commande
-- ne compte dans un objectif qu'après validation, et la période d'objectif est
-- déterminée par la date de VALIDATION, jamais par created_at. updated_at ne
-- convient pas non plus comme substitut : d'autres actions ultérieures
-- (annulation, export Dolibarr, confirmation de livraison précommande...) le
-- modifient aussi, ce qui décalerait silencieusement une commande hors de sa
-- vraie période de validation. D'où ce champ dédié, écrit une seule fois.
ALTER TABLE orders ADD COLUMN validated_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.validated_at IS
  'Horodatage exact de la transition ENVOYEE_FRONT_DESK -> VALIDEE (PATCH '
  '/api/orders/:id/status). Ecrit une seule fois, jamais modifie par la suite '
  '(ni par une annulation, ni par un export Dolibarr, ni par la confirmation '
  'de livraison). Source de verite pour la periode dans computeObjectiveProgress '
  'et les analytics/dashboard bases sur une periode - jamais created_at ni updated_at.';

-- Retro-remplissage des commandes déjà VALIDEE/EXPORTEE_DOLIBARR créées avant
-- l'existence de cette colonne : on ne connaît pas leur date de validation
-- exacte (jamais enregistrée), donc on l'approxime au mieux avec la donnée la
-- plus proche disponible plutôt que de les faire disparaître silencieusement
-- des objectifs déjà calculés. exported_at (s'il existe) est plus proche de la
-- validation réelle que updated_at seul ; à défaut, updated_at. Ceci est un
-- rattrapage ponctuel pour les données existantes, pas une règle de calcul
-- valable pour la suite (cf. commentaire ci-dessus : jamais updated_at comme
-- substitut en continu).
UPDATE orders
SET validated_at = COALESCE(exported_at, updated_at)
WHERE status IN ('VALIDEE', 'EXPORTEE_DOLIBARR') AND validated_at IS NULL;
