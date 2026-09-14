// Notifications temps réel (Lot 6).
//
// Deux volets, volontairement découplés :
//   1. Persistance en base (table `notifications`, migration 008) — toujours
//      écrite en premier, pour que la notification existe même si personne
//      n'est connecté en websocket au moment de l'événement (mode
//      "polling de secours" via GET /api/notifications).
//   2. Poussée temps réel via websocket, si l'utilisateur a un socket ouvert
//      au moment de l'appel. Sinon, il verra la notification à sa prochaine
//      connexion / son prochain GET /api/notifications — jamais perdue.
//
// Le registre de sockets (userId -> Set<WebSocket>) vit en mémoire du process
// Node ; un utilisateur peut avoir plusieurs onglets ouverts, donc plusieurs
// sockets simultanées pour le même userId.
import { query } from "./db.js";

const socketsByUser = new Map();

export function registerSocket(userId, ws) {
  if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
  socketsByUser.get(userId).add(ws);
}

export function unregisterSocket(userId, ws) {
  const set = socketsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) socketsByUser.delete(userId);
}

function pushToUser(userId, payload) {
  const set = socketsByUser.get(userId);
  if (!set || set.size === 0) return;
  const message = JSON.stringify(payload);
  for (const ws of set) {
    // readyState 1 = OPEN (cf. doc du package "ws")
    if (ws.readyState === 1) ws.send(message);
  }
}

// Crée une notification pour un utilisateur précis : écrit en base puis
// pousse en temps réel si un socket est ouvert. Ne jette jamais (comme
// lib/audit.js) : une notification manquée ne doit jamais casser l'action
// métier qui la déclenche.
export async function notifyUser({ userId, type, title, body, entity, entityId }) {
  try {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, title, body, entity, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, type, title, body ?? null, entity ?? null, entityId ? String(entityId) : null]
    );
    const notif = rows[0];
    pushToUser(userId, {
      kind: "notification",
      notification: {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        entity: notif.entity,
        entityId: notif.entity_id,
        createdAt: notif.created_at,
      },
    });
    return notif;
  } catch (err) {
    console.error("Échec de création de notification (non bloquant) :", err.message);
    return null;
  }
}

// Notifie plusieurs utilisateurs du même événement (ex: tous les front desk +
// le directeur) — une ligne par destinataire, jamais un envoi "broadcast" sans
// destinataire nommé.
export async function notifyUsers(userIds, payload) {
  await Promise.all(userIds.map((userId) => notifyUser({ ...payload, userId })));
}

export function connectedUserCount() {
  return socketsByUser.size;
}

// Petit utilitaire pour notifier "tous les utilisateurs ayant ce rôle" (ex :
// front desk + directeur) sans avoir à réécrire la requête à chaque appel.
export async function userIdsWithRoles(roles) {
  const { rows } = await query("SELECT id FROM users WHERE role::text = ANY($1::text[])", [roles]);
  return rows.map((r) => r.id);
}
