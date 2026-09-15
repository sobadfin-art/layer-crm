import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { canAccessAccount } from "../lib/scope.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

// Pièces jointes de la fiche client (PDF Représentant section 4 : "Pièces
// jointes : ajout de fichier et possibilité de prendre une photo") — table
// `attachments` définie dès migration 001_init.sql mais jamais exposée par
// une route jusqu'ici. Même schéma de stockage que les photos produit
// (routes/products.js) : sur disque sous uploads/attachments, servi en
// statique par server.js, jamais en base64 en base. "Prendre une photo"
// depuis un mobile est un détail d'UI (input file avec capture="environment")
// — côté API c'est le même endpoint d'upload qu'un fichier classique.
export const attachmentsRouter = Router({ mergeParams: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ATTACHMENTS_DIR = path.join(__dirname, "../../uploads/attachments");
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
export const ATTACHMENTS_URL_PREFIX = "/uploads/attachments/";

const ACCOUNTS_MODULE_ROLES = [
  ROLES.REPRESENTANT,
  ROLES.MASTER_REP,
  ROLES.FRONT_DESK,
  ROLES.DIRECTEUR,
  ROLES.ADMINISTRATEUR,
];

// Formats acceptés : photos (prise de photo mobile ou import) + documents
// courants (contrat, devis signé, etc.) — jamais d'exécutable.
const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
    filename: (req, file, cb) => {
      const ext = MIME_EXT[file.mimetype] || path.extname(file.originalname || "") || "";
      cb(null, `${req.params.accountId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) {
      return cb(new Error("Format non supporté."));
    }
    cb(null, true);
  },
});

async function loadAccountOr404(accountId, res) {
  const { rows } = await query("SELECT * FROM accounts WHERE id = $1", [accountId]);
  if (!rows[0]) {
    res.status(404).json({ error: "Compte introuvable." });
    return null;
  }
  return rows[0];
}

// GET /api/accounts/:accountId/attachments
attachmentsRouter.get(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!canAccessAccount(req.user, account)) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }
    const { rows } = await query(
      `SELECT * FROM attachments WHERE account_id = $1 ORDER BY created_at DESC`,
      [req.params.accountId]
    );
    res.json(toCamelList(rows));
  }
);

// POST /api/accounts/:accountId/attachments — champ multipart "file"
attachmentsRouter.post(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res, next) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!canAccessAccount(req.user, account)) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }
    next();
  },
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'file')." });

    const fileUrl = `${ATTACHMENTS_URL_PREFIX}${req.file.filename}`;
    const { rows } = await query(
      `INSERT INTO attachments (account_id, file_url, file_name, mime_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.accountId, fileUrl, req.file.originalname, req.file.mimetype]
    );

    await logAudit({
      userId: req.user.id,
      action: "ATTACHMENT_ADDED",
      entity: "attachments",
      entityId: rows[0].id,
      details: { accountId: req.params.accountId, fileName: req.file.originalname },
    });

    res.status(201).json(toCamel(rows[0]));
  }
);

// DELETE /api/accounts/:accountId/attachments/:id — ne supprime pas le
// fichier physique (traçabilité — même principe que les autres suppressions
// de ce projet, cf. archivage plutôt que suppression réelle ailleurs) mais
// retire l'entrée de la liste affichée sur la fiche.
attachmentsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!canAccessAccount(req.user, account)) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }
    const { rows } = await query(
      `DELETE FROM attachments WHERE id = $1 AND account_id = $2 RETURNING id`,
      [req.params.id, req.params.accountId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Pièce jointe introuvable." });
    res.status(204).end();
  }
);
