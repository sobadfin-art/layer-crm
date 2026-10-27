import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { INTERACTION_TYPES } from "../lib/interactionTypes.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";
import { canAccessAccount } from "../lib/scope.js";

export const tasksRouter = Router();

// GET /api/tasks — l'agenda.
// - REPRESENTANT : ses tâches (assignee = lui)
// - MASTER_REP : ses tâches + celles de ses reps affectés, en lecture
//   (cf. section 3 : "objectifs en lecture seule, tâches, agenda" pour le Master Rep)
// - FRONT_DESK, DIRECTEUR : toutes les tâches
// - ADMINISTRATEUR : pas d'accès (hors périmètre documenté)
//
// Règle : **un RDV (type='RDV') dont la date est passée sort de l'agenda**,
// alors qu'une tâche générique (type='TACHE') y reste affichée quelle que
// soit sa date (une tâche en retard, contrairement à un rendez-vous, reste
// probablement à faire). Ça ne supprime rien : le RDV reste consultable dans
// `GET /api/tasks?includePastRdv=true` si besoin, et surtout son passage a
// été tracé dès sa création comme interaction sur la fiche du compte
// (cf. POST ci-dessous) — donc jamais perdu, seulement retiré de la vue
// "agenda à venir".
tasksRouter.get(
  "/",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const clauses = [];
    const params = [];

    if (req.user.role === ROLES.REPRESENTANT) {
      params.push(req.user.id);
      clauses.push(`t.assignee_id = $${params.length}`);
    } else if (req.user.role === ROLES.MASTER_REP) {
      const managed = await getManagedRepUserIds(req.user.id);
      const ids = [req.user.id, ...managed];
      params.push(ids);
      clauses.push(`t.assignee_id = ANY($${params.length}::uuid[])`);
    }
    // FRONT_DESK / DIRECTEUR : pas de filtre de rôle

    if (req.query.includePastRdv !== "true") {
      clauses.push(`NOT (t.type = 'RDV' AND t.due_date IS NOT NULL AND t.due_date < now())`);
    }
    // RDV annulé (migration 028) : jamais supprimé, mais retiré de l'agenda,
    // sauf demande explicite (?includeCancelled=true).
    if (req.query.includeCancelled !== "true") {
      clauses.push(`NOT (t.type = 'RDV' AND t.status = 'ANNULE')`);
    }

    // Nom du titulaire joint (utile au Master Rep/directeur, dont l'agenda
    // mélange leurs propres tâches et celles de leur équipe — cf. commentaire
    // ci-dessus — pour pouvoir afficher à qui appartient chaque ligne).
    let sql = `SELECT t.*, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
               FROM tasks t
               LEFT JOIN users u ON u.id = t.assignee_id`;
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY t.due_date NULLS LAST, t.created_at DESC";

    const { rows } = await query(sql, params);
    res.json(toCamelList(rows));
  }
);

const createSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional().nullable(),
  // RDV = rendez-vous chez/avec un client, forcément rattaché à une fiche
  // compte (cf. validation ci-dessous) ; TACHE = tâche générique, comme avant
  // ce lot. Défaut TACHE pour ne rien changer au comportement existant.
  type: z.enum(["RDV", "TACHE"]).default("TACHE"),
  // Sous-type du RDV (référentiel fusionné, cf. lib/interactionTypes.js) —
  // uniquement pertinent si type === "RDV" ; optionnel, jamais deviné.
  rdvSubtype: z.enum(INTERACTION_TYPES).optional().nullable(),
});

