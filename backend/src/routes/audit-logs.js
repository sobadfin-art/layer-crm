// GET /api/audit-logs — historique des modifications (Lot 6).
//
// Réservé au directeur (vision globale de tout ce qui se passe dans le CRM —
// aucun autre rôle n'a besoin de consulter l'historique complet d'actions
// faites par d'autres utilisateurs). La table audit_logs existe depuis la
// migration 001 ; ce fichier n'ajoute qu'un point de lecture, avec filtres,
// au-dessus de ce qui existait déjà en écriture (cf. lib/audit.js et les
// appels disséminés dans routes/orders.js, dolibarr.js, accounts.js,
// objectives.js, business-rules.js, products.js, sav.js).
import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamelList } from "../lib/serialize.js";

export const auditLogsRouter = Router();

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

auditLogsRouter.get("/", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const f = parsed.data;

  const clauses = [];
  const params = [];
  let i = 1;

  if (f.entity) {
    clauses.push(`al.entity = $${i++}`);
    params.push(f.entity);
  }
  if (f.entityId) {
    clauses.push(`al.entity_id = $${i++}`);
    params.push(f.entityId);
  }
  if (f.action) {
    clauses.push(`al.action = $${i++}`);
    params.push(f.action);
  }
  if (f.userId) {
    clauses.push(`al.user_id = $${i++}`);
    params.push(f.userId);
  }
  if (f.dateFrom) {
    clauses.push(`al.created_at >= $${i++}`);
    params.push(f.dateFrom);
  }
  if (f.dateTo) {
    clauses.push(`al.created_at <= $${i++}`);
    params.push(f.dateTo);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM audit_logs al ${where}`,
    params
  );

  params.push(f.limit);
  params.push(f.offset);

  const { rows } = await query(
    `SELECT al.*, u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  res.json({ total: countRows[0].total, limit: f.limit, offset: f.offset, items: toCamelList(rows) });
});

// Liste des valeurs distinctes déjà vues, pour peupler des filtres côté front
// sans deviner une liste figée d'actions/entités à l'avance.
auditLogsRouter.get("/facets", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const { rows: actions } = await query(
    "SELECT DISTINCT action FROM audit_logs ORDER BY action"
  );
  const { rows: entities } = await query(
    "SELECT DISTINCT entity FROM audit_logs ORDER BY entity"
  );
  res.json({
    actions: actions.map((r) => r.action),
    entities: entities.map((r) => r.entity),
  });
});
