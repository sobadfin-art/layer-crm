-- Modification / annulation d'un RDV (2026-10-27). Migration STRICTEMENT
-- ADDITIVE : un RDV annulé n'est jamais supprimé, il passe au statut
-- 'ANNULE' — retiré du calendrier et des indicateurs "à venir", mais
-- conservé en base (historique de la fiche client, extraction Excel, audit).
--
-- Toutes les lignes existantes (RDV et tâches) prennent la valeur par défaut
-- 'PLANIFIE' : c'est leur réalité, aucune autre colonne n'est lue ni réécrite.
-- Le statut ne concerne que les RDV (type = 'RDV') ; pour une tâche
-- générique, `done` reste l'indicateur utilisé.
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'PLANIFIE'
  CHECK (status IN ('PLANIFIE', 'ANNULE'));
ALTER TABLE tasks ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN cancelled_by_id UUID REFERENCES users(id);

COMMENT ON COLUMN tasks.status IS
  'PLANIFIE (défaut) ou ANNULE. Un RDV annulé n''est jamais supprimé : il sort du calendrier et des compteurs, reste dans l''historique et l''extraction.';
