import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// Résumé agenda partagé entre le Dashboard (listes complètes : prochains RDV,
// tâches en attente) et le badge de l'onglet "Agenda" dans la nav (juste les
// compteurs) — un seul endroit qui sait distinguer RDV à venir / tâches en
// retard, pour ne jamais faire diverger cette logique de date entre les deux
// affichages.
//
// GET /api/dashboard/rdv renvoie TOUS les RDV du périmètre du rôle (passés et
// futurs, cf. commentaire de la route) : on filtre nous-mêmes sur "à venir".
// GET /api/tasks exclut déjà les RDV passés côté serveur mais garde toutes
// les tâches génériques (TACHE) quelle que soit leur date — cf. commentaire
// de la route.
//
// `enabled` permet d'appeler ce hook inconditionnellement (règle des hooks
// React) tout en désactivant les deux requêtes pour les rôles qui n'ont pas
// accès à ces endpoints (403 sinon) ou qui n'ont simplement pas d'agenda —
// seul le Représentant l'utilise pour l'instant.
export function useAgendaSummary({ enabled = true } = {}) {
  const [rdv, setRdv] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rdvData, tasksData] = await Promise.all([api.get("/dashboard/rdv"), api.get("/tasks")]);
      setRdv(rdvData);
      setTasks(tasksData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const now = Date.now();
  const upcomingRdv = rdv
    .filter((r) => !r.dueDate || new Date(r.dueDate).getTime() >= now)
    .sort((a, b) => {
      const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return at - bt;
    });
  const pendingTasks = tasks
    .filter((t) => t.type === "TACHE" && !t.done)
    .sort((a, b) => {
      const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return at - bt;
    });
  const overdueTasks = pendingTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now);
  const badgeCount = upcomingRdv.length + overdueTasks.length;

  return { rdv, tasks, upcomingRdv, pendingTasks, overdueTasks, badgeCount, loading, error, reload: load };
}
