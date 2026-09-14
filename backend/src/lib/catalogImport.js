// Logique métier de l'import catalogue — cf. cahier-des-charges-import-catalogue.md
// sections 4, 6, 7 et docs/cahier-des-charges-champs-import-catalogue.md
// (champs enrichis). Séparée des routes pour rester testable indépendamment
// de HTTP.
import { pool } from "./db.js";
import { resolveCategory } from "./categories.js";

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = toNumber(v);
  return n === null ? null : Math.trunc(n);
}

function normalizeText(v) {
  return v
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const STOCK_STATUSES = ["EN_STOCK", "RUPTURE", "REASSORT_PREVU"];
const STOCK_LABEL_TO_ENUM = {
  "en stock": "EN_STOCK",
  enstock: "EN_STOCK",
  instock: "EN_STOCK",
  rupture: "RUPTURE",
  "out of stock": "RUPTURE",
  outofstock: "RUPTURE",
  "réassort prévu": "REASSORT_PREVU",
  "reassort prevu": "REASSORT_PREVU",
  reassort: "REASSORT_PREVU",
};

// Ne rejette jamais une valeur inconnue : repli sur "En stock" (valeur par
// défaut habituelle à la création), jamais deviné au hasard — même logique
// que resolveCategory.
function resolveStockStatus(rawValue) {
  if (!rawValue) return "EN_STOCK";
  const upper = String(rawValue).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (STOCK_STATUSES.includes(upper)) return upper;
  return STOCK_LABEL_TO_ENUM[normalizeText(rawValue)] || "EN_STOCK";
}

const PRODUCT_STATUSES = ["NOUVEAU", "ACTIF", "DISCONTINUE"];
const PRODUCT_STATUS_LABEL_TO_ENUM = {
  nouveau: "NOUVEAU",
  new: "NOUVEAU",
  actif: "ACTIF",
  active: "ACTIF",
  discontinue: "DISCONTINUE",
  discontinué: "DISCONTINUE",
  discontinued: "DISCONTINUE",
  arrete: "DISCONTINUE",
  arrêté: "DISCONTINUE",
};

// Repli sur "Nouveau" (valeur par défaut habituelle à la création) pour toute
// valeur non reconnue.
function resolveProductStatus(rawValue) {
  if (!rawValue) return "NOUVEAU";
  const upper = String(rawValue).trim().toUpperCase();
  if (PRODUCT_STATUSES.includes(upper)) return upper;
  return PRODUCT_STATUS_LABEL_TO_ENUM[normalizeText(rawValue)] || "NOUVEAU";
}

// Accepte ISO (AAAA-MM-JJ...) ou JJ/MM/AAAA. Tout autre format -> ignoré
// (jamais deviné) plutôt que de bloquer la ligne : la date de réassort reste
// vide, à corriger manuellement.
function parseDate(rawValue) {
  const s = String(rawValue ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// Transforme les lignes brutes du fichier en lignes classifiées, prêtes à être
// résumées (étape 3/4) ou appliquées (étape 5), en fonction du mapping choisi.
// mapping: { ref: "En-tête fichier"|null, model: ..., color: ..., category: ...,
//            priceFR: ..., priceExport: ..., priceCH: ..., rrp: ..., qty: ... }
export function classifyRows(rows, mapping) {
  if (!mapping.ref) {
    throw new Error("Le champ Référence doit être mappé — c'est le seul obligatoire.");
  }

  return rows.map((row, index) => {
    const ref = String(row[mapping.ref] ?? "").trim();
    if (!ref) {
      return { rowIndex: index, ref: null, error: "Référence manquante" };
    }

    const fields = {}; // uniquement les champs réellement mappés (jamais écraser le reste)
    if (mapping.model) fields.model = String(row[mapping.model] ?? "").trim() || null;
    if (mapping.color) fields.color = String(row[mapping.color] ?? "").trim() || null;
    if (mapping.category) fields.category = resolveCategory(row[mapping.category]);
    if (mapping.priceFR) fields.price_fr = toNumber(row[mapping.priceFR]);
    if (mapping.priceExport) fields.price_export = toNumber(row[mapping.priceExport]);
    if (mapping.priceCH) fields.price_ch = toNumber(row[mapping.priceCH]);
    if (mapping.rrp) fields.rrp = toNumber(row[mapping.rrp]);
    if (mapping.qty) fields.qty = toInt(row[mapping.qty]);
    if (mapping.dolibarrRef) fields.dolibarr_ref = String(row[mapping.dolibarrRef] ?? "").trim() || null;

    // --- Champs enrichis (jamais dans l'export standard à 9 colonnes) ---
    if (mapping.collection) fields.collection = String(row[mapping.collection] ?? "").trim() || null;
    if (mapping.stockStatus) fields.stock_status = resolveStockStatus(row[mapping.stockStatus]);
    if (mapping.productStatus) fields.product_status = resolveProductStatus(row[mapping.productStatus]);
    if (mapping.restockDate) fields.restock_date = parseDate(row[mapping.restockDate]);
    if (mapping.expectedQty) fields.expected_qty = toInt(row[mapping.expectedQty]);

    return { rowIndex: index, ref, fields };
  });
}

// Étape 4 : résumé sans écriture (nouvelles / mises à jour / erreurs).
export async function summarizeImport(classified) {
  const validRefs = classified.filter((r) => !r.error).map((r) => r.ref);
  const errorCount = classified.length - validRefs.length;

  let existingRefs = new Set();
  if (validRefs.length > 0) {
    const { rows } = await pool.query(
      "SELECT ref FROM products WHERE ref = ANY($1::text[])",
      [validRefs]
    );
    existingRefs = new Set(rows.map((r) => r.ref));
  }

  const newCount = validRefs.filter((ref) => !existingRefs.has(ref)).length;
  const updateCount = validRefs.filter((ref) => existingRefs.has(ref)).length;

  return { total: classified.length, newCount, updateCount, errorCount };
}

const COLUMN_FOR_FIELD = {
  model: "model",
  color: "color",
  category: "category",
  price_fr: "price_fr",
  price_export: "price_export",
  price_ch: "price_ch",
  rrp: "rrp",
  qty: "qty",
  dolibarr_ref: "dolibarr_ref",
  collection: "collection",
  stock_status: "stock_status",
  product_status: "product_status",
  restock_date: "restock_date",
  expected_qty: "expected_qty",
};

// Étape 5 : application réelle, en transaction. `mode` ∈
// create_and_update (défaut) | create_only | update_only.
// Sécurités appliquées (section 7) : aucune suppression, aucun écrasement d'un
// champ non mappé, catégorie inconnue -> Non classé (jamais rejetée).
export async function applyImport({ classified, catalogId, mode, userId }) {
  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = classified.filter((r) => r.error).length;

  try {
    await client.query("BEGIN");

    const validRows = classified.filter((r) => !r.error);
    const refs = validRows.map((r) => r.ref);
    const { rows: existingRows } = refs.length
      ? await client.query("SELECT ref FROM products WHERE ref = ANY($1::text[])", [refs])
      : { rows: [] };
    const existingRefs = new Set(existingRows.map((r) => r.ref));

    for (const row of validRows) {
      const exists = existingRefs.has(row.ref);

      if (exists && mode === "create_only") { skipped++; continue; }
      if (!exists && mode === "update_only") { skipped++; continue; }

      if (!exists) {
        const label = [row.fields.model, row.fields.color].filter(Boolean).join(" ") || row.ref;
        await client.query(
          `INSERT INTO products (
            ref, label, model, color, category, collection, catalog_id,
            price_fr, price_export, price_ch, rrp, qty,
            stock_status, product_status, restock_date, expected_qty,
            dolibarr_ref, modified_by_id
          )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            row.ref,
            label,
            row.fields.model ?? null,
            row.fields.color ?? null,
            row.fields.category ?? "NON_CLASSE",
            row.fields.collection ?? null,
            catalogId,
            row.fields.price_fr ?? null,
            row.fields.price_export ?? null,
            row.fields.price_ch ?? null,
            row.fields.rrp ?? null,
            row.fields.qty ?? 0,
            row.fields.stock_status ?? "EN_STOCK",
            row.fields.product_status ?? "NOUVEAU",
            row.fields.restock_date ?? null,
            row.fields.expected_qty ?? null,
            row.fields.dolibarr_ref ?? null,
            userId,
          ]
        );
        created++;
      } else {
        // Ne touche qu'aux colonnes réellement mappées + le rattachement au catalogue
        // (l'import rattache toujours les références au catalogue choisi, section 3).
        const sets = ["catalog_id = $1", "modified_by_id = $2", "last_modified = now()"];
        const params = [catalogId, userId];
        let i = 3;
        for (const [field, value] of Object.entries(row.fields)) {
          sets.push(`${COLUMN_FOR_FIELD[field]} = $${i++}`);
          params.push(value);
        }
        params.push(row.ref);
        await client.query(`UPDATE products SET ${sets.join(", ")} WHERE ref = $${i}`, params);
        updated++;
      }
    }

    await client.query(
      `INSERT INTO catalog_import_logs (catalog_id, created_count, updated_count, error_count, imported_by_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [catalogId, created, updated, errors, userId]
    );

    await client.query("COMMIT");
    return { created, updated, skipped, errors, total: classified.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
