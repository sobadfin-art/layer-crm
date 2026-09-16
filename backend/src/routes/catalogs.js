import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { buildCatalogImportTemplate } from "../lib/importTemplates.js";

export const catalogsRouter = Router();

// Lecture ouverte à tous les rôles qui doivent sélectionner des catalogues
// (prise de commande, écran catalogue, pilotage). L'administrateur en a aussi
// besoin puisque c'est lui qui les gère.
const READ_ROLES = [
  ROLES.REPRESENTANT,
  ROLES.MASTER_REP,
  ROLES.FRONT_DESK,
  ROLES.DIRECTEUR,
  ROLES.ADMINISTRATEUR,
];

catalogsRouter.get("/", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM catalogs c
     LEFT JOIN products p ON p.catalog_id = c.id
     GROUP BY c.id
     ORDER BY c.name`
  );
  res.json(toCamelList(rows));
});

// Modèle Excel vierge à télécharger avant import — un onglet par catalogue
// existant (correctif 2026-09-16, section 10 du cahier des charges import
// catalogue). Placée avant "/:id" pour ne jamais être confondue avec un id
// de catalogue par erreur de routage (aucun souci ici en pratique, ce
// routeur n'a pas de GET "/:id", mais gardé par prudence/lisibilité).
catalogsRouter.get(
  "/import-template",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query("SELECT name FROM catalogs ORDER BY name");
    const xlsx = buildCatalogImportTemplate(rows.map((c) => c.name));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="modele-import-catalogue.xlsx"`);
    res.send(xlsx);
  }
);

// Catalogue produits (admin uniquement) — cf. section 3 handoff.
catalogsRouter.post(
  "/",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Nom de catalogue requis." });

    try {
      const { rows } = await query(
        `INSERT INTO catalogs (name) VALUES ($1) RETURNING *`,
        [parsed.data.name]
      );
      res.status(201).json(toCamel(rows[0]));
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Un catalogue avec ce nom existe déjà." });
      }
      throw err;
    }
  }
);

catalogsRouter.patch(
  "/:id",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      active: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Corps invalide." });

    const sets = [];
    const params = [];
    let i = 1;
    if (parsed.data.name !== undefined) { sets.push(`name = $${i++}`); params.push(parsed.data.name); }
    if (parsed.data.active !== undefined) { sets.push(`active = $${i++}`); params.push(parsed.data.active); }
    if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE catalogs SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Catalogue introuvable." });
    res.json(toCamel(rows[0]));
  }
);

// Suppression d'un catalogue : les références rattachées repassent en
// "Sans catalogue" (catalog_id = NULL), jamais supprimées — section 11 du
// cahier des charges import catalogue.
catalogsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query("SELECT * FROM catalogs WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Catalogue introuvable." });

    await query("UPDATE products SET catalog_id = NULL WHERE catalog_id = $1", [req.params.id]);
    await query("DELETE FROM catalogs WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  }
);
