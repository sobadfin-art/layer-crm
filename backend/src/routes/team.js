// Gestion d'équipe — section 3 : "Directeur ... gère l'équipe (reps + Master Reps)".
import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { query, pool } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const teamRouter = Router();

// -- Territoires ---------------------------------------------------------

teamRouter.get(
  "/territories",
  requireAuth,
  requireRole(ROLES.DIRECTEUR, ROLES.FRONT_DESK),
  async (req, res) => {
    const { rows } = await query(
      `SELECT t.*, COALESCE(json_agg(c.code) FILTER (WHERE c.code IS NOT NULL), '[]') AS country_codes
       FROM territories t LEFT JOIN countries c ON c.territory_id = t.id
       GROUP BY t.id ORDER BY t.name`
    );
    res.json(toCamelList(rows));
  }
);

const territorySchema = z.object({
  name: z.string().min(1),
  countryCodes: z.array(z.string().length(2)).default([]),
});

teamRouter.post("/territories", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = territorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO territories (name) VALUES ($1) RETURNING *`,
      [parsed.data.name]
    );
    const territory = rows[0];
    if (parsed.data.countryCodes.length > 0) {
      await client.query(
        `UPDATE countries SET territory_id = $1 WHERE code = ANY($2::text[])`,
        [territory.id, parsed.data.countryCodes.map((c) => c.toUpperCase())]
      );
    }
    await client.query("COMMIT");
    res.status(201).json(toCamel(territory));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// -- Membres de l'équipe ---------------------------------------------------

// BUG CORRIGÉ (fiche corrective V2 Direction commerciale, sections 2.2/4 —
// "Seul le Master Rep apparaît" / "reprendre la même hiérarchie") : cette
// requête renvoyait `sr.master_rep_id`, qui est la clé primaire de la table
// `master_reps` (master_reps.id), sous le nom de champ `masterRepId`. Or tout
// le frontend (TeamManagement.jsx, DirecteurDashboard.jsx) compare ce champ à
// `mr.id`, l'identifiant UTILISATEUR (users.id) des membres MASTER_REP
// renvoyés par ce même endpoint — cf. PATCH /members/:userId ci-dessous, qui
// attend d'ailleurs `masterRepUserId` (un users.id) et le résout lui-même vers
// master_reps.id en interne. Les deux espaces d'identifiants ne coïncident
// jamais (sauf coïncidence), donc `reps.filter(r => r.masterRepId === mr.id)`
// ne matchait jamais rien côté frontend : chaque Master Rep s'affichait seul,
// sans ses représentants rattachés, et le sélecteur de réaffectation
// affichait toujours "Aucun Master Rep" même quand un rattachement existait
// bel et bien en base. Fix : exposer `mr.user_id` (aliasé sur le même nom de
// colonne SQL `master_rep_id`, pour que toCamelList continue de produire
// `masterRepId`) au lieu de `sr.master_rep_id` — cohérent avec le users.id
// utilisé partout ailleurs.
// FRONT_DESK ajouté (fiche corrective Front Desk V3, section 2 : "la création
// d'un compte doit reprendre la même fiche complète que celle définie pour
// les autres rôles autorisés" — le formulaire de création de compte du Front
// Desk a besoin de cette même liste représentants/Master Reps pour choisir le
// ownerRepId, exactement comme le Directeur).
teamRouter.get("/members", requireAuth, requireRole(ROLES.DIRECTEUR, ROLES.FRONT_DESK), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
            mr.user_id AS master_rep_id, sr.territory_ids,
            mru.first_name AS master_rep_first_name, mru.last_name AS master_rep_last_name
     FROM users u
     LEFT JOIN sales_reps sr ON sr.user_id = u.id
     LEFT JOIN master_reps mr ON mr.id = sr.master_rep_id
     LEFT JOIN users mru ON mru.id = mr.user_id
     WHERE u.role IN ('REPRESENTANT', 'MASTER_REP')
     ORDER BY u.role, u.last_name`
  );
  res.json(toCamelList(rows));
});

