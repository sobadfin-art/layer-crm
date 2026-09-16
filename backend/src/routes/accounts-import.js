import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { parseSpreadsheet } from "../lib/fileParsing.js";
import { suggestMapping, IMPORT_TARGET_FIELDS } from "../lib/importMappingAccounts.js";
import { classifyRows, summarizeImport, applyImport, loadCountriesByName } from "../lib/accountsImport.js";
import { toCamelList } from "../lib/serialize.js";
import { buildAccountsImportTemplate } from "../lib/importTemplates.js";

export const accountsImportRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const mappingSchema = z.object(
  Object.fromEntries(IMPORT_TARGET_FIELDS.map((f) => [f, z.string().nullable().optional()]))
);

// Modèle Excel vierge à télécharger avant import (correctif 2026-09-16,
// demande client explicite — cf. section 11 du cahier des charges import
// fiches client, décision revue : utile comme aide-mémoire même si le
// fichier réel est d'ordinaire un export direct Dolibarr).
accountsImportRouter.get(
  "/template",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const xlsx = buildAccountsImportTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="modele-import-fiches-client.xlsx"`);
    res.send(xlsx);
  }
);

// Liste des représentants disponibles pour l'étape 1 (représentant par
// défaut) — accès restreint à ce que nécessite l'import, pas un accès général
// à la gestion d'équipe (réservée au directeur, cf. team.js).
accountsImportRouter.get(
  "/reps",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query(
      `SELECT id, first_name, last_name, role FROM users
       WHERE role IN ('REPRESENTANT', 'MASTER_REP')
       ORDER BY role, last_name`
    );
    res.json(toCamelList(rows));
  }
);

// Étape 2/3 : aperçu — en-têtes détectées, mapping suggéré (fixe, calibré sur
// l'export Dolibarr — section 5), 10 premières lignes brutes.
accountsImportRouter.post(
  "/preview",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });
    try {
      const { headers, rows } = parseSpreadsheet(req.file.buffer, req.file.originalname);
      res.json({
        headers,
        suggestedMapping: suggestMapping(headers),
        previewRows: rows.slice(0, 10),
        totalRows: rows.length,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

function parseMapping(req) {
  return mappingSchema.parse(JSON.parse(req.body.mapping || "{}"));
}

// Étape 8 : résumé (nouvelles / mises à jour / erreurs / repli représentant) —
// sans écriture en base.
accountsImportRouter.post(
  "/summary",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });
    let mapping;
    try {
      mapping = parseMapping(req);
    } catch {
      return res.status(400).json({ error: "Mapping invalide (JSON attendu)." });
    }
    try {
      const { rows } = parseSpreadsheet(req.file.buffer, req.file.originalname);
      const countriesByName = await loadCountriesByName();
      const classified = classifyRows(rows, mapping, countriesByName);
      const summary = await summarizeImport(classified);
      res.json(summary);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// defaultRepId est désormais optionnel (fiche corrective V2 Administrateur,
// section 3 : "Le système ne doit pas bloquer l'import lorsque le champ
// représentant n'est pas pré-sélectionné") — les lignes sans représentant
// reconnu dans le fichier ET sans repli par défaut sont importées avec
// owner_rep_id = NULL, à affecter manuellement ensuite dans le CRM (cf.
// migration 018_accounts_owner_rep_nullable.sql).
const commitBodySchema = z.object({
  mode: z.enum(["create_and_update", "create_only", "update_only"]).default("create_and_update"),
  defaultRepId: z.string().uuid().optional(),
});

// Étape 9 : application réelle + journalisation.
accountsImportRouter.post(
  "/commit",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });
    let mapping;
    try {
      mapping = parseMapping(req);
    } catch {
      return res.status(400).json({ error: "Mapping invalide (JSON attendu)." });
    }
    const parsedBody = commitBodySchema.safeParse({
      mode: req.body.mode,
      // Champ FormData facultatif : une chaîne vide (case non choisie côté
      // formulaire) doit être traitée comme "absent", pas comme un uuid
      // invalide — sinon un import "sans représentant" échouerait toujours
      // à la validation au lieu d'aboutir à owner_rep_id = NULL.
      defaultRepId: req.body.defaultRepId || undefined,
    });
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Représentant par défaut invalide." });
    }
    const { mode, defaultRepId } = parsedBody.data;

    try {
      const { rows } = parseSpreadsheet(req.file.buffer, req.file.originalname);
      const countriesByName = await loadCountriesByName();
      const classified = classifyRows(rows, mapping, countriesByName);
      const result = await applyImport({ classified, defaultRepId: defaultRepId ?? null, mode, userId: req.user.id });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Historique des imports fiches client.
accountsImportRouter.get(
  "/logs",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM account_import_logs ORDER BY created_at DESC`
    );
    res.json(toCamelList(rows));
  }
);
