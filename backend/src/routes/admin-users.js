// Administration générale des utilisateurs — DIRECTEUR uniquement.
//
// Séparé délibérément de src/routes/team.js : team.js reste la "gestion de
// l'équipe commerciale" (représentants/Master Reps, territoires, rattachement
// à un Master Rep) tandis que ce module couvre l'administration générale des
// comptes (tous rôles confondus) : création de FRONT_DESK/ADMINISTRATEUR
// (jusqu'ici impossible), activation/désactivation, changement de rôle
// encadré, réinitialisation de mot de passe déclenchée par le DIRECTEUR.
// Ainsi une route nommée "team/members" ne modifie jamais silencieusement un
// DIRECTEUR/FRONT_DESK/ADMINISTRATEUR (cf. consigne explicite).
//
// Le rôle DIRECTEUR n'est jamais créable ni atteignable via ce module (ni en
// création, ni en changement de rôle) : cf. procédure de bootstrap
// (scripts/bootstrap-directeur.js) pour le tout premier, et la procédure
// documentée dans le README pour un DIRECTEUR supplémentaire.
import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { z } from "zod";
import { query, pool } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireRole(ROLES.DIRECTEUR));

// Rôles gérables par ce module en création/changement de rôle. DIRECTEUR en
// est volontairement exclu — cf. commentaire en tête de fichier.
const MANAGEABLE_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.ADMINISTRATEUR];

// Rôles qui possèdent une ligne dans sales_reps (et éventuellement master_reps).
const TEAM_ROLES = new Set([ROLES.REPRESENTANT, ROLES.MASTER_REP]);

function generateTempPassword() {
  // Mot de passe temporaire aléatoire, jamais choisi/prévisible — répond à la
  // consigne "ne pas créer automatiquement un compte avec des identifiants
  // connus". Communiqué une seule fois, dans la réponse HTTP, jamais journalisé.
  return crypto.randomBytes(9).toString("base64url"); // 12 caractères, aléatoire
}

async function countActiveDirecteurs(client = { query }) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM users WHERE role = 'DIRECTEUR' AND active = TRUE`
  );
  return rows[0].n;
}

// -- Liste ------------------------------------------------------------------

const listQuerySchema = z.object({
  role: z.enum(Object.values(ROLES)).optional(),
  active: z.enum(["true", "false"]).optional(),
});

adminUsersRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Filtres invalides." });

  const clauses = [];
  const params = [];
  if (parsed.data.role) {
    params.push(parsed.data.role);
    clauses.push(`u.role = $${params.length}`);
  }
  if (parsed.data.active !== undefined) {
    params.push(parsed.data.active === "true");
    clauses.push(`u.active = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
            u.must_change_password, u.created_at
     FROM users u ${where}
     ORDER BY u.role, u.last_name`,
    params
  );
  res.json(toCamelList(rows));
});

// -- Création (FRONT_DESK / ADMINISTRATEUR — REPRESENTANT/MASTER_REP restent
//    sur POST /api/team/members qui gère aussi territoires/rattachement) ------

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum([ROLES.FRONT_DESK, ROLES.ADMINISTRATEUR]),
});

adminUsersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:
        parsed.error.issues[0]?.path?.[0] === "role"
          ? "Rôle invalide pour cette route : utilisez POST /api/team/members pour un représentant ou un Master Rep ; le rôle DIRECTEUR ne peut pas être créé ici."
          : "Requête invalide.",
    });
  }
  const d = parsed.data;

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, email, first_name, last_name, role, active, must_change_password`,
      [d.email, passwordHash, d.firstName, d.lastName, d.role]
    );
    const user = rows[0];
    await logAudit({
      userId: req.user.id,
      action: "USER_CREATED",
      entity: "users",
      entityId: user.id,
      details: { role: user.role },
    });
    res.status(201).json({ ...toCamel(user), temporaryPassword: tempPassword });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà." });
    }
    throw err;
  }
});

// -- Activation / désactivation ---------------------------------------------

adminUsersRouter.patch("/:userId/deactivate", async (req, res) => {
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
  }

  const { rows } = await query(`SELECT id, role, active FROM users WHERE id = $1`, [req.params.userId]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: "Utilisateur introuvable." });

  if (target.role === ROLES.DIRECTEUR && target.active) {
    const activeCount = await countActiveDirecteurs();
    if (activeCount <= 1) {
      return res.status(409).json({
        error: "Impossible de désactiver le dernier compte DIRECTEUR actif.",
      });
    }
  }

  await query(`UPDATE users SET active = FALSE, updated_at = now() WHERE id = $1`, [req.params.userId]);
  await logAudit({ userId: req.user.id, action: "USER_DEACTIVATED", entity: "users", entityId: target.id });
  res.json({ ok: true });
});

