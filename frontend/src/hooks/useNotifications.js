// Notifications temps réel côté client (Lot 6) : websocket en priorité
// (poussée immédiate), avec repli sur un chargement REST au montage et une
// reconnexion automatique si la connexion tombe — jamais de notification
// perdue puisque tout est aussi persisté en base côté backend
// (GET /api/notifications reste la source de vérité, le websocket n'est
// qu'un raccourci pour ne pas avoir à rafraîchir la page).
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api.js";

export function useNotifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/notifications?limit=30");
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Silencieux : l'absence de notifications ne doit jamais bloquer le
      // reste de l'app (cf. philosophie générale des notifications non
      // bloquantes côté backend, lib/notifications.js).
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Ce hook n'est monté que dans l'app authentifiée (App.jsx affiche
    // <Login/> tant qu'il n'y a pas d'utilisateur), donc pas besoin de vérifier
    // un token ici. La connexion websocket s'authentifie via le cookie httpOnly
    // "token", envoyé automatiquement par le navigateur sur la requête
    // d'upgrade (ce n'est pas du JS qui le pose, donc httpOnly ne bloque pas
    // cet envoi) — cf. migration "cookie only" du chantier durcissement auth.
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.kind === "notification") {
            setItems((list) => [{ ...msg.notification, readAt: null }, ...list].slice(0, 30));
            setUnread((n) => n + 1);
          }
        } catch {
          // Message non JSON ou inattendu — ignoré sans casser la connexion.
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // Reconnexion automatique — délai fixe simple, suffisant pour un
        // outil interne (pas besoin de backoff exponentiel sophistiqué ici).
        reconnectTimer.current = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  async function markRead(id) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((n) => Math.max(0, n - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Optimiste : si l'appel échoue, le prochain load() recalera l'état.
    }
  }

  async function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnread(0);
    try {
      await api.post("/notifications/read-all");
    } catch {
      // idem
    }
  }

  return { items, unread, markRead, markAllRead, reload: load };
}
