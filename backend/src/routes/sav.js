import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { canAccessAccount } from "../lib/scope.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";
import { notifyUsers, userIdsWithRoles } from "../lib/notifications.js";

export const savRouter = Router();

// Le front desk "gère le SAV" (section 3) ; le directeur a un accès direct à la
// vue front desk. Représentant/Master Rep peuvent voir et commenter le SAV de
// leurs propres comptes (hypothèse raisonnable, non détaillée dans le handoff),
// mais seuls front desk/directeur changent le statut ou l'assignation.
const SAV_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR];
const SAV_MANAGE_ROLES = [ROLES.FRONT_DESK, ROLES.DIRECTEUR];

async function loadAccountOr404(accountId, res) {
  const { rows } = await query("SELECT * FROM accounts WHERE id = $1", [accountId]);
  if (!rows[0]) {
    res.status(404).json({ error: "Compte introuvable." });
    return null;
  }
  return rows[0];
}

async function loadTicketOr404(ticketId, res) {
  const { rows } = await query("SELECT * FROM sav_tickets WHERE id = $1", [ticketId]);
  if (!rows[0]) {
    res.status(404).json({ error: "Ticket introuvable." });
    return null;
  }
  return rows[0];
}

savRouter.get("/", requireAuth, requireRole(...SAV_ROLES), async (req, res) => {
  const clauses = [];
  const params = [];
  let i = 1;

  if (req.query.status) {
    clauses.push(`t.status = $${i++}`);
    params.push(req.query.status);
  }
  if (req.query.accountId) {
    clauses.push(`t.account_id = $${i++}`);
    params.push(req.query.accountId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT t.*, a.name AS account_name, a.owner_rep_id, a.master_rep_id
     FROM sav_tickets t JOIN accounts a ON a.id = t.account_id
     ${where} ORDER BY t.created_at DESC`,
    params
  );

  const visible =
    req.user.role === ROLES.FRONT_DESK || req.user.role === ROLES.DIRECTEUR
      ? rows
      : rows.filter((r) => canAccessAccount(req.user, { owner_rep_id: r.owner_rep_id, master_rep_id: r.master_rep_id }));

  res.json(toCamelList(visible));
});

savRouter.get("/:id", requireAuth, requireRole(...SAV_ROLES), async (req, res) => {
  const ticket = await loadTicketOr404(req.params.id, res);
  if (!ticket) return;
  const account = await loadAccountOr404(ticket.account_id, res);
  if (!account) return;
  if (!canAccessAccount(req.user, account)) {
    return res.status(403).json({ error: "Accès refusé à ce compte." });
  }

  const { rows: notes } = await query(
    `SELECT n.*, u.first_name, u.last_name FROM sav_notes n
     JOIN users u ON u.id = n.author_id WHERE n.ticket_id = $1 ORDER BY n.created_at ASC`,
    [req.params.id]
  );

  res.json({ ...toCamel(ticket), notes: toCamelList(notes) });
});

const createSchema = z.object({
  accountId: z.string().uuid(),
  orderId: z.string().uuid().optional().nullable(),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
});

savRouter.post("/", requireAuth, requireRole(...SAV_ROLES), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await loadAccountOr404(parsed.data.accountId, res);
  if (!account) return;
  if (!canAccessAccount(req.user, account)) {
    return res.status(403).json({ error: "Accès refusé à ce compte." });
  }

  const { rows } = await query(
    `INSERT INTO sav_tickets (account_id, order_id, subject, description, created_by_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [parsed.data.accountId, parsed.data.orderId ?? null, parsed.data.subject, parsed.data.description ?? null, req.user.id]
  );

  await logAudit({
    userId: req.user.id,
    action: "SAV_TICKET_CREATED",
    entity: "sav_tickets",
    entityId: rows[0].id,
    details: { accountId: parsed.data.accountId, subject: parsed.data.subject },
  });

  const recipients = await userIdsWithRoles([ROLES.FRONT_DESK, ROLES.DIRECTEUR]);
  await notifyUsers(recipients, {
    type: "SAV_TICKET_CREATED",
    title: "Nouveau ticket SAV",
    body: parsed.data.subject,
    entity: "sav_tickets",
    entityId: rows[0].id,
  });

  res.status(201).json(toCamel(rows[0]));
});

const updateSchema = z.object({
  status: z.enum(["OUVERT", "EN_COURS", "RESOLU", "FERME"]).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
});

// Statut/assignation réservés à front desk/directeur — un représentant peut
// signaler et commenter un cas, pas le clore lui-même.
savRouter.patch("/:id", requireAuth, requireRole(...SAV_MANAGE_ROLES), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Corps invalide." });

  const ticket = await loadTicketOr404(req.params.id, res);
  if (!ticket) return;

  const columnFor = { assignedToId: "assigned_to_id" };
  const sets = [];
  const params = [];
  let i = 1;
  for (const [field, value] of Object.entries(parsed.data)) {
    sets.push(`${columnFor[field] || field} = $${i++}`);
    params.push(value);
  }
  if (parsed.data.status === "RESOLU" || parsed.data.status === "FERME") {
    sets.push(`resolved_at = now()`);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  sets.push("updated_at = now()");
  params.push(req.params.id);

  const { rows } = await query(
    `UPDATE sav_tickets SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );

  await logAudit({
    userId: req.user.id,
    action: "SAV_TICKET_UPDATED",
    entity: "sav_tickets",
    entityId: req.params.id,
    details: { fields: Object.keys(parsed.data), fromStatus: ticket.status, toStatus: parsed.data.status ?? ticket.status },
  });

  res.json(toCamel(rows[0]));
});

savRouter.post("/:id/notes", requireAuth, requireRole(...SAV_ROLES), async (req, res) => {
  const schema = z.object({ note: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Note requise." });

  const ticket = await loadTicketOr404(req.params.id, res);
  if (!ticket) return;
  const account = await loadAccountOr404(ticket.account_id, res);
  if (!account) return;
  if (!canAccessAccount(req.user, account)) {
    return res.status(403).json({ error: "Accès refusé à ce compte." });
  }

  const { rows } = await query(
    `INSERT INTO sav_notes (ticket_id, author_id, note) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, req.user.id, parsed.data.note]
  );
  res.status(201).json(toCamel(rows[0]));
});
