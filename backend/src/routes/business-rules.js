import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { CATEGORIES } from "../lib/categories.js";
import { loadActiveBusinessRules, loadAllBusinessRules } from "../lib/businessRules.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const businessRulesRouter = Router();

// L'administrateur n'a explicitement PAS accès aux règles commerciales
// (section 3 handoff) — lecture ouverte aux autres rôles qui en ont besoin
// pour calculer une commande.
const READ_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR];

// ?includeInactive=true — réservé au directeur (écran Config, gestion des
// règles) : les autres rôles ne consomment cette liste que pour calculer une
// commande (lib/pricing.js) et ne doivent donc jamais voir une règle
// désactivée y figurer, quoi qu'ils passent en query string.
businessRulesRouter.get("/", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const includeInactive = req.query.includeInactive === "true" && req.user.role === ROLES.DIRECTEUR;
  const rows = includeInactive ? await loadAllBusinessRules() : await loadActiveBusinessRules();
  res.json(toCamelList(rows));
});

// Règle confirmée : la remise Combo a été complètement retirée du périmètre —
// uniquement des remises par catégorie désormais (plus de question de priorité
// Combo/Catégorie, cf. migration 006).
//
// Depuis la migration 013 (demande explicite du client), une règle de portée
// REPRESENTANT cible une SÉLECTION MULTIPLE de représentants (`repIds`)
// plutôt qu'un seul (`repId`, retiré) : "le plus simple est d'avoir une
// sélection lors de la création de la règle (remise) avec une sélection
// multiple des représentants concernés." Chacun des représentants
// sélectionnés voit alors le bouton de remise correspondant s'afficher en
// haut de la catégorie sur son récap de commande, et choisit de l'activer ou
// non commande par commande (cf. frontend NewOrder.jsx, déjà construit sur
// ce principe).
const schema = z.object({
  type: z.enum([
    "REMISE_CATEGORIE",
    "FRAIS_DE_PORT",
    "CONDITIONS_PAIEMENT",
    "TAXE",
    "EXPORT_DOLIBARR",
  ]),
  scope: z.enum(["GLOBAL", "PAYS", "REPRESENTANT"]).default("GLOBAL"),
  countryId: z.string().uuid().optional().nullable(),
  repIds: z.array(z.string().uuid()).default([]),
  categories: z.array(z.enum(CATEGORIES)).default([]),
  ratePct: z.number().min(0).max(100).optional().nullable(),
  flatAmount: z.number().optional().nullable(),
  threshold: z.number().optional().nullable(),
  active: z.boolean().default(true),
});

async function setRuleReps(client, ruleId, repIds) {
  await client.query("DELETE FROM business_rule_reps WHERE business_rule_id = $1", [ruleId]);
  if (repIds.length > 0) {
    const values = repIds.map((_, idx) => `($1, $${idx + 2})`).join(",");
    await client.query(
      `INSERT INTO business_rule_reps (business_rule_id, rep_id) VALUES ${values}`,
      [ruleId, ...repIds]
    );
  }
}