tasksRouter.post(
  "/",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    if (data.type === "RDV" && !data.accountId) {
      return res.status(400).json({
        error: "Un RDV doit être rattaché à une fiche client (accountId requis).",
      });
    }

    // Un représentant ne peut créer une tâche que pour lui-même.
    let assigneeId = data.assigneeId ?? req.user.id;
    if (req.user.role === ROLES.REPRESENTANT) {
      assigneeId = req.user.id;
    } else if (req.user.role === ROLES.MASTER_REP && assigneeId !== req.user.id) {
      // Un master rep ne fixe pas de tâche pour un rep dans ce Lot (accès en lecture
      // seule sur les tâches de ses reps, cf. commentaire GET ci-dessus) — à confirmer.
      const managed = await getManagedRepUserIds(req.user.id);
      if (!managed.includes(assigneeId)) {
        return res.status(403).json({ error: "Assignation non autorisée." });
      }
    }

    const { rows } = await query(
      `INSERT INTO tasks (title, due_date, assignee_id, created_by_id, account_id, type, rdv_subtype)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.title,
        data.dueDate ?? null,
        assigneeId,
        req.user.id,
        data.accountId ?? null,
        data.type,
        data.type === "RDV" ? data.rdvSubtype ?? null : null,
      ]
    );
    const task = rows[0];

    // Règle (votre demande) : un RDV passé sort de l'agenda mais reste
    // consultable dans l'historique du client. On garantit ça en traçant le
    // RDV comme interaction sur le compte DÈS SA CRÉATION — les interactions
    // ne sont jamais supprimées ni filtrées par date (cf. interactions.js),
    // donc cette trace survivra indéfiniment au retrait du RDV de l'agenda
    // (cf. filtre `GET /api/tasks` ci-dessus). Le compte rendu réel du
    // rendez-vous (texte libre, saisi après coup) est distinct de cette trace
    // de planification — voir PATCH /:id/compte-rendu plus bas, qui ajoute lui
    // aussi une entrée dans l'historique du client au moment de la saisie.
    if (data.type === "RDV") {
      const dateLabel = data.dueDate
        ? new Date(data.dueDate).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
        : "date non précisée";
      await query(
        `INSERT INTO interactions (account_id, author_id, note)
         VALUES ($1, $2, $3)`,
        [data.accountId, req.user.id, `RDV planifié : "${data.title}" — ${dateLabel}`]
      );
    }

    res.status(201).json(toCamel(task));
  }
);

tasksRouter.patch(
  "/:id",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const schema = z.object({
      done: z.boolean().optional(),
      title: z.string().min(1).optional(),
      dueDate: z.string().datetime().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Corps de requête invalide." });
    }

    const { rows: existingRows } = await query("SELECT * FROM tasks WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Tâche introuvable." });

    const isOwnTask = existing.assignee_id === req.user.id;
    const isPrivileged = req.user.role === ROLES.FRONT_DESK || req.user.role === ROLES.DIRECTEUR;
    if (!isOwnTask && !isPrivileged) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres tâches." });
    }
    if (existing.status === "ANNULE") {
      return res.status(409).json({ error: "Ce rendez-vous est annulé : il ne peut plus être modifié." });
    }

    const data = parsed.data;
    const sets = [];
    const params = [];
    let i = 1;
    if (data.done !== undefined) { sets.push(`done = $${i++}`); params.push(data.done); }
    if (data.title !== undefined) { sets.push(`title = $${i++}`); params.push(data.title); }
    if (data.dueDate !== undefined) { sets.push(`due_date = $${i++}`); params.push(data.dueDate); }
    if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    res.json(toCamel(rows[0]));
  }
);

// PATCH /api/tasks/:id/compte-rendu — compte rendu texte libre d'un RDV
// (règle définitive, plus une hypothèse). Volontairement simple : pas de
// gestion de statuts Planifié/Honoré/Reporté/Annulé (hors périmètre). Rattaché
// au RDV lui-même (cette tâche), au client (task.account_id), au commercial
// (task.assignee_id) et à la date du rendez-vous (task.due_date) — tout est
// déjà porté par la ligne tasks, cf. migration 012. Même règle de permission
// que la modification générique d'une tâche : le titulaire du RDV, ou front
// desk/directeur.
const compteRenduSchema = z.object({ compteRendu: z.string().min(1) });

tasksRouter.patch(
  "/:id/compte-rendu",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const parsed = compteRenduSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Le compte rendu ne peut pas être vide." });
    }

    const { rows: existingRows } = await query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Tâche introuvable." });
    if (existing.type !== "RDV") {
      return res.status(400).json({ error: "Un compte rendu ne peut être saisi que sur un rendez-vous (type RDV)." });
    }

    const isOwnTask = existing.assignee_id === req.user.id;
    const isPrivileged = req.user.role === ROLES.FRONT_DESK || req.user.role === ROLES.DIRECTEUR;
    if (!isOwnTask && !isPrivileged) {
      return res.status(403).json({ error: "Vous ne pouvez saisir un compte rendu que pour vos propres rendez-vous." });
    }
    if (existing.status === "ANNULE") {
      return res.status(409).json({ error: "Ce rendez-vous est annulé : aucun compte rendu ne peut être saisi." });
    }

    const { rows } = await query(
      `UPDATE tasks SET compte_rendu = $1, compte_rendu_at = now() WHERE id = $2 RETURNING *`,
      [parsed.data.compteRendu, req.params.id]
    );
    const task = rows[0];

    // Visible dans l'historique chronologique de la fiche client, avec les
    // interactions et la trace de planification du RDV (cf. POST / ci-dessus)
    // — même mécanisme, pour rester "simple et exploitable directement par le
    // futur écran Représentant" : un seul flux (GET /api/accounts/:id/interactions)
    // à consommer côté frontend pour tout l'historique texte du compte.
    if (task.account_id) {
      const dateLabel = task.due_date
        ? new Date(task.due_date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
        : "date non précisée";
      await query(
        `INSERT INTO interactions (account_id, author_id, note)
         VALUES ($1, $2, $3)`,
        [task.account_id, req.user.id, `Compte rendu RDV du ${dateLabel} — "${task.title}" : ${parsed.data.compteRendu}`]
      );
    }

    await logAudit({
      userId: req.user.id,
      action: "RDV_COMPTE_RENDU_SAVED",
      entity: "tasks",
      entityId: task.id,
      details: { accountId: task.account_id },
    });

    res.json(toCamel(task));
  }
);

// ---------------------------------------------------------------------------
// Modification et annulation d'un RDV (2026-10-27).
//
// Permission : EXACTEMENT celle déjà en place pour modifier un RDV (cocher,
// compte rendu) — le titulaire du RDV, ou front desk / directeur. Le Master
// Rep n'agit que sur SES propres RDV, ceux de son équipe restent en lecture
// seule (décision client du 2026-10-27).
// ---------------------------------------------------------------------------
async function loadEditableRdv(req, res) {
  const { rows } = await query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
  const rdv = rows[0];
  if (!rdv) {
    res.status(404).json({ error: "Rendez-vous introuvable." });
    return null;
  }
  if (rdv.type !== "RDV") {
    res.status(400).json({ error: "Seul un rendez-vous (type RDV) peut être modifié ou annulé ici." });
    return null;
  }
  const isOwn = rdv.assignee_id === req.user.id;
  const isPrivileged = req.user.role === ROLES.FRONT_DESK || req.user.role === ROLES.DIRECTEUR;
  if (!isOwn && !isPrivileged) {
    res.status(403).json({ error: "Vous ne pouvez modifier ou annuler que vos propres rendez-vous." });
    return null;
  }
  if (rdv.status === "ANNULE") {
    res.status(409).json({ error: "Ce rendez-vous est déjà annulé." });
    return null;
  }
  return rdv;
}

async function userDisplayName(userId) {
  const { rows } = await query("SELECT first_name, last_name, email FROM users WHERE id = $1", [userId]);
  const u = rows[0];
  return u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email : "";
}

const rdvDateLabel = (d) =>
  d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "date non précisée";

// Mêmes règles qu'à la création (POST / ci-dessus + formulaire de l'Agenda) :
// objet obligatoire, date/heure valides et obligatoires, RDV toujours
// rattaché à une fiche client. En plus (décision client) : la fiche choisie
// doit être une fiche que la personne a le droit de voir.
const rdvUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "L'objet du rendez-vous est obligatoire.").optional(),
    dueDate: z.string().datetime({ message: "Date et heure invalides." }).optional(),
    accountId: z.string().uuid("Fiche client invalide.").optional(),
    rdvSubtype: z.enum(INTERACTION_TYPES).optional().nullable(),
  })
  .strict();

tasksRouter.patch(
  "/:id/rdv",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const parsed = rdvUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides." });
    }
    const rdv = await loadEditableRdv(req, res);
    if (!rdv) return;
    const d = parsed.data;

    if (d.accountId !== undefined && d.accountId !== rdv.account_id) {
      const { rows } = await query("SELECT * FROM accounts WHERE id = $1", [d.accountId]);
      if (!rows[0]) return res.status(400).json({ error: "Fiche client introuvable." });
      if (!(await canAccessAccount(req.user, rows[0]))) {
        return res.status(403).json({ error: "Vous ne pouvez rattacher ce rendez-vous qu'à une fiche à laquelle vous avez accès." });
      }
    }

    const changes = [];
    const sets = [];
    const params = [];
    const set = (column, value, field, from) => {
      sets.push(`${column} = $${params.length + 1}`);
      params.push(value);
      changes.push({ field, from, to: value });
    };
    if (d.title !== undefined && d.title !== rdv.title) set("title", d.title, "title", rdv.title);
    if (d.dueDate !== undefined && new Date(d.dueDate).getTime() !== new Date(rdv.due_date).getTime()) {
      set("due_date", d.dueDate, "dueDate", rdv.due_date);
    }
    if (d.accountId !== undefined && d.accountId !== rdv.account_id) set("account_id", d.accountId, "accountId", rdv.account_id);
    if (d.rdvSubtype !== undefined && (d.rdvSubtype ?? null) !== rdv.rdv_subtype) {
      set("rdv_subtype", d.rdvSubtype ?? null, "rdvSubtype", rdv.rdv_subtype);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Aucune modification à enregistrer." });

    params.push(rdv.id);
    const { rows } = await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
    const updated = rows[0];

    // Trace dans l'historique de la fiche client (qui, quand, avant/après),
    // même mécanisme que la planification et le compte rendu.
    const who = await userDisplayName(req.user.id);
    const before = `"${rdv.title}" — ${rdvDateLabel(rdv.due_date)}`;
    const after = `"${updated.title}" — ${rdvDateLabel(updated.due_date)}`;
    await query(`INSERT INTO interactions (account_id, author_id, note) VALUES ($1, $2, $3)`, [
      updated.account_id,
      req.user.id,
      `RDV modifié par ${who} : ${before} → ${after}`,
    ]);
    if (updated.account_id !== rdv.account_id && rdv.account_id) {
      await query(`INSERT INTO interactions (account_id, author_id, note) VALUES ($1, $2, $3)`, [
        rdv.account_id,
        req.user.id,
        `RDV ${before} déplacé vers une autre fiche client par ${who}.`,
      ]);
    }

    await logAudit({
      userId: req.user.id,
      action: "RDV_UPDATED",
      entity: "tasks",
      entityId: rdv.id,
      details: { changes },
    });

    res.json(toCamel(updated));
  }
);

// Annulation : jamais de suppression. Le RDV passe au statut ANNULE (avec qui
// et quand), sort du calendrier et des compteurs "à venir", et reste visible
// dans l'historique de la fiche client et dans l'extraction Excel.
tasksRouter.post(
  "/:id/cancel",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    const rdv = await loadEditableRdv(req, res);
    if (!rdv) return;

    const { rows } = await query(
      `UPDATE tasks SET status = 'ANNULE', cancelled_at = now(), cancelled_by_id = $1
       WHERE id = $2 AND status <> 'ANNULE' RETURNING *`,
      [req.user.id, rdv.id]
    );
    if (!rows[0]) return res.status(409).json({ error: "Ce rendez-vous est déjà annulé." });

    if (rdv.account_id) {
      const who = await userDisplayName(req.user.id);
      await query(`INSERT INTO interactions (account_id, author_id, note) VALUES ($1, $2, $3)`, [
        rdv.account_id,
        req.user.id,
        `RDV annulé par ${who} : "${rdv.title}" — prévu le ${rdvDateLabel(rdv.due_date)}`,
      ]);
    }

    await logAudit({
      userId: req.user.id,
      action: "RDV_CANCELLED",
      entity: "tasks",
      entityId: rdv.id,
      details: { accountId: rdv.account_id, title: rdv.title, dueDate: rdv.due_date },
    });

    res.json(toCamel(rows[0]));
  }
);
