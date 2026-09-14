// Données de référence (pays) — jusqu'ici seulement consommées indirectement
// (jointes aux comptes dans accounts.js), jamais exposées en liste. Nécessaire
// au portail Directeur : formulaire de création de compte (n'existait encore
// nulle part dans le frontend), création de territoire (GET/POST
// /api/team/territories attend déjà des countryCodes), et tout futur select
// pays. Données non sensibles (juste la table de référence countries, migration
// 002) — accessible à tout utilisateur authentifié, pas de restriction de rôle.
import { Router } from "express";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { toCamelList } from "../lib/serialize.js";

export const countriesRouter = Router();

countriesRouter.get("/", requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, code, name, tax_id_label, currency FROM countries ORDER BY name`
  );
  res.json(toCamelList(rows));
});
