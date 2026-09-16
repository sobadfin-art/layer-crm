-- Correctif 2026-09-16 (fiche corrective "CORRECTIFS PRIORITAIRES —
-- VISUALISATION DES COMMANDES + EXPORT DOLIBARR", section 6 : "Conserver au
-- minimum : statut exporté ; date d'export ; idéalement utilisateur ayant
-- effectué l'export ; fichier généré ou capacité de le régénérer strictement
-- à l'identique.").
--
-- `orders.status`/`exported_at` existent déjà (migration 001). Il ne manquait
-- que l'utilisateur ayant réalisé l'export, pour la traçabilité demandée.
-- Nullable : les commandes déjà exportées avant ce correctif n'ont pas cette
-- information rétroactivement (pas de valeur à deviner, jamais).
ALTER TABLE orders ADD COLUMN exported_by UUID REFERENCES users(id);

COMMENT ON COLUMN orders.exported_by IS
  'Utilisateur (front desk/directeur) ayant déclenché l''export Dolibarr — '
  'renseigné uniquement à partir de ce correctif, NULL pour les exports antérieurs.';
