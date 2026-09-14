// Routes de démonstration pour valider le cloisonnement par rôle du Lot 1.
// À remplacer/étendre par les vraies routes métier au Lot 2 (CRM) et suivants —
// mais le pattern (requireAuth + requireRole, puis filtrage par owner_rep_id
// pour un REPRESENTANT) est celui à réutiliser partout.
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { query } from "../lib/db.js";

export const meRouter = Router();

// Accessible à tout utilisateur authentifié, quel que soit son rôle.
meRouter.get("/whoami", requireAuth, (req, res) => {
  res.json({ id: req.user.id, role: req.user.role, email: req.user.email });
});

// Réservé à l'administrateur (catalogue produits, imports) — section 3 handoff.
meRouter.get("/admin/ping", requireAuth, requireRole(ROLES.ADMINISTRATEUR), (req, res) => {
  res.json({ ok: true, scope: "administrateur" });
});

// Réservé au directeur commercial et au front desk (accès direct front desk pour le directeur).
meRouter.get(
  "/front-desk/ping",
  requireAuth,
  requireRole(ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  (req, res) => {
    res.json({ ok: true, scope: "front-desk-ou-directeur" });
  }
);

// Démonstration du filtrage par propriétaire pour un représentant :
// un REPRESENTANT ne voit que ses comptes (owner_rep_id = lui-même) ;
// les autres rôles avec accès aux comptes (front desk, directeur) verraient tout
// (règle à affiner précisément au Lot 2 selon les besoins de chaque écran).
meRouter.get(
  "/accounts/mine",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.FRONT_DESK, ROLES.DIRECTEUR),
  async (req, res) => {
    let sql = "SELECT id, name, type FROM accounts";
    const params = [];
    if (req.user.role === ROLES.REPRESENTANT) {
      sql += " WHERE owner_rep_id = $1";
      params.push(req.user.id);
    }
    const { rows } = await query(sql, params);
    res.json(rows);
  }
);
