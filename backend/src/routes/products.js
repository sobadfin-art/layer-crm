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

// Rattachement multi-catalogue (correctif 2026-09-16, fiche corrective
// "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", points 8/9) : un produit peut
// désormais appartenir SIMULTANÉMENT à plusieurs catalogues (les catalogues
// ne sont plus mutuellement exclusifs — ex. une référence "2026 SUNGLASSES"
// ET "OPTIC 2026" en même temps). Source de vérité = table de jointure
// `product_catalogs` (migration 020) ; l'ancienne colonne `products.catalog_id`
// (un seul catalogue à la fois) n'est plus lue ni écrite par ce fichier —
// conservée telle quelle en base pour ne rien casser d'irréversible, mais
// purement historique désormais. Toujours renvoyée en tableaux `catalogIds`/
// `catalogNames` (même schéma que `photoUrls`), y compris tableau vide pour
// une référence "Sans catalogue" (cf. section 11 du cahier des charges
// import catalogue — suppression d'un catalogue).
const PRODUCT_JOINS = `
  LEFT JOIN LATERAL (
    SELECT array_agg(pc.catalog_id ORDER BY c.name) AS catalog_ids,
           array_agg(c.name ORDER BY c.name) AS catalog_names
    FROM product_catalogs pc
    JOIN catalogs c ON c.id = pc.catalog_id
    WHERE pc.product_id = p.id
  ) pcagg ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(url ORDER BY position) AS photo_urls
    FROM product_photos WHERE product_id = p.id
  ) pp ON true
`;
const PRODUCT_SELECT = `
  SELECT p.*,
         COALESCE(pcagg.catalog_ids, ARRAY[]::uuid[]) AS catalog_ids,
         COALESCE(pcagg.catalog_names, ARRAY[]::text[]) AS catalog_names,
         COALESCE(pp.photo_urls, ARRAY[]::text[]) AS photo_urls
  FROM products p
  ${PRODUCT_JOINS}
`;

async function fetchProductById(id) {
  const { rows } = await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] || null;
}

async function setProductCatalogs(productId, catalogIds) {
  await query("DELETE FROM product_catalogs WHERE product_id = $1", [productId]);
  for (const catalogId of catalogIds) {
    await query(
      "INSERT INTO product_catalogs (product_id, catalog_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [productId, catalogId]
    );
  }
}