adminUsersRouter.patch("/:userId/reactivate", async (req, res) => {
  const { rows } = await query(`SELECT id FROM users WHERE id = $1`, [req.params.userId]);
  if (!rows[0]) return res.status(404).json({ error: "Utilisateur introuvable." });

  await query(`UPDATE users SET active = TRUE, updated_at = now() WHERE id = $1`, [req.params.userId]);
  await logAudit({ userId: req.user.id, action: "USER_REACTIVATED", entity: "users", entityId: req.params.userId });
  res.json({ ok: true });
});

// -- Changement de rôle (route dédiée, encadrée) -----------------------------

const roleChangeSchema = z.object({ role: z.enum(MANAGEABLE_ROLES) });

adminUsersRouter.patch("/:userId/role", async (req, res) => {
  if (req.params.userId === req.user.id) {
    return res.status(403).json({ error: "Vous ne pouvez pas modifier votre propre rôle." });
  }

  const parsed = roleChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Rôle cible invalide. Le rôle DIRECTEUR ne peut pas être atteint via cette route.",
    });
  }
  const newRole = parsed.data.role;

  const { rows } = await query(`SELECT id, role FROM users WHERE id = $1`, [req.params.userId]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: "Utilisateur introuvable." });

  if (target.role === ROLES.DIRECTEUR) {
    return res.status(403).json({
      error: "Le rôle DIRECTEUR ne peut pas être modifié depuis l'interface standard.",
    });
  }
  const oldRole = target.role;
  if (oldRole === newRole) return res.json({ ok: true, unchanged: true });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Sortie d'un rôle "équipe commerciale" (REPRESENTANT/MASTER_REP) : si
    // l'utilisateur était Master Rep, on refuse la bascule tant que des
    // représentants lui sont encore rattachés (cohérence des rattachements —
    // consigne explicite), pour ne jamais laisser une équipe orpheline.
    if (oldRole === ROLES.MASTER_REP && newRole !== ROLES.MASTER_REP) {
      const { rows: mrRows } = await client.query(`SELECT id FROM master_reps WHERE user_id = $1`, [
        target.id,
      ]);
      const masterRepRowId = mrRows[0]?.id;
      if (masterRepRowId) {
        const { rows: attached } = await client.query(
          `SELECT count(*)::int AS n FROM sales_reps WHERE master_rep_id = $1`,
          [masterRepRowId]
        );
        if (attached[0].n > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error:
              "Ce Master Rep a encore des représentants rattachés. Réaffectez-les avant de changer son rôle.",
          });
        }
        await client.query(`DELETE FROM master_reps WHERE id = $1`, [masterRepRowId]);
      }
    }

    if (TEAM_ROLES.has(oldRole) && !TEAM_ROLES.has(newRole)) {
      await client.query(`DELETE FROM sales_reps WHERE user_id = $1`, [target.id]);
    }

    if (!TEAM_ROLES.has(oldRole) && TEAM_ROLES.has(newRole)) {
      await client.query(`INSERT INTO sales_reps (user_id, territory_ids) VALUES ($1, '{}')`, [target.id]);
    }

    if (newRole === ROLES.MASTER_REP && oldRole !== ROLES.MASTER_REP) {
      await client.query(
        `INSERT INTO master_reps (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [target.id]
      );
    }

    if (oldRole === ROLES.MASTER_REP && newRole === ROLES.REPRESENTANT) {
      // Redondant avec le bloc ci-dessus (déjà supprimé) mais gardé explicite
      // pour la lisibilité du cas REP<->MASTER_REP.
      await client.query(`UPDATE sales_reps SET master_rep_id = NULL WHERE user_id = $1`, [target.id]);
    }

    await client.query(`UPDATE users SET role = $1, updated_at = now() WHERE id = $2`, [
      newRole,
      target.id,
    ]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await logAudit({
    userId: req.user.id,
    action: "ROLE_CHANGED",
    entity: "users",
    entityId: target.id,
    details: { fromRole: oldRole, toRole: newRole },
  });
  res.json({ ok: true });
});

// -- Réinitialisation de mot de passe déclenchée par le DIRECTEUR -----------

adminUsersRouter.post("/:userId/force-password-reset", async (req, res) => {
  const { rows } = await query(`SELECT id FROM users WHERE id = $1`, [req.params.userId]);
  if (!rows[0]) return res.status(404).json({ error: "Utilisateur introuvable." });

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = now() WHERE id = $2`,
    [passwordHash, req.params.userId]
  );
  await logAudit({
    userId: req.user.id,
    action: "PASSWORD_FORCE_RESET",
    entity: "users",
    entityId: req.params.userId,
  });
  res.json({ ok: true, temporaryPassword: tempPassword });
});
