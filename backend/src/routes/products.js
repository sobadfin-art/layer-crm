import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { CATEGORIES } from "../lib/categories.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";

export const productsRouter = Router();

// Téléversement direct d'une photo produit (alternative à une URL externe,
// cf. section "Ce qui n'est PAS couvert par l'import de fichier" du cahier
// des charges catalogue) — pour les produits pas encore en vente sur
// mokenvision.com, donc sans URL publique disponible (ils le seront plus
// tard : la photo pourra alors soit rester le fichier téléversé, soit être
// remplacée par l'URL du site via une nouvelle mise à jour ou le
// rapprochement automatique, cf. docs/rapprochement-photos-mokenvision.md).
// Stocké sur disque et servi statiquement sous /uploads (cf. server.js) —
// jamais en base64 en base, jamais un chemin en dehors de ce dossier dédié.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PRODUCT_PHOTOS_DIR = path.join(__dirname, "../../uploads/products");
fs.mkdirSync(PRODUCT_PHOTOS_DIR, { recursive: true });
export const PRODUCT_PHOTOS_URL_PREFIX = "/uploads/products/";

const PHOTO_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRODUCT_PHOTOS_DIR),
    filename: (req, file, cb) => {
      const ext = PHOTO_MIME_EXT[file.mimetype];
      cb(null, `${req.params.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!PHOTO_MIME_EXT[file.mimetype]) {
      return cb(new Error("Format non supporté — jpeg, png ou webp uniquement."));
    }
    cb(null, true);
  },
});

// URL http(s) classique (produit déjà en vente sur le site) OU chemin local
// résultant d'un téléversement direct ci-dessus — jamais autre chose (pas de
// data: URI, pas de chemin arbitraire).
const photoUrlField = z
  .string()
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith(PRODUCT_PHOTOS_URL_PREFIX),
    { message: "Photo : URL http(s) ou fichier téléversé attendu." }
  )
  .optional()
  .nullable();

const ALL_ROLES = [
  ROLES.REPRESENTANT,
  ROLES.MASTER_REP,
  ROLES.FRONT_DESK,
  ROLES.DIRECTEUR,
  ROLES.ADMINISTRATEUR,
];

// Lecture ouverte (catalogue de référence + prise de commande ont besoin de tout voir).
productsRouter.get("/", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const clauses = [];
  const params = [];
  let i = 1;

  // Plusieurs catalogues doivent rester sélectionnables simultanément à la prise
  // de commande (section 2 handoff) : ?catalogId=A&catalogId=B ou ?catalogId=A,B
  if (req.query.catalogId) {
    const catalogIds = Array.isArray(req.query.catalogId)
      ? req.query.catalogId
      : String(req.query.catalogId).split(",");
    clauses.push(`p.catalog_id = ANY($${i++}::uuid[])`);
    params.push(catalogIds);
  }
  if (req.query.category) {
    clauses.push(`p.category = $${i++}`);
    params.push(req.query.category);
  }
  if (req.query.search) {
    clauses.push(`(p.label ILIKE $${i} OR p.model ILIKE $${i} OR p.ref ILIKE $${i})`);
    params.push(`%${req.query.search}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT p.*, c.name AS catalog_name, c.active AS catalog_active
     FROM products p
     LEFT JOIN catalogs c ON c.id = p.catalog_id
     ${where}
     ORDER BY p.label`,
    params
  );
  res.json(toCamelList(rows));
});

productsRouter.get("/:id", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, c.name AS catalog_name FROM products p
     LEFT JOIN catalogs c ON c.id = p.catalog_id WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
  res.json(toCamel(rows[0]));
});

const productSchema = z.object({
  ref: z.string().min(1),
  label: z.string().min(1),
  model: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  category: z.enum([...CATEGORIES, "NON_CLASSE"]).optional(),
  collection: z.string().optional().nullable(),
  catalogId: z.string().uuid().optional().nullable(),
  photoUrl: photoUrlField,
  dolibarrRef: z.string().optional().nullable(), // correspondance Dolibarr (point 6) — utilisé si `ref` ne suffit pas
  priceFR: z.number().optional().nullable(),
  priceExport: z.number().optional().nullable(),
  priceCH: z.number().optional().nullable(),
  rrp: z.number().optional().nullable(),
  qty: z.number().int().optional(),
  stockStatus: z.enum(["EN_STOCK", "RUPTURE", "REASSORT_PREVU"]).optional(),
  productStatus: z.enum(["NOUVEAU", "ACTIF", "DISCONTINUE"]).optional(),
  restockDate: z.string().datetime().optional().nullable(),
  expectedQty: z.number().int().optional().nullable(),
});

// Création/édition manuelle réservée à l'administrateur (l'essentiel du volume
// passe par l'import en masse — voir routes/catalog-import.js).
productsRouter.post(
  "/",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    try {
      const { rows } = await query(
        `INSERT INTO products (
          ref, label, model, color, category, collection, catalog_id, photo_url,
          price_fr, price_export, price_ch, rrp, qty, stock_status, product_status,
          restock_date, expected_qty, dolibarr_ref, modified_by_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING *`,
        [
          d.ref, d.label, d.model ?? null, d.color ?? null, d.category ?? "NON_CLASSE",
          d.collection ?? null, d.catalogId ?? null, d.photoUrl ?? null,
          d.priceFR ?? null, d.priceExport ?? null, d.priceCH ?? null, d.rrp ?? null,
          d.qty ?? 0, d.stockStatus ?? "EN_STOCK", d.productStatus ?? "NOUVEAU",
          d.restockDate ?? null, d.expectedQty ?? null, d.dolibarrRef ?? null, req.user.id,
        ]
      );
      await logAudit({
        userId: req.user.id,
        action: "PRODUCT_CREATED",
        entity: "products",
        entityId: rows[0].id,
        details: { ref: rows[0].ref, label: rows[0].label },
      });

      res.status(201).json(toCamel(rows[0]));
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: `La référence ${d.ref} existe déjà.` });
      }
      throw err;
    }
  }
);

productsRouter.patch(
  "/:id",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    const columnFor = (f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const sets = [];
    const params = [];
    let i = 1;
    for (const [field, value] of Object.entries(d)) {
      sets.push(`${columnFor(field)} = $${i++}`);
      params.push(value);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Aucun champ à mettre à jour." });
    sets.push(`modified_by_id = $${i++}`);
    params.push(req.user.id);
    sets.push(`last_modified = now()`);

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE products SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: Object.keys(d) },
    });

    res.json(toCamel(rows[0]));
  }
);

// Téléversement direct d'une photo (cf. commentaire en haut du fichier) —
// vérifie que la fiche existe avant d'accepter le fichier, pour ne jamais
// écrire un fichier orphelin sur disque pour un id inexistant.
productsRouter.post(
  "/:id/photo",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res, next) => {
    const { rows } = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    next();
  },
  (req, res, next) => {
    photoUpload.single("photo")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier requis (champ 'photo')." });

    const photoUrl = `${PRODUCT_PHOTOS_URL_PREFIX}${req.file.filename}`;
    const { rows } = await query(
      `UPDATE products SET photo_url = $1, modified_by_id = $2, last_modified = now() WHERE id = $3 RETURNING *`,
      [photoUrl, req.user.id, req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: ["photoUrl"], via: "upload" },
    });

    res.status(201).json(toCamel(rows[0]));
  }
);