// Lecture ouverte (catalogue de référence + prise de commande ont besoin de tout voir).
productsRouter.get("/", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const clauses = [];
  const params = [];
  let i = 1;

  // Plusieurs catalogues doivent rester sélectionnables simultanément à la prise
  // de commande (section 2 handoff) : ?catalogId=A&catalogId=B ou ?catalogId=A,B
  // — un produit matche dès qu'il appartient à AU MOINS UN des catalogues
  // demandés (rattachement multi-catalogue, cf. commentaire plus haut).
  if (req.query.catalogId) {
    const catalogIds = Array.isArray(req.query.catalogId)
      ? req.query.catalogId
      : String(req.query.catalogId).split(",");
    clauses.push(
      `EXISTS (SELECT 1 FROM product_catalogs pc0 WHERE pc0.product_id = p.id AND pc0.catalog_id = ANY($${i++}::uuid[]))`
    );
    params.push(catalogIds);
  }
  if (req.query.category) {
    clauses.push(`p.category = $${i++}`);
    params.push(req.query.category);
  }
  // Filtres écran Administrateur (PDF section 1.2 : "Filtres par catégorie,
  // catalogue, stock et statut produit") — optionnels, jamais utilisés par
  // l'écran de prise de commande (Catalogue.jsx), qui ne les envoie pas.
  if (req.query.stockStatus) {
    clauses.push(`p.stock_status = $${i++}`);
    params.push(req.query.stockStatus);
  }
  if (req.query.productStatus) {
    clauses.push(`p.product_status = $${i++}`);
    params.push(req.query.productStatus);
  }
  if (req.query.noPhoto === "true") {
    clauses.push(`p.photo_url IS NULL`);
  }
  if (req.query.search) {
    clauses.push(`(p.label ILIKE $${i} OR p.model ILIKE $${i} OR p.ref ILIKE $${i})`);
    params.push(`%${req.query.search}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(`${PRODUCT_SELECT} ${where} ORDER BY p.label`, params);
  res.json(toCamelList(rows));
});

productsRouter.get("/:id", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const product = await fetchProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Référence introuvable." });
  res.json(toCamel(product));
});

const productSchema = z.object({
  ref: z.string().min(1),
  label: z.string().min(1),
  model: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  category: z.enum([...CATEGORIES, "NON_CLASSE"]).optional(),
  collection: z.string().optional().nullable(),
  // Descriptif produit (PDF Administrateur section 2 "Identification") —
  // jamais alimenté par l'import en masse, uniquement par la création/
  // modification manuelle d'une référence (cf. migration 016).
  description: z.string().optional().nullable(),
  // Rattachement multi-catalogue (point 8 de la fiche corrective) — remplace
  // l'ancien `catalogId` unique. Tableau (éventuellement vide = "Sans
  // catalogue") plutôt qu'une seule valeur, cf. commentaire au-dessus de
  // `PRODUCT_JOINS`.
  catalogIds: z.array(z.string().uuid()).optional(),
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
          ref, label, model, color, category, collection, description, photo_url,
          price_fr, price_export, price_ch, rrp, qty, stock_status, product_status,
          restock_date, expected_qty, dolibarr_ref, modified_by_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING id`,
        [
          d.ref, d.label, d.model ?? null, d.color ?? null, d.category ?? "NON_CLASSE",
          d.collection ?? null, d.description ?? null, d.photoUrl ?? null,
          d.priceFR ?? null, d.priceExport ?? null, d.priceCH ?? null, d.rrp ?? null,
          d.qty ?? 0, d.stockStatus ?? "EN_STOCK", d.productStatus ?? "NOUVEAU",
          d.restockDate ?? null, d.expectedQty ?? null, d.dolibarrRef ?? null, req.user.id,
        ]
      );
      const productId = rows[0].id;
      if (d.catalogIds?.length) {
        await setProductCatalogs(productId, d.catalogIds);
      }
      await logAudit({
        userId: req.user.id,
        action: "PRODUCT_CREATED",
        entity: "products",
        entityId: productId,
        details: { ref: d.ref, label: d.label },
      });

      res.status(201).json(toCamel(await fetchProductById(productId)));
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
    const { catalogIds, ...d } = parsed.data;

    // Bug réel corrigé (2026-09-16, fiche corrective "CORRECTIFS CRM — PROFIL
    // ADMINISTRATEUR", point 4) : une conversion camelCase -> snake_case
    // générique ("priceFR" -> "price_f_r" au lieu de "price_fr", "priceCH" ->
    // "price_c_h" au lieu de "price_ch") produisait un UPDATE sur des colonnes
    // inexistantes dès que le formulaire complet de la fiche produit était
    // enregistré (il envoie toujours ces deux champs), et donc une erreur 500
    // systématique — perçue par l'administrateur comme un bug de changement de
    // statut de stock, alors qu'elle touchait en réalité N'IMPORTE QUELLE
    // modification via ce formulaire (Rupture/Réassort n'étaient que les
    // statuts testés). Remplacé par une correspondance explicite, jamais
    // recalculée, pour ne plus jamais dépendre d'une règle de casse implicite.
    const COLUMN_FOR_FIELD = {
      ref: "ref",
      label: "label",
      model: "model",
      color: "color",
      category: "category",
      collection: "collection",
      description: "description",
      photoUrl: "photo_url",
      dolibarrRef: "dolibarr_ref",
      priceFR: "price_fr",
      priceExport: "price_export",
      priceCH: "price_ch",
      rrp: "rrp",
      qty: "qty",
      stockStatus: "stock_status",
      productStatus: "product_status",
      restockDate: "restock_date",
      expectedQty: "expected_qty",
    };
    const columnFor = (f) => {
      const column = COLUMN_FOR_FIELD[f];
      if (!column) throw new Error(`Champ produit inconnu pour la mise à jour : ${f}`);
      return column;
    };
    const sets = [];
    const params = [];
    let i = 1;
    for (const [field, value] of Object.entries(d)) {
      sets.push(`${columnFor(field)} = $${i++}`);
      params.push(value);
    }
    if (sets.length === 0 && catalogIds === undefined) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour." });
    }

    if (sets.length > 0) {
      sets.push(`modified_by_id = $${i++}`);
      params.push(req.user.id);
      sets.push(`last_modified = now()`);
      params.push(req.params.id);
      const { rows } = await query(
        `UPDATE products SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    } else {
      const { rows } = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    }

    // Rattachement multi-catalogue (point 8) : remplace l'ensemble complet des
    // catalogues de la référence par celui envoyé — jamais un ajout/retrait
    // partiel implicite, pour que le formulaire (bulles cochées/décochées)
    // reflète exactement ce qui est enregistré.
    if (catalogIds !== undefined) {
      await setProductCatalogs(req.params.id, catalogIds);
      if (sets.length === 0) {
        await query(
          "UPDATE products SET modified_by_id = $1, last_modified = now() WHERE id = $2",
          [req.user.id, req.params.id]
        );
      }
    }

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: Object.keys(d), catalogIds: catalogIds !== undefined ? catalogIds : undefined },
    });

    res.json(toCamel(await fetchProductById(req.params.id)));
  }
);

// Galerie photo — jusqu'à 5 photos par référence (fiche corrective V2
// Administrateur section 5 "Gestion des photos"). `products.photo_url` reste
// la "photo de couverture" (position 0 de la galerie), pour ne rien casser
// chez les écrans qui n'affichent qu'une seule vignette (Catalogue.jsx,
// NewOrder.jsx, colonne photo de CatalogueAdmin.jsx, script de rapprochement
// mokenvision) — resynchronisée à chaque ajout/suppression, jamais en dehors
// de ce fichier.
const MAX_PRODUCT_PHOTOS = 5;

async function syncCoverPhoto(productId, userId) {
  await query(
    `UPDATE products SET
       photo_url = (SELECT url FROM product_photos WHERE product_id = $1 ORDER BY position LIMIT 1),
       modified_by_id = $2, last_modified = now()
     WHERE id = $1`,
    [productId, userId]
  );
}

async function getPhotos(productId) {
  const { rows } = await query(
    "SELECT * FROM product_photos WHERE product_id = $1 ORDER BY position",
    [productId]
  );
  return toCamelList(rows);
}

// Détail de la galerie (avec id de chaque photo, nécessaire pour la
// suppression/le réordonnancement côté Admin produits) — réservé à
// l'administrateur comme le reste de la gestion de galerie ; les autres
// écrans (Catalogue produits, prise de commande) se contentent du tableau
// `photoUrls` déjà renvoyé par GET /products et GET /products/:id.
productsRouter.get(
  "/:id/photos",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    res.json(await getPhotos(req.params.id));
  }
);

// Ajout d'une photo à la galerie par URL externe (produit déjà en vente sur
// mokenvision.com) — utilisé par le script de rapprochement automatique
// (scripts/mokenvision-photos/match-photos-to-catalog.mjs) et par tout futur
// import qui fournirait directement une URL plutôt qu'un fichier. Même
// limite de 5 photos et même resynchronisation de la couverture que
// l'ajout par téléversement ci-dessous.
productsRouter.post(
  "/:id/photos/url",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const parsed = z.object({ url: photoUrlField }).safeParse(req.body);
    if (!parsed.success || !parsed.data.url) {
      return res.status(400).json({ error: "URL de photo requise (http(s) ou fichier téléversé)." });
    }

    const { rows } = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    const { rows: countRows } = await query(
      "SELECT count(*)::int AS n FROM product_photos WHERE product_id = $1",
      [req.params.id]
    );
    if (countRows[0].n >= MAX_PRODUCT_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_PRODUCT_PHOTOS} photos par produit.` });
    }

    const { rows: posRows } = await query(
      "SELECT COALESCE(max(position) + 1, 0) AS next FROM product_photos WHERE product_id = $1",
      [req.params.id]
    );
    await query(
      "INSERT INTO product_photos (product_id, url, position) VALUES ($1, $2, $3)",
      [req.params.id, parsed.data.url, posRows[0].next]
    );
    await syncCoverPhoto(req.params.id, req.user.id);

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: ["photoUrls"], via: "url" },
    });

    const productRow = await fetchProductById(req.params.id);
    res.status(201).json({ product: toCamel(productRow), photos: await getPhotos(req.params.id) });
  }
);

