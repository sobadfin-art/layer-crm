import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// Compteur "commandes à traiter" pour le badge de l'onglet Commandes du Front
// Desk et du Directeur — même principe que useAgendaSummary.js pour l'agenda
// : un seul endroit qui sait ce qui compte comme "à traiter" (statut
// ENVOYEE_FRONT_DESK, cf. routes/orders.js), pour ne pas faire diverger cette
// règle entre plusieurs écrans. `enabled` permet d'appeler ce hook
// inconditionnellement (règle des hooks React) tout en désactivant la requête
// pour les rôles qui n'ont pas accès à GET /api/orders (403 sinon).
export function useOrdersActionSummary({ enabled = true } = {}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/orders?status=ENVOYEE_FRONT_DESK");
      setCount(Array.isArray(data) ? data.length : 0);
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

  return { badgeCount: count, loading, error, reload: load };
}