// Gérée exclusivement par le directeur ("tout passe par la table de règles,
// gérée par le directeur" — section 5).
businessRulesRouter.post(
  "/",
  requireAuth,
  requireRole(ROLES.DIRECTEUR),
  async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    if (d.scope === "REPRESENTANT" && d.repIds.length === 0) {
      return res.status(400).json({
        error: "Sélectionne au moins un représentant pour une règle de portée Représentant.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO business_rules (type, scope, country_id, categories, rate_pct, flat_amount, threshold, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [d.type, d.scope, d.countryId ?? null, d.categories, d.ratePct ?? null, d.flatAmount ?? null, d.threshold ?? null, d.active]
      );
      const rule = rows[0];

      const repIds = d.scope === "REPRESENTANT" ? d.repIds : [];
      await setRuleReps(client, rule.id, repIds);

      await client.query("COMMIT");

      await logAudit({
        userId: req.user.id,
        action: "BUSINESS_RULE_CREATED",
        entity: "business_rules",
        entityId: rule.id,
        details: { type: d.type, scope: d.scope, ratePct: d.ratePct ?? null, repIds },
      });

      res.status(201).json({ ...toCamel(rule), repIds });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

businessRulesRouter.patch(
  "/:id",
  requireAuth,
  requireRole(ROLES.DIRECTEUR),
  async (req, res) => {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    if (d.scope === "REPRESENTANT" && d.repIds !== undefined && d.repIds.length === 0) {
      return res.status(400).json({
        error: "Sélectionne au moins un représentant pour une règle de portée Représentant.",
      });
    }

    const columnFor = { countryId: "country_id", ratePct: "rate_pct", flatAmount: "flat_amount" };
    const sets = [];
    const params = [];
    let i = 1;
    for (const [field, value] of Object.entries(d)) {
      if (field === "repIds") continue; // géré séparément via business_rule_reps
      const col = columnFor[field] || field;
      sets.push(`${col} = $${i++}`);
      params.push(value);
    }
    if (sets.length === 0 && d.repIds === undefined) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let rule;
      if (sets.length > 0) {
        sets.push("updated_at = now()");
        params.push(req.params.id);
        const { rows } = await client.query(
          `UPDATE business_rules SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
          params
        );
        rule = rows[0];
      } else {
        const { rows } = await client.query("SELECT * FROM business_rules WHERE id = $1", [req.params.id]);
        rule = rows[0];
      }

      if (!rule) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Règle introuvable." });
      }

      // Un changement de scope qui quitte REPRESENTANT vide la sélection de
      // représentants — elle n'aurait plus de sens (GLOBAL/PAYS ne ciblent
      // jamais de représentant précis).
      if (d.repIds !== undefined) {
        await setRuleReps(client, req.params.id, d.repIds);
      } else if (d.scope !== undefined && d.scope !== "REPRESENTANT") {
        await setRuleReps(client, req.params.id, []);
      }

      await client.query("COMMIT");

      const { rows: repRows } = await query(
        "SELECT rep_id FROM business_rule_reps WHERE business_rule_id = $1",
        [req.params.id]
      );
      const repIds = repRows.map((r) => r.rep_id);

      await logAudit({
        userId: req.user.id,
        action: "BUSINESS_RULE_UPDATED",
        entity: "business_rules",
        entityId: req.params.id,
        details: { fields: Object.keys(d) },
      });

      res.json({ ...toCamel(rule), repIds });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

// Correctif 2026-09-16 (demande directe Direction Commerciale : "pour établir
// des regle de remise chez le directeur, dans configurer - rajouter la
// possibilité de modifier la regle ou de la supprimer") — jusqu'ici une règle
// ne pouvait qu'être activée/désactivée (cf. commentaire en tête de
// BusinessRules.jsx : "les règles ne sont JAMAIS supprimées"), ce que le
// client a désormais explicitement demandé de changer. `business_rule_reps`
// (ciblage représentant, migration 013) a une FK ON DELETE CASCADE vers
// cette table — aucun nettoyage manuel nécessaire, contrairement aux
// territoires (routes/team.js) qui n'ont pas cette garantie en base. Les
// commandes déjà passées ne référencent jamais l'id de la règle (seul le
// taux calculé au moment de la commande, order_lines.discount_pct, y est
// recopié) : supprimer une règle n'affecte donc jamais l'historique.
businessRulesRouter.delete("/:id", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const { rows } = await query("DELETE FROM business_rules WHERE id = $1 RETURNING *", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Règle introuvable." });

  await logAudit({
    userId: req.user.id,
    action: "BUSINESS_RULE_DELETED",
    entity: "business_rules",
    entityId: req.params.id,
    details: { type: rows[0].type, scope: rows[0].scope, ratePct: rows[0].rate_pct },
  });

  res.status(204).end();
});