// Ajout d'une photo à la galerie (alternative à une URL externe, cf.
// commentaire plus haut) — vérifie que la fiche existe et qu'elle n'a pas
// déjà 5 photos avant d'accepter le fichier, pour ne jamais écrire un
// fichier orphelin ou dépasser la limite sur disque.
productsRouter.post(
  "/:id/photos",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res, next) => {
    const { rows } = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Référence introuvable." });
    const { rows: countRows } = await query(
      "SELECT count(*)::int AS n FROM product_photos WHERE product_id = $1",
      [req.params.id]
    );
    if (countRows[0].n >= MAX_PRODUCT_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_PRODUCT_PHOTOS} photos par produit.` });
    }
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
    const { rows: posRows } = await query(
      "SELECT COALESCE(max(position) + 1, 0) AS next FROM product_photos WHERE product_id = $1",
      [req.params.id]
    );
    await query(
      "INSERT INTO product_photos (product_id, url, position) VALUES ($1, $2, $3)",
      [req.params.id, photoUrl, posRows[0].next]
    );
    await syncCoverPhoto(req.params.id, req.user.id);

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: ["photoUrls"], via: "upload" },
    });

    const productRow = await fetchProductById(req.params.id);
    res.status(201).json({ product: toCamel(productRow), photos: await getPhotos(req.params.id) });
  }
);

// Suppression d'une photo de la galerie — renumérote les positions restantes
// pour rester contiguës (0..n-1) et resynchronise la couverture.
productsRouter.delete(
  "/:id/photos/:photoId",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const { rows } = await query(
      "DELETE FROM product_photos WHERE id = $1 AND product_id = $2 RETURNING *",
      [req.params.photoId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Photo introuvable." });

    const { rows: remaining } = await query(
      "SELECT id FROM product_photos WHERE product_id = $1 ORDER BY position",
      [req.params.id]
    );
    for (let idx = 0; idx < remaining.length; idx++) {
      await query("UPDATE product_photos SET position = $1 WHERE id = $2", [idx, remaining[idx].id]);
    }
    await syncCoverPhoto(req.params.id, req.user.id);

    await logAudit({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: req.params.id,
      details: { fields: ["photoUrls"], via: "delete" },
    });

    const productRow = await fetchProductById(req.params.id);
    res.json({ product: toCamel(productRow), photos: await getPhotos(req.params.id) });
  }
);

// Réordonnancement de la galerie (glisser en tête = nouvelle couverture) —
// reçoit la liste complète des ids de photos de la fiche dans le nouvel
// ordre souhaité ; rejeté si elle ne correspond pas exactement aux photos
// existantes, pour ne jamais désynchroniser la galerie.
productsRouter.patch(
  "/:id/photos/reorder",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const parsed = z.object({ order: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { rows: existing } = await query(
      "SELECT id FROM product_photos WHERE product_id = $1",
      [req.params.id]
    );
    const existingIds = new Set(existing.map((r) => r.id));
    const orderedIds = parsed.data.order;
    if (
      orderedIds.length !== existingIds.size ||
      !orderedIds.every((id) => existingIds.has(id))
    ) {
      return res.status(400).json({ error: "La liste doit correspondre exactement aux photos existantes." });
    }

    // Deux passes : la contrainte UNIQUE(product_id, position) rejette toute
    // écriture qui ferait coexister deux photos sur la même position, ce qui
    // arrive dès qu'un réordonnancement n'est pas qu'un simple décalage vers
    // le bas (ex. faire passer la dernière photo en première). On bascule
    // donc d'abord toutes les positions vers une plage négative (jamais
    // utilisée ailleurs), puis on pose les positions finales — aucune des
    // deux passes ne peut alors entrer en collision avec une valeur encore
    // détenue par une autre ligne.
    for (let idx = 0; idx < orderedIds.length; idx++) {
      await query("UPDATE product_photos SET position = $1 WHERE id = $2", [-(idx + 1), orderedIds[idx]]);
    }
    for (let idx = 0; idx < orderedIds.length; idx++) {
      await query("UPDATE product_photos SET position = $1 WHERE id = $2", [idx, orderedIds[idx]]);
    }
    await syncCoverPhoto(req.params.id, req.user.id);

    const productRow = await fetchProductById(req.params.id);
    res.json({ product: toCamel(productRow), photos: await getPhotos(req.params.id) });
  }
);
