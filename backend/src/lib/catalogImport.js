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
    if (mapping.description) fields.description = String(row[mapping.description] ?? "").trim() || null;

    return { rowIndex: index, ref, fields };
  });
}

// Règle de cohérence Référence <-> ID Dolibarr (correctif 2026-09-16, demande
// client : "rajouter le code produit ID Dolibarr pour s'assurer des bonnes
// connexions"). Deux principes, vérifiés dans les deux sens :
//   1. Une référence donnée ne peut avoir qu'UN SEUL ID Dolibarr — jamais
//      deux ID différents pour la même référence, que ce soit à l'intérieur
//      du fichier importé (ex. deux onglets/catalogues qui se contredisent)
//      ou entre le fichier et ce qui est déjà enregistré en base (tous
//      catalogues confondus).
//   2. Symétriquement, un ID Dolibarr donné ne peut être rattaché qu'à UNE
//      SEULE référence — jamais deux références différentes partageant le
//      même ID.
// En revanche, et c'est explicitement toléré (demande client : "un catalogue
// peut avoir des références qui existent sur plusieurs catalogues") : la
// même référence peut parfaitement apparaître dans plusieurs catalogues (un
// import ultérieur dans un autre catalogue la rattache simplement à ce
// nouveau catalogue, cf. applyImport) — ce n'est un conflit QUE si l'ID
// Dolibarr associé change. Les lignes en conflit sont rejetées (comptées
// comme erreurs, jamais importées silencieusement avec un ID douteux) plutôt
// que de bloquer tout le fichier — même philosophie que "Référence
// manquante" dans classifyRows.
export async function validateDolibarrIds(classified) {
  const withId = classified.filter((r) => !r.error && r.fields?.dolibarr_ref);
  if (withId.length === 0) return classified;

  // 1) Cohérence interne au fichier/onglet en cours d'import.
  const refToIds = new Map();
  const idToRefs = new Map();
  for (const row of withId) {
    const id = row.fields.dolibarr_ref;
    if (!refToIds.has(row.ref)) refToIds.set(row.ref, new Set());
    refToIds.get(row.ref).add(id);
    if (!idToRefs.has(id)) idToRefs.set(id, new Set());
    idToRefs.get(id).add(row.ref);
  }

  // 2) Cohérence avec l'existant en base, tous catalogues confondus (c'est
  // précisément ce qui permet de tolérer une référence déjà présente dans un
  // autre catalogue : on ne compare que son ID Dolibarr, jamais son
  // catalogue de rattachement).
  const ids = [...new Set(withId.map((r) => r.fields.dolibarr_ref))];
  const refs = [...new Set(withId.map((r) => r.ref))];
  const [byId, byRef] = await Promise.all([
    ids.length
      ? pool.query("SELECT ref, dolibarr_ref FROM products WHERE dolibarr_ref = ANY($1::text[])", [ids])
      : { rows: [] },
    refs.length
      ? pool.query("SELECT ref, dolibarr_ref FROM products WHERE ref = ANY($1::text[]) AND dolibarr_ref IS NOT NULL", [refs])
      : { rows: [] },
  ]);
  const dbRefById = new Map(byId.rows.map((r) => [r.dolibarr_ref, r.ref]));
  const dbIdByRef = new Map(byRef.rows.map((r) => [r.ref, r.dolibarr_ref]));

  return classified.map((row) => {
    if (row.error || !row.fields?.dolibarr_ref) return row;
    const id = row.fields.dolibarr_ref;

    const idsForThisRef = [...refToIds.get(row.ref)];
    if (idsForThisRef.length > 1) {
      return { ...row, error: `ID Dolibarr incohérent dans le fichier pour la référence "${row.ref}" (${idsForThisRef.join(" / ")}) — une seule référence ne peut avoir qu'un seul ID Dolibarr` };
    }
    const refsForThisId = [...idToRefs.get(id)].filter((r) => r !== row.ref);
    if (refsForThisId.length > 0) {
      return { ...row, error: `ID Dolibarr "${id}" utilisé par plusieurs références dans le fichier ("${row.ref}", "${refsForThisId.join('", "')}") — un ID Dolibarr ne peut correspondre qu'à un seul produit` };
    }
    const knownId = dbIdByRef.get(row.ref);
    if (knownId && knownId !== id) {
      return { ...row, error: `La référence "${row.ref}" est déjà enregistrée avec l'ID Dolibarr "${knownId}" — correction manuelle requise avant de la réimporter avec "${id}"` };
    }
    const knownRef = dbRefById.get(id);
    if (knownRef && knownRef !== row.ref) {
      return { ...row, error: `L'ID Dolibarr "${id}" est déjà utilisé par la référence "${knownRef}"` };
    }
    return row;
  });
}

