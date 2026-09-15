import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { CATEGORIES } from "../lib/categories.js";
import { TYPOLOGIES } from "../lib/typology.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { computeObjectiveProgress } from "../lib/objectiveProgress.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const objectivesRouter = Router();

// Le Master Rep voit les objectifs de son équipe en lecture seule, ne les fixe
// jamais (section 3 : "objectifs en lecture seule" + "ne fixe jamais d'objectif").
const READ_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.DIRECTEUR];

objectivesRouter.get("/", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  let sql = "SELECT * FROM objectives";
  const params = [];

  if (req.user.role === ROLES.REPRESENTANT) {
    sql += " WHERE rep_id = $1";
    params.push(req.user.id);
  } else if (req.user.role === ROLES.MASTER_REP) {
    const managed = await getManagedRepUserIds(req.user.id);
    sql += " WHERE rep_id = ANY($1::uuid[])";
    params.push([req.user.id, ...managed]);
  }
  sql += " ORDER BY period_start DESC";

  const { rows } = await query(sql, params);
  res.json(toCamelList(rows));
});

async function canSeeObjective(user, objective) {
  if (user.role === ROLES.DIRECTEUR) return true;
  if (user.role === ROLES.REPRESENTANT) return objective.rep_id === user.id;
  if (user.role === ROLES.MASTER_REP) {
    if (objective.rep_id === user.id) return true;
    const managed = await getManagedRepUserIds(user.id);
    return managed.includes(objective.rep_id);
  }
  return false;
}

objectivesRouter.get("/:id/progress", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const { rows } = await query("SELECT * FROM objectives WHERE id = $1", [req.params.id]);
  const objective = rows[0];
  if (!objective) return res.status(404).json({ error: "Objectif introuvable." });
  if (!(await canSeeObjective(req.user, objective))) {
    return res.status(403).json({ error: "Accès refusé à cet objectif." });
  }
  res.json(await computeObjectiveProgress(objective));
});

// Règle confirmée : un objectif est TOUJOURS associé à une période précise et
// explicite — deux champs obligatoires (periodStart/periodEnd), jamais une
// notion générique de "période". Le réalisé (computeObjectiveProgress) ne
// prend en compte que les commandes dont la date de VALIDATION
// (orders.validated_at, jamais created_at — cf. lib/objectiveProgress.js)
// tombe dans cet intervalle exact, pour une comparaison objectif/réalisé
// rigoureuse.
const objectiveFields = z.object({
  repId: z.string().uuid(),
  type: z.enum(["CHIFFRE_AFFAIRES", "PRECOMMANDE"]),
  // Multi-sélection des 11 typologies client — remplace l'ancien modèle à 2
  // secteurs agrégés (cf. migration 015 et PDF Directeur commercial section
  // 4 : "sélectionner une ou plusieurs typologies de clients / réseaux").
  // Tableau vide = aucun filtre de typologie (l'objectif s'applique à toutes).
  typologies: z.array(z.enum(TYPOLOGIES)).default([]),
  categories: z.array(z.enum(CATEGORIES)).default([]),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  targetAmount: z.number().positive(),
});

const createSchema = objectiveFields.refine(
  (d) => new Date(d.periodEnd) > new Date(d.periodStart),
  { message: "La date de fin doit être postérieure à la date de début.", path: ["periodEnd"] }
);

// Fixé exclusivement par le directeur (section 3 : "fixe les objectifs").
objectivesRouter.post("/", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const { rows } = await query(
    `INSERT INTO objectives (rep_id, type, typologies, categories, period_start, period_end, target_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [d.repId, d.type, d.typologies, d.categories, d.periodStart, d.periodEnd, d.targetAmount]
  );

  await logAudit({
    userId: req.user.id,
    action: "OBJECTIVE_CREATED",
    entity: "objectives",
    entityId: rows[0].id,
    details: { repId: d.repId, type: d.type, targetAmount: d.targetAmount, periodStart: d.periodStart, periodEnd: d.periodEnd },
  });

  res.status(201).json(toCamel(rows[0]));
});

objectivesRouter.patch("/:id", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = objectiveFields.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { rows: existingRows } = await query("SELECT * FROM objectives WHERE id = $1", [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Objectif introuvable." });

  const nextStart = parsed.data.periodStart ?? existing.period_start;
  const nextEnd = parsed.data.periodEnd ?? existing.period_end;
  if (new Date(nextEnd) <= new Date(nextStart)) {
    return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
  }

  const columnFor = {
    repId: "rep_id",
    periodStart: "period_start",
    periodEnd: "period_end",
    targetAmount: "target_amount",
  };
  const sets = [];
  const params = [];
  let i = 1;
  for (const [field, value] of Object.entries(parsed.data)) {
    sets.push(`${columnFor[field] || field} = $${i++}`);
    params.push(value);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
  params.push(req.params.id);

  const { rows } = await query(
    `UPDATE objectives SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "Objectif introuvable." });

  await logAudit({
    userId: req.user.id,
    action: "OBJECTIVE_UPDATED",
    entity: "objectives",
    entityId: req.params.id,
    details: { fields: Object.keys(parsed.data) },
  });

  res.json(toCamel(rows[0]));
});