// GET /api/team/mine — l'équipe d'UN Master Rep donné (lui-même, jamais
// l'équipe complète de l'entreprise comme /members ci-dessus, réservé au
// directeur). Alimente l'écran "Mon équipe" du portail Master Rep : liste des
// représentants qui lui sont affectés (sales_reps.master_rep_id), en lecture
// seule — le Master Rep ne gère pas l'affectation lui-même (section 3 :
// seuls front desk/directeur réaffectent, cf. lib/scope.js).
teamRouter.get("/mine", requireAuth, requireRole(ROLES.MASTER_REP), async (req, res) => {
  // territory_names : résolution des territory_ids en libellés directement
  // ici (plutôt que de renvoyer les UUID bruts) — utile au Dashboard Master
  // Rep (PDF section 1 : "le territoire / la zone couverte ... doit être
  // clairement identifiable"), sans donner accès à /team/territories
  // (réservé Directeur/Front desk) juste pour ce besoin d'affichage.
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.active, sr.territory_ids,
            COALESCE(
              (SELECT array_agg(t.name ORDER BY t.name) FROM territories t WHERE t.id = ANY(sr.territory_ids)),
              '{}'
            ) AS territory_names
     FROM users u
     JOIN sales_reps sr ON sr.user_id = u.id
     JOIN master_reps mr ON mr.id = sr.master_rep_id
     WHERE mr.user_id = $1
     ORDER BY u.last_name`,
    [req.user.id]
  );
  res.json(toCamelList(rows));
});

const createMemberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["REPRESENTANT", "MASTER_REP"]),
  password: z.string().min(8),
  masterRepUserId: z.string().uuid().optional().nullable(), // uniquement si role = REPRESENTANT
  territoryIds: z.array(z.string().uuid()).default([]),
});

// Crée un nouveau représentant ou Master Rep. Le mot de passe initial est fourni
// par le directeur ici (pas d'envoi d'e-mail dans ce Lot — à ajouter au Lot 6
// avec le reste des notifications) ; l'utilisateur devra le changer à sa
// première connexion dans une vraie mise en production.
teamRouter.post("/members", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Compte créé par le directeur avec un mot de passe initial qu'il choisit
    // lui-même : must_change_password=TRUE pour forcer l'utilisateur à le
    // changer dès sa première connexion (cf. chantier durcissement auth —
    // s'applique à tout compte créé par un administrateur, pas seulement ceux
    // de admin-users.js).
    const passwordHash = await bcrypt.hash(d.password, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, must_change_password)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id, email, first_name, last_name, role, active, must_change_password`,
      [d.email, passwordHash, d.firstName, d.lastName, d.role]
    );
    const user = userRows[0];

    if (d.role === ROLES.MASTER_REP) {
      await client.query(`INSERT INTO master_reps (user_id) VALUES ($1)`, [user.id]);
      await client.query(
        `INSERT INTO sales_reps (user_id, territory_ids) VALUES ($1, $2)`,
        [user.id, d.territoryIds]
      );
    } else {
      let masterRepId = null;
      if (d.masterRepUserId) {
        const { rows: mrRows } = await client.query(
          `SELECT id FROM master_reps WHERE user_id = $1`,
          [d.masterRepUserId]
        );
        if (!mrRows[0]) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "masterRepUserId ne correspond à aucun Master Rep." });
        }
        masterRepId = mrRows[0].id;
      }
      await client.query(
        `INSERT INTO sales_reps (user_id, master_rep_id, territory_ids) VALUES ($1,$2,$3)`,
        [user.id, masterRepId, d.territoryIds]
      );
    }

    await client.query("COMMIT");
    await logAudit({
      userId: req.user.id,
      action: "USER_CREATED",
      entity: "users",
      entityId: user.id,
      details: { role: user.role },
    });
    res.status(201).json(toCamel(user));
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà." });
    }
    throw err;
  } finally {
    client.release();
  }
});

const updateMemberSchema = z.object({
  active: z.boolean().optional(),
  masterRepUserId: z.string().uuid().optional().nullable(),
  territoryIds: z.array(z.string().uuid()).optional(),
});

teamRouter.patch("/members/:userId", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  // Vérification explicite du rôle de la cible AVANT toute modification :
  // cette route est "gestion d'équipe commerciale", elle ne doit jamais
  // pouvoir modifier silencieusement un utilisateur d'un autre rôle
  // (FRONT_DESK, ADMINISTRATEUR, DIRECTEUR) simplement parce qu'on connaît son
  // ID — consigne explicite du chantier durcissement auth. Ces rôles-là se
  // gèrent exclusivement via /api/admin/users.
  const { rows: targetRows } = await query(`SELECT role FROM users WHERE id = $1`, [req.params.userId]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: "Utilisateur introuvable." });
  if (target.role !== ROLES.REPRESENTANT && target.role !== ROLES.MASTER_REP) {
    return res.status(403).json({
      error:
        "Cette route ne gère que les représentants et Master Reps. Utilisez /api/admin/users pour les autres rôles.",
    });
  }

  if (d.active !== undefined) {
    await query(`UPDATE users SET active = $1, updated_at = now() WHERE id = $2`, [
      d.active,
      req.params.userId,
    ]);
  }

  if (d.masterRepUserId !== undefined) {
    let masterRepId = null;
    if (d.masterRepUserId) {
      const { rows } = await query(`SELECT id FROM master_reps WHERE user_id = $1`, [
        d.masterRepUserId,
      ]);
      if (!rows[0]) return res.status(400).json({ error: "masterRepUserId invalide." });
      masterRepId = rows[0].id;
    }
    await query(`UPDATE sales_reps SET master_rep_id = $1 WHERE user_id = $2`, [
      masterRepId,
      req.params.userId,
    ]);
  }

  if (d.territoryIds !== undefined) {
    await query(`UPDATE sales_reps SET territory_ids = $1 WHERE user_id = $2`, [
      d.territoryIds,
      req.params.userId,
    ]);
  }

  await logAudit({
    userId: req.user.id,
    action: "TEAM_MEMBER_UPDATED",
    entity: "users",
    entityId: req.params.userId,
    details: d,
  });

  const { rows } = await query(
    `SELECT id, email, first_name, last_name, role, active FROM users WHERE id = $1`,
    [req.params.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json(toCamel(rows[0]));
});
