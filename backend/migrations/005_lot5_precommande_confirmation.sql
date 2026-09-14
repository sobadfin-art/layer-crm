-- Ajustements Lot 5 demandés après revue : logique hybride de bascule
-- précommande -> CA ferme (jamais automatique, toujours une confirmation
-- humaine du front desk une fois la marchandise réellement partie).

ALTER TABLE orders ADD COLUMN converted_to_firm BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.converted_to_firm IS
  'Uniquement pertinent quand is_precommande = TRUE. Passe à TRUE via '
  'PATCH /api/orders/:id/confirm-delivery (front desk/directeur), jamais '
  'automatiquement par la seule échéance de desired_delivery_date.';
