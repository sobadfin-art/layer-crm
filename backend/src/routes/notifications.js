// Notifications de l'utilisateur connecté (Lot 6) — mode "poll" en secours du
// websocket (cf. lib/notifications.js et le serveur ws monté dans server.js) :
// utile au chargement initial de l'app, ou si le websocket n'a pas pu se
// connecter (réseau restrictif, etc.).
import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { toCamelList, toCamel } from "../lib/serialize.js";

export const notificationsRouter = Router();

const listSchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { unreadOnly, limit } = parsed.data;

  const clauses = ["user_id = $1"];
  const params = [req.user.id];
  if (unreadOnly) clauses.push("read_at IS NULL");

  params.push(limit);
  const { rows } = await query(
    `SELECT * FROM notifications WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );

  const { rows: countRows } = await query(
    "SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [req.user.id]
  );

  res.json({ unread: countRows[0].unread, items: toCamelList(rows) });
});

notificationsRouter.patch("/:id/read", requireAuth, async (req, res) => {
  const { rows } = await query(
    `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) {
    // Soit déjà lue, soit inexistante/pas la sienne — on ne distingue pas les
    // deux côté réponse pour ne pas révéler l'existence de notifs d'autrui.
    const { rows: existing } = await query(
      "SELECT * FROM notifications WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return res.status(404).json({ error: "Notification introuvable." });
    return res.json(toCamel(existing[0]));
  }
  res.json(toCamel(rows[0]));
});

notificationsRouter.post("/read-all", requireAuth, async (req, res) => {
  await query(
    "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
    [req.user.id]
  );
  res.json({ ok: true });
});
