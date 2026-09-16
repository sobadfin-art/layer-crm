import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { parseSpreadsheet } from "../lib/fileParsing.js";
import { suggestMapping, IMPORT_TARGET_FIELDS } from "../lib/importMapping.js";
import { classifyRows, summarizeImport, applyImport, validateDolibarrIds } from "../lib/catalogImport.js";

export const catalogImportRouter = Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const mappingSchema = z.object(
  Object.fromEntries(IMPORT_TARGET_FIELDS.map((f) => [f, z.string().nullable().optional()]))
);

async function ensureCatalog(catalogId, res) {
  const { rows } = await query("SELECT * FROM catalogs WHERE id = $1", [catalogId]);
  if (!rows[0]) {
    res.status(404).json({ error: "Catalogue introuvable — sélectionnez ou créez-en un d'abord." });
    return null;
  }
  return rows[0];
}

// Étape 2/3 : aperçu — en-têtes détectées, mapping suggéré automatiquement,
// 10 premières lignes brutes pour vérification visuelle (section 5).
catalogImportRouter.post(
  "/preview",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    const catalog = await ensureCatalog(req.params.catalogId, res);
    if (!catalog) return;
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });

    try {
      // sheetName (optionnel) : ré-appelée par le front quand l'utilisateur
      // change d'onglet dans le sélecteur (fichier "1 onglet par catalogue",
      // cf. fileParsing.js) — sheetNames est toujours renvoyé pour afficher
      // ce sélecteur dès qu'un fichier en contient plusieurs.
      const { headers, rows, sheetNames, sheetName } = parseSpreadsheet(
        req.file.buffer,
        req.file.originalname,
        req.body.sheetName || undefined
      );
      res.json({
        headers,
        suggestedMapping: suggestMapping(headers),
        previewRows: rows.slice(0, 10),
        totalRows: rows.length,
        sheetNames,
        sheetName,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Étape 4 : résumé (nouvelles / mises à jour / erreurs) — sans écriture en base.
catalogImportRouter.post(
  "/summary",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    const catalog = await ensureCatalog(req.params.catalogId, res);
    if (!catalog) return;
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });

    let mapping;
    try {
      mapping = mappingSchema.parse(JSON.parse(req.body.mapping || "{}"));
    } catch {
      return res.status(400).json({ error: "Mapping invalide (JSON attendu)." });
    }

    try {
      const { rows } = parseSpreadsheet(req.file.buffer, req.file.originalname, req.body.sheetName || undefined);
      let classified = classifyRows(rows, mapping);
      classified = await validateDolibarrIds(classified);
      const summary = await summarizeImport(classified);
      res.json(summary);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

const commitBodySchema = z.object({
  mode: z.enum(["create_and_update", "create_only", "update_only"]).default("create_and_update"),
});

// Étape 5 : application réelle + journalisation (section 7).
catalogImportRouter.post(
  "/commit",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    const catalog = await ensureCatalog(req.params.catalogId, res);
    if (!catalog) return;
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });

    let mapping;
    try {
      mapping = mappingSchema.parse(JSON.parse(req.body.mapping || "{}"));
    } catch {
      return res.status(400).json({ error: "Mapping invalide (JSON attendu)." });
    }
    const { mode } = commitBodySchema.parse({ mode: req.body.mode });

    try {
      const { rows } = parseSpreadsheet(req.file.buffer, req.file.originalname, req.body.sheetName || undefined);
      let classified = classifyRows(rows, mapping);
      classified = await validateDolibarrIds(classified);
      const result = await applyImport({
        classified,
        catalogId: req.params.catalogId,
        mode,
        userId: req.user.id,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Historique des imports d'un catalogue.
catalogImportRouter.get(
  "/logs",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM catalog_import_logs WHERE catalog_id = $1 ORDER BY created_at DESC`,
      [req.params.catalogId]
    );
    res.json(rows);
  }
);
