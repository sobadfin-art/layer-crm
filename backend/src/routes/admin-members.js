// Point 6 (2026-10-25) — "Modifier" un membre d'équipe, réservé à
// l'ADMINISTRATEUR, périmètre volontairement limité (décision client) au NOM
// (prénom / nom) et à l'ATTRIBUTION DE ZONE (territoires géographiques d'un
// représentant). Email, rôle, statut, Master Rep et mot de passe ne sont PAS
// modifiables ici.
//
// Module distinct de routes/admin-users.js et routes/team.js, qui restent
// réservés au DIRECTEUR et inchangés ("le Directeur garde sa gestion
// d'équipe actuelle"). Aucune session n'est invalidée : ni le nom ni les
// territoires n'interviennent dans les droits d'accès (cf. lib/scope.js,
// fondé sur la propriété des comptes et le rattachement Master Rep).
import { Router } from "express";
import { z } from "zod";
import { query, pool } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const adminMembersRouter = Router();

adminMembersRouter.use(requireAuth, requireRole(ROLES.ADMINISTRATEUR));

// Liste de tous les comptes (actifs et désactivés), en lecture : identité,
// rôle, statut et territoires (représentants uniquement — seuls à avoir une
// ligne sales_reps porteuse de territory_ids).
adminMembersRouter.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
            (sr.user_id IS NOT NULL AND u.role = 'REPRESENTANT') AS has_territories,
            COALESCE(sr.territory_ids, '{}') AS territory_ids
     FROM users u
     LEFT JOIN sales_reps sr ON sr.user_id = u.id
     ORDER BY u.active DESC, u.last_name, u.first_name`
  );
  res.json(toCamelList(rows));
});

adminMembersRouter.get("/territories", async (req, res) => {
  const { rows } = await query(
    `SELECT t.id, t.name, COALESCE(json_agg(c.code ORDER BY c.code) FILTER (WHERE c.code IS NOT NULL), '[]') AS country_codes
     FROM territories t LEFT JOIN countries c ON c.territory_id = t.id
     GROUP BY t.id ORDER BY t.name`
  );
  res.json(toCamelList(rows));
});

const updateSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est obligatoire.").optional(),
    lastName: z.string().trim().min(1, "Le nom est obligatoire.").optional(),
    territoryIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

function sameIds(a, b) {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

adminMembersRouter.patch("/:userId", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({
      error: first?.code === "unrecognized_keys" ? "Seuls le nom et les territoires sont modifiables ici." : first?.message || "Données invalides.",
    });
  }
  const d = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: targetRows } = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, sr.user_id AS sales_rep_user_id, sr.territory_ids
       FROM users u LEFT JOIN sales_reps sr ON sr.user_id = u.id
       WHERE u.id = $1 FOR UPDATE OF u`,
      [req.params.userId]
    );
    const target = targetRows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    const changes = [];
    if (d.firstName !== undefined && d.firstName !== target.first_name) {
      changes.push({ field: "firstName", from: target.first_name, to: d.firstName });
    }
    if (d.lastName !== undefined && d.lastName !== target.last_name) {
      changes.push({ field: "lastName", from: target.last_name, to: d.lastName });
    }

    let newTerritoryIds = null;
    if (d.territoryIds !== undefined) {
      if (target.role !== ROLES.REPRESENTANT || !target.sales_rep_user_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Les territoires ne s'attribuent qu'à un représentant." });
      }
      const ids = [...new Set(d.territoryIds)];
      const { rows: found } = await client.query(`SELECT id, name FROM territories WHERE id = ANY($1::uuid[])`, [ids]);
      if (found.length !== ids.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Territoire inconnu." });
      }
      const current = target.territory_ids || [];
      if (!sameIds(current, ids)) {
        const { rows: names } = await client.query(
          `SELECT id, name FROM territories WHERE id = ANY($1::uuid[])`,
          [[...new Set([...current, ...ids])]]
        );
        const nameOf = new Map(names.map((t) => [t.id, t.name]));
        // Journal lisible : libellés des territoires (et identifiants, pour
        // retrouver un territoire renommé ou supprimé depuis).
        changes.push({
          field: "territories",
          from: current.map((id) => nameOf.get(id) || id),
          to: ids.map((id) => nameOf.get(id) || id),
          fromIds: current,
          toIds: ids,
        });
        newTerritoryIds = ids;
      }
    }

    if (changes.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Aucune modification à enregistrer." });
    }

    if (changes.some((c) => c.field === "firstName" || c.field === "lastName")) {
      await client.query(
        `UPDATE users SET first_name = $1, last_name = $2, updated_at = now() WHERE id = $3`,
        [d.firstName ?? target.first_name, d.lastName ?? target.last_name, target.id]
      );
    }
    if (newTerritoryIds) {
      await client.query(`UPDATE sales_reps SET territory_ids = $1 WHERE user_id = $2`, [newTerritoryIds, target.id]);
    }
    await client.query("COMMIT");

    // Qui (userId), qui est concerné (entityId + email), quel champ, ancienne
    // et nouvelle valeur — aucun mot de passe n'est jamais lu ni journalisé.
    await logAudit({
      userId: req.user.id,
      action: "TEAM_MEMBER_PROFILE_UPDATED",
      entity: "users",
      entityId: target.id,
      details: { targetEmail: target.email, changes },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
            (sr.user_id IS NOT NULL AND u.role = 'REPRESENTANT') AS has_territories,
            COALESCE(sr.territory_ids, '{}') AS territory_ids
     FROM users u LEFT JOIN sales_reps sr ON sr.user_id = u.id WHERE u.id = $1`,
    [req.params.userId]
  );
  res.json(toCamel(rows[0]));
});
