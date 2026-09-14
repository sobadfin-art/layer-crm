// Reconnaissance automatique des colonnes à l'import catalogue —
// cf. cahier-des-charges-import-catalogue.md section 4 (tableau des motifs) et
// docs/cahier-des-charges-champs-import-catalogue.md (inventaire complet des
// champs importables, pour un export Dolibarr enrichi).
// Insensible à la casse, aux espaces et à la ponctuation.
//
// Le socle (ref, model, color, category, priceFR/Export/CH, rrp, qty,
// dolibarrRef) correspond aux colonnes du fichier standard. Les champs
// marqués "enrichi" ci-dessous ne sont là que si le fichier a été
// spécifiquement configuré pour les inclure — s'ils sont absents, ce n'est
// jamais bloquant : les valeurs par défaut habituelles s'appliquent (statut
// stock -> En stock, statut produit -> Nouveau). La photo produit reste hors
// périmètre de cet import (section 9 du cahier des charges) — elle se règle
// via la fiche produit, y compris quand elle est renseignée automatiquement
// par le rapprochement mokenvision.com.

const PATTERNS = {
  ref: ["ref", "sku", "reference", "référence"],
  model: ["model", "modelname", "modele", "modèle"],
  color: ["color", "colors", "couleur"],
  category: ["category", "categorie", "catégorie"],
  priceFR: ["frprice", "pricefr", "prixfrance", "franceprice"],
  priceExport: ["exportprice", "priceexport", "prixexport"],
  priceCH: ["swissprice", "chprice", "prixsuisse"],
  rrp: ["rrp", "prixconseille", "recommendedretailprice"],
  qty: ["stock", "qty", "quantite", "quantité"],
  // Correspondance produit CRM <-> Dolibarr (point 6, retour client) : utilisé
  // seulement si la référence produit existante ne suffit pas.
  dolibarrRef: ["codedolibarr", "dolibarrref", "refdolibarr", "dolibarrcode"],
  // Champs enrichis supplémentaires — jamais dans l'export standard à 9
  // colonnes, mais reconnus si le fichier les fournit.
  collection: ["collection", "collectionname", "gamme"],
  stockStatus: ["stockstatus", "statutstock", "etatstock"],
  productStatus: ["productstatus", "statutproduit", "etatproduit", "lifecycle"],
  restockDate: ["restockdate", "datereassort", "datedereassort", "dateretour"],
  expectedQty: ["expectedqty", "quantiteattendue", "qtyattendue", "quantitereassort", "stockattendu"],
};

export const IMPORT_TARGET_FIELDS = Object.keys(PATTERNS);

function normalizeHeader(header) {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9]/g, ""); // espaces / ponctuation
}

// Retourne { targetField: "en-tête original du fichier" | null, ... }
export function suggestMapping(headers) {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping = {};

  for (const [field, patterns] of Object.entries(PATTERNS)) {
    const normalizedPatterns = patterns.map(normalizeHeader);
    const match = normalizedHeaders.find((h) => normalizedPatterns.includes(h.norm));
    mapping[field] = match ? match.raw : null;
  }

  return mapping;
}
