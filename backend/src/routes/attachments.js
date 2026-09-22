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
import {
  isObjectStorageConfigured,
  missingObjectStorageEnvVars,
  putObject,
  getObject,
} from "../lib/objectStorage.js";

// Pièces jointes de la fiche client (PDF Représentant section 4 : "Pièces
// jointes : ajout de fichier et possibilité de prendre une photo") — table
// `attachments` définie dès migration 001_init.sql. "Prendre une photo"
// depuis un mobile est un détail d'UI (input file avec capture="environment")
// — côté API c'est le même endpoint d'upload qu'un fichier classique.
//
// Correctif 2026-09-22 (demande client, point 2 — "même classe de bug que les
// photos produit") : jusqu'ici ce fichier écrivait TOUJOURS sur le disque
// local du conteneur (multer.diskStorage sans condition), et le fichier était
// servi par le middleware express.static générique monté sur /uploads dans
// server.js. Or Render (plan gratuit) l'a confirmé lui-même : "Disks are not
// supported for free compute plans" — tout fichier écrit là est perdu à
// chaque redémarrage (veille après 15 min d'inactivité, ou redéploiement).
// C'est exactement le bug déjà diagnostiqué et corrigé pour les photos
// produit le 2026-09-17 (cf. routes/products.js), jamais appliqué ici.
// Correction : même pattern exact que products.js — bascule vers Cloudflare
// R2 (stockage objet persistant, cf. lib/objectStorage.js) dès que les
// variables R2_* sont présentes, fallback sur le disque local uniquement en
// développement local sans identifiants R2 (jamais en production dès que les
// variables sont posées sur Render). Le fichier est désormais servi par
// `attachmentFilesRouter` ci-dessous (monté AVANT le middleware statique
// générique, cf. server.js), qui exige une session valide ET vérifie que
// l'utilisateur a accès au compte propriétaire (canAccessAccount, même règle
// que GET/POST/DELETE ci-dessous) — avant ce correctif, l'URL d'une pièce
// jointe était accessible SANS AUCUNE authentification via le middleware
// statique générique ; effet de bord bienvenu de l'alignement sur le pattern
// déjà validé des photos produit, pas une régression fonctionnelle (aucun
// écran du CRM ne dépendait de cet accès non authentifié).
export const attachmentsRouter = Router({ mergeParams: true });
// Route de service (téléchargement d'une pièce jointe) — séparée
// d'attachmentsRouter car montée sous /uploads/attachments dans server.js,
// pas sous /api/accounts/:accountId/attachments (même principe que
// productPhotosRouter dans routes/products.js).
export const attachmentFilesRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ATTACHMENTS_DIR = path.join(__dirname, "../../uploads/attachments");
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
export const ATTACHMENTS_URL_PREFIX = "/uploads/attachments/";

const USE_R2 = isObjectStorageConfigured();
if (USE_R2) {
  console.log("[attachments] Pièces jointes stockées sur Cloudflare R2, accès via /uploads/attachments authentifié.");
} else {
  console.warn(
    `[attachments] R2 non configuré (variables manquantes : ${missingObjectStorageEnvVars().join(
      ", "
    )}) — fallback sur le disque local, NON PERSISTANT en production. ` +
      "À ne voir qu'en développement local."
  );
}

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

// Même principe que buildObjectKey dans routes/products.js : le nom de
// fichier local ET la clé R2 partagent la même base
// "<accountId>-<timestamp>-<random><ext>", seule la clé R2 porte en plus le
// préfixe "attachments/" (répertoire logique du bucket).
function buildObjectKey(req, file) {
  const ext = MIME_EXT[file.mimetype] || path.extname(file.originalname || "") || "";
  return `attachments/${req.params.accountId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
}

const upload = multer({
  storage: USE_R2
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
        filename: (req, file, cb) => cb(null, path.basename(buildObjectKey(req, file))),
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

// GET /uploads/attachments/:filename — montée directement à la racine (voir
// server.js), PAS sous /api, pour rester compatible avec les URLs déjà en
// base (`/uploads/attachments/...`) générées avant comme après ce correctif.
// Contrairement aux photos produit (accessibles à tout utilisateur d'un des
// ACCOUNTS_MODULE_ROLES, cf. products.js), une pièce jointe reste rattachée à
// UN compte précis dont l'accès est scopé par rôle (canAccessAccount, même
// règle que GET/POST/DELETE ci-dessus) — d'où la recherche en base pour
// retrouver le compte propriétaire à partir du nom de fichier, avant de
// décider d'autoriser le téléchargement.
attachmentFilesRouter.get(
  "/:filename",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    // Jamais de traversée de dossier : uniquement le nom de fichier généré
    // par buildObjectKey ci-dessus (aucun "/" ni "..").
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename) {
      return res.status(400).json({ error: "Nom de fichier invalide." });
    }

    const fileUrl = `${ATTACHMENTS_URL_PREFIX}${filename}`;
    const { rows } = await query("SELECT account_id FROM attachments WHERE file_url = $1", [fileUrl]);
    if (!rows[0]) return res.status(404).json({ error: "Pièce jointe introuvable." });
    const account = await loadAccountOr404(rows[0].account_id, res);
    if (!account) return;
    if (!(await canAccessAccount(req.user, account))) {
      return res.status(403).json({ error: "Accès refusé à ce fichier." });
    }

    if (USE_R2) {
      try {
        const { stream, contentType, contentLength } = await getObject({
          key: `attachments/${filename}`,
        });
        if (contentType) res.setHeader("Content-Type", contentType);
        if (contentLength != null) res.setHeader("Content-Length", contentLength);
        res.setHeader("Cache-Control", "private, max-age=3600");
        stream.pipe(res);
      } catch (err) {
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({ error: "Pièce jointe introuvable." });
        }
        throw err;
      }
      return;
    }

    const filePath = path.join(ATTACHMENTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Pièce jointe introuvable." });
    }
    res.sendFile(filePath);
  }
);

// GET /api/accounts/:accountId/attachments
attachmentsRouter.get(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const account = await loadAccountOr404(req.params.accountId, res);
    if (!account) return;
    if (!(await canAccessAccount(req.user, account))) {
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
    if (!(await canAccessAccount(req.user, account))) {
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

    let fileUrl;
    if (USE_R2) {
      const key = buildObjectKey(req, req.file);
      await putObject({ key, body: req.file.buffer, contentType: req.file.mimetype });
      // Même forme d'URL qu'en mode disque local ("/uploads/attachments/<fichier>")
      // — jamais l'URL R2 elle-même. key = "attachments/<fichier>" -> on
      // retire le préfixe "attachments/".
      fileUrl = `${ATTACHMENTS_URL_PREFIX}${key.slice("attachments/".length)}`;
    } else {
      fileUrl = `${ATTACHMENTS_URL_PREFIX}${req.file.filename}`;
    }
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
    if (!(await canAccessAccount(req.user, account))) {
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
