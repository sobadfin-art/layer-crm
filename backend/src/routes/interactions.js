import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { canAccessAccount } from "../lib/scope.js";
import { INTERACTION_TYPES } from "../lib/interactionTypes.js";
import { toCamel, toCamelList } from "../lib/serialize.js";

export const interactionsRouter = Router({ mergeParams: true });

const ACCOUNTS_MODULE_ROLES = [
  ROLES.REPRESENTANT,
  ROLES.MASTER_REP,
  ROLES.FRONT_DESK,
  ROLES.DIRECTEUR,
  ROLES.ADMINISTRATEUR,
];

async function loadAccountOr404(accountId, res) {
  const { rows } = await query("SELECT * FROM accounts WHERE id = $1", [accountId]);
  if (!rows[0]) {
    res.status(404).json({ error: "Compte introuvable." });
    return null;
  }
  return rows[0];
}

// GET /api/accounts/:accountId/interactions
interactionsRouter.get(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!canAccessAccount(req.user, account)) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }
    const { rows } = await query(
      `SELECT i.*, u.first_name, u.last_name
       FROM interactions i
       JOIN users u ON u.id = i.author_id
       WHERE i.account_id = $1
       ORDER BY i.created_at DESC`,
      [req.params.accountId]
    );
    res.json(toCamelList(rows));
  }
);

// POST /api/accounts/:accountId/interactions
interactionsRouter.post(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!canAccessAccount(req.user, account)) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }

    const schema = z.object({
      note: z.string().min(1),
      viaVoice: z.boolean().optional(),
      // Type d'interaction (référentiel fusionné, cf. lib/interactionTypes.js)
      // — optionnel : les intégrations existantes (ex. traces automatiques de
      // planification/compte rendu RDV créées par routes/tasks.js) continuent
      // de fonctionner sans type précisé.
      type: z.enum(INTERACTION_TYPES).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Note d'interaction invalide." });
    }

    const { rows } = await query(
      `INSERT INTO interactions (account_id, author_id, note, via_voice, type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.accountId, req.user.id, parsed.data.note, parsed.data.viaVoice ?? false, parsed.data.type ?? null]
    );
    res.status(201).json(toCamel(rows[0]));
  }
);
