// Modèles de fichier à télécharger pour les deux assistants d'import
// (catalogue produits et fiches client) — cf. docs/cahier-des-charges-
// import-catalogue.md section 10 ("Fonctionnalité prévue mais pas encore
// développée") et docs/cahier-des-charges-import-fiches-client.md section 11
// (décision revue le 2026-09-16 : le client la demande explicitement malgré
// le fait que le fichier réel soit d'ordinaire un export direct Dolibarr).
// Réutilise la bibliothèque `xlsx` déjà en dépendance, même pattern que
// buildDolibarrXlsx (lib/dolibarrExport.js).
import * as XLSX from "xlsx";

// En-têtes du "socle" catalogue (cf. importMapping.js / cahier des charges
// champs import catalogue section 1) + ID Dolibarr, désormais une colonne à
// part entière du fichier standard (correctif 2026-09-16) plutôt qu'un champ
// enrichi facultatif.
export const CATALOG_TEMPLATE_HEADERS = [
  "Référence",
  "Modèle",
  "Couleur",
  "Catégorie",
  "Prix France",
  "Prix Export",
  "Prix Suisse",
  "Prix conseillé (RRP)",
  "Quantité en stock",
  "ID Dolibarr",
];

const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;

// Excel limite un nom d'onglet à 31 caractères et interdit certains
// caractères (section "1 onglet par catalogue") — jamais de plantage sur un
// nom de catalogue contenant par exemple un "/".
function sanitizeSheetName(rawName, usedNames) {
  const base = String(rawName || "Catalogue").replace(INVALID_SHEET_CHARS, " ").trim().slice(0, 31) || "Catalogue";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const tag = ` (${suffix})`;
    candidate = base.slice(0, 31 - tag.length) + tag;
    suffix++;
  }
  usedNames.add(candidate);
  return candidate;
}

// Un onglet par catalogue existant (règle client 2026-09-16 : "un onglet par
// catalogue") — vierge (en-têtes seuls), prêt à être rempli puis réimporté
// tel quel dans l'assistant d'import (avec sélection de l'onglet
// correspondant). Aucun catalogue existant -> un unique onglet générique
// "Catalogue", pour que le modèle reste utilisable même avant la création du
// premier catalogue.
export function buildCatalogImportTemplate(catalogNames) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  const names = catalogNames && catalogNames.length > 0 ? catalogNames : ["Catalogue"];
  for (const name of names) {
    const sheet = XLSX.utils.aoa_to_sheet([CATALOG_TEMPLATE_HEADERS]);
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(name, usedNames));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// En-têtes du "socle" fiches client (cf. importMappingAccounts.js / cahier
// des charges champs import fiches client), calibrés sur le vocabulaire de
// l'export Dolibarr standard tel que documenté (section 5).
export const ACCOUNTS_TEMPLATE_HEADERS = [
  "Id",
  "Nom",
  "Nom alternatif",
  "État",
  "Adresse",
  "Code postal",
  "Ville",
  "Pays",
  "Téléphone",
  "Tél portable",
  "Email",
  "Numéro TVA",
  "Nom du commercial",
];

// Fichier plat, un seul onglet (contrairement au catalogue, les fiches
// client ne sont pas réparties par catalogue) — cf. décision revue en
// section 11 du cahier des charges.
export function buildAccountsImportTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([ACCOUNTS_TEMPLATE_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Fiches clients");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
