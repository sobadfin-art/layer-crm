-- Compte rendu de rendez-vous (règle définitive, plus une hypothèse) : un RDV
-- (tasks.type = 'RDV') doit permettre de saisir un compte rendu texte libre.
-- Porté directement par la table tasks plutôt qu'une table séparée : un
-- compte rendu est un attribut 1:1 du RDV, et tasks porte déjà tout ce à quoi
-- il doit être rattaché (account_id = client, assignee_id = commercial,
-- due_date = date du rendez-vous) — pas de gestion de statuts
-- Planifié/Honoré/Reporté/Annulé pour l'instant (hors périmètre, demande
-- explicite).
ALTER TABLE tasks ADD COLUMN compte_rendu TEXT;
ALTER TABLE tasks ADD COLUMN compte_rendu_at TIMESTAMPTZ;

COMMENT ON COLUMN tasks.compte_rendu IS
  'Compte rendu texte libre du rendez-vous (uniquement pertinent si type = RDV). '
  'Rattaché au RDV lui-même (cette ligne), au client (account_id), au '
  'commercial (assignee_id) et à la date du rendez-vous (due_date).';
COMMENT ON COLUMN tasks.compte_rendu_at IS
  'Horodatage de la dernière saisie/mise à jour du compte rendu (distinct de '
  'due_date, qui reste la date du rendez-vous lui-même).';
