-- Correctif Master Rep V4 ("Clients & prospects pas correctement affichés
-- pour l'équipe") : accounts.master_rep_id n'était jamais renseigné quand un
-- représentant créait lui-même son compte (cas normal, cf. POST /api/accounts
-- avant ce correctif), et n'était jamais mis à jour rétroactivement lors
-- d'une réaffectation d'équipe (PATCH /api/team/members/:userId). Le contrôle
-- d'accès (lib/scope.js) ne dépend plus de cette colonne du fond depuis ce
-- correctif — il rejoint désormais sales_reps/master_reps en direct — mais on
-- backfille quand même la colonne ici pour que les usages INFORMATIFS
-- restants (filtre "Carte & tournées" du Directeur, GET /accounts/map
-- ?masterRepId=...) restent cohérents avec l'équipe réelle actuelle.
UPDATE accounts a
SET master_rep_id = mr.user_id, updated_at = now()
FROM sales_reps sr
JOIN master_reps mr ON sr.master_rep_id = mr.id
WHERE a.owner_rep_id = sr.user_id
  AND a.master_rep_id IS DISTINCT FROM mr.user_id;

-- Comptes dont le owner_rep_id n'a plus (ou jamais eu) de Master Rep assigné :
-- on nettoie un éventuel master_rep_id orphelin/obsolète plutôt que de le
-- laisser pointer vers une affectation qui n'existe plus.
UPDATE accounts a
SET master_rep_id = NULL, updated_at = now()
WHERE a.master_rep_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales_reps sr
    JOIN master_reps mr ON sr.master_rep_id = mr.id
    WHERE sr.user_id = a.owner_rep_id AND mr.user_id = a.master_rep_id
  );
