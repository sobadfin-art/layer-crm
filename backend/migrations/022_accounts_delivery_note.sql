-- Correctif 2026-09-18 (fiche "UPDATE CRM — CORRECTIONS À IMPLÉMENTER",
-- évolution 1 : "Note / instructions de livraison sous l'adresse de
-- livraison du client, en création et en consultation/modification.").
--
-- Champ dédié, distinct de tout champ existant (aucun champ générique
-- réutilisé), pour que le commercial consigne les informations propres à
-- la livraison (horaires d'ouverture, jours de fermeture, congés, accès,
-- consignes chauffeur, etc.). Jamais obligatoire : nullable, sans défaut.
ALTER TABLE accounts ADD COLUMN delivery_note TEXT;

COMMENT ON COLUMN accounts.delivery_note IS
  'Note / instructions de livraison libres (horaires, accès, consignes '
  'chauffeur...) — optionnelle, saisie et modifiable par le commercial.';