// Détail des lignes rejetées (point 13/14 de la fiche corrective "CORRECTIFS
// CRM — PROFIL ADMINISTRATEUR" : "ne pas faire échouer silencieusement tout
// le fichier ... afficher lignes rejetées + motif du rejet"). Jusqu'ici seul
// le COMPTE des erreurs remontait jusqu'à l'écran (`errorCount`) — le motif
// existait déjà par ligne (`row.error`, calculé par `classifyRows`/
// `validateDolibarrIds`) mais n'était jamais renvoyé au client. Plafonné pour
// ne jamais renvoyer une réponse démesurée sur un très gros fichier fautif.
const MAX_ERROR_DETAILS = 50;
function extractErrorDetails(classified) {
  const errorRows = classified.filter((r) => r.error);
  return {
    errorDetails: errorRows.slice(0, MAX_ERROR_DETAILS).map((r) => ({
      // +2 : +1 pour repasser en 1-indexé, +1 pour la ligne d'en-têtes
      // elle-même — le numéro affiché correspond à la vraie ligne du fichier.
      row: r.rowIndex + 2,
      ref: r.ref || null,
      error: r.error,
    })),
    errorDetailsTruncated: errorRows.length > MAX_ERROR_DETAILS,
  };
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

  return { total: classified.length, newCount, updateCount, errorCount, ...extractErrorDetails(classified) };
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
  description: "description",
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
        const { rows: insertedRows } = await client.query(
          `INSERT INTO products (
            ref, label, model, color, category, collection,
            price_fr, price_export, price_ch, rrp, qty,
            stock_status, product_status, restock_date, expected_qty,
            dolibarr_ref, description, modified_by_id
          )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           RETURNING id`,
          [
            row.ref,
            label,
            row.fields.model ?? null,
            row.fields.color ?? null,
            row.fields.category ?? "NON_CLASSE",
            row.fields.collection ?? null,
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
            row.fields.description ?? null,
            userId,
          ]
        );
        // Rattachement multi-catalogue (correctif 2026-09-16, fiche corrective
        // "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", point 8) : le catalogue
        // choisi à l'étape 1 de l'assistant (section 3 du cahier des charges)
        // devient une AFFILIATION parmi d'autres possibles, plus jamais la
        // seule — cf. `product_catalogs` (migration 020).
        await client.query(
          "INSERT INTO product_catalogs (product_id, catalog_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [insertedRows[0].id, catalogId]
        );
        created++;
        // Une même référence peut apparaître plusieurs fois dans un seul
        // fichier importé (doublon de ligne au sein d'un même onglet, cf.
        // fichier réel du 2026-09-16) — sans cette mise à jour immédiate,
        // `existingRefs` resterait périmé pour le reste de la boucle et une
        // seconde occurrence de la même référence tenterait un second INSERT
        // au lieu d'une mise à jour, violant la contrainte UNIQUE(ref).
        existingRefs.add(row.ref);
      } else {
        // Ne touche qu'aux colonnes réellement mappées. Le rattachement au
        // catalogue choisi (section 3) s'AJOUTE désormais aux catalogues déjà
        // portés par cette référence au lieu de les remplacer (point 8/7 bis :
        // une référence peut exister dans plusieurs catalogues à la fois) —
        // c'est explicitement ce que permet la règle de cohérence Référence
        // <-> ID Dolibarr du correctif précédent (section 7 bis du cahier des
        // charges import catalogue) : réimporter une référence déjà présente
        // ailleurs ne la lui retire plus, elle l'ajoute simplement ici aussi.
        const sets = ["modified_by_id = $1", "last_modified = now()"];
        const params = [userId];
        let i = 2;
        for (const [field, value] of Object.entries(row.fields)) {
          sets.push(`${COLUMN_FOR_FIELD[field]} = $${i++}`);
          params.push(value);
        }
        params.push(row.ref);
        const { rows: updatedRows } = await client.query(
          `UPDATE products SET ${sets.join(", ")} WHERE ref = $${i} RETURNING id`,
          params
        );
        await client.query(
          "INSERT INTO product_catalogs (product_id, catalog_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [updatedRows[0].id, catalogId]
        );
        updated++;
      }
    }

    await client.query(
      `INSERT INTO catalog_import_logs (catalog_id, created_count, updated_count, error_count, imported_by_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [catalogId, created, updated, errors, userId]
    );

    await client.query("COMMIT");
    return { created, updated, skipped, errors, total: classified.length, ...extractErrorDetails(classified) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
