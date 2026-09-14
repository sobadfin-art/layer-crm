// Gestion utilisateur minimale pour ce Lot. La route de rapprochement Dolibarr
// (fk_user) a été retirée après retour client : l'intégration se fait
// exclusivement par fichier d'import, jamais par API Dolibarr, donc cet
// identifiant n'est plus nécessaire (cf. migration 006).
import { Router } from "express";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamelList } from "../lib/serialize.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requireRole(ROLES.DIRECTEUR, ROLES.FRONT_DESK),
  async (req, res) => {
    const { rows } = await query(
      `SELECT id, email, first_name, last_name, role, active FROM users ORDER BY last_name`
    );
    res.json(toCamelList(rows));
  }
);
