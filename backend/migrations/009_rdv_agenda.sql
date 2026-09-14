-- Distinction RDV / tâche générique dans l'agenda (tasks), pour pouvoir faire
-- disparaître un RDV passé de l'agenda tout en gardant sa trace définitive
-- dans l'historique d'interactions du compte client (jamais de suppression,
-- cf. philosophie générale du projet).
ALTER TABLE tasks
  ADD COLUMN type TEXT NOT NULL DEFAULT 'TACHE' CHECK (type IN ('RDV', 'TACHE'));
