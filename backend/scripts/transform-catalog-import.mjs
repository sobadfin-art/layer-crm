// Transforme le fichier catalogue réel fourni par le client (test_Claude.xlsx,
// onglets "SUN 26" et "OPTICS 26") en 2 CSV prêts pour l'import catalogue
// (écran Administrateur → Catalogue → Import), en appliquant les règles
// validées explicitement par le client le 2026-09-15 :
//
//  1. Sous-lignes couleur des "packs" Sunglasses (ex: MKNI06-TORT-GRN, détail
//     d'un pack MKNI06-PACK) -> EXCLUES. Seule la référence -PACK (l'unité
//     réellement commandable, avec un prix France complet) est importée.
//     Inclut le cas particulier MKNK22 / MKNK21 : la référence y est répétée
//     4 fois à l'identique en colonne D (au lieu d'être vide) — même
//     traitement (exclusion), sans quoi 3 fiches sur 4 seraient écrasées
//     silencieusement par le mécanisme d'import (référence non unique).
//  2. Couleur : extraction best-effort depuis le suffixe de la référence
//     (tout ce qui suit le premier "-") — non garanti fiable, à vérifier
//     fiche par fiche ensuite.
//  3. Prix Optique : aucune colonne France/Export/Suisse dans l'onglet
//     OPTICS — seulement "Marge 2,7" (RRP/2,7) et "Marge 2,9" (RRP/2,9). Sur
//     validation client, le prix "Marge 2,7" est utilisé identique pour les
//     3 prix CRM (France = Export = Suisse).
//  4. Description : notes utiles conservées (ex: "sold with 2 lenses", taille
//     de monture Optique), nettoyées de l'artefact de recopie Excel
//     ". 4colors x N" (compteur qui s'incrémente au hasard sur toutes les
//     lignes de pack du fichier — bug de remplissage, pas une donnée réelle).
//
// Usage : node backend/scripts/transform-catalog-import.mjs <fichier.xlsx> <dossier_sortie>
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const [, , inputPath, outDir] = process.argv;
if (!inputPath || !outDir) {
  console.error("Usage: node transform-catalog-import.mjs <fichier.xlsx> <dossier_sortie>");
  process.exit(1);
}

const wb = XLSX.readFile(inputPath, { cellDates: false });

function cell(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  const cellObj = ws[addr];
  return cellObj ? cellObj.v : undefined;
}

function cleanText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/ /g, " ").trim().replace(/\s+/g, " ");
  return s || null;
}

function cleanNote(v) {
  const s = cleanText(v);
  if (!s) return null;
  // Retire l'artefact de recopie Excel ". Ncolors x N" / ". N colors x N" en fin de texte.
  const cleaned = s.replace(/\.\s*\d+\s*colors?\s*x\s*\d+\s*$/i, ".").trim();
  return cleaned || null;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? round2(v) : null;
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NC" || s === "#REF!") return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? round2(n) : null;
}

function bestEffortColor(ref) {
  const parts = ref.split("-");
  if (parts.length < 2) return null;
  return parts.slice(1).join("-");
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = [
  "Référence",
  "Modèle",
  "Couleur",
  "Catégorie",
  "Prix France",
  "Prix Export",
  "Prix Suisse",
  "RRP",
  "Description",
];

function writeCsv(filePath, rows) {
  const lines = [CSV_HEADERS.join(";")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => csvEscape(row[h])).join(";"));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

// ---------------------------------------------------------------------------
// SUN 26
// ---------------------------------------------------------------------------
const SUN_CATEGORY_MAP = {
  premium: "PREMIUM",
  classic: "CLASSIC",
  goggles: "GOGGLES",
  accessories: "ACCESS",
  display: "DISPLAY",
  merchandising: "MERCH",
  kids: "KIDS",
};

const wsSun = wb.Sheets["SUN 26"];
const sunRows = [];
const sunExcluded = [];
let currentCat = null;

for (let r = 3; r <= 227; r++) {
  const catRaw = cell(wsSun, r, 2);
  const model = cell(wsSun, r, 3);
  const refD = cell(wsSun, r, 4);
  const note = cell(wsSun, r, 5);
  const rrp = cell(wsSun, r, 6);
  const fr = cell(wsSun, r, 7);
  const exp = cell(wsSun, r, 8);
  const ch = cell(wsSun, r, 9);

  if (catRaw) currentCat = catRaw;

  const refDStr = cleanText(refD);
  const isDegenerateDupRef = refDStr === "MKNK22" || refDStr === "MKNK21"; // même réf x4, cf. règle 1

  if (!refDStr || refDStr === "#REF!" || isDegenerateDupRef) {
    sunExcluded.push({ row: r, ref: refDStr, reason: !refDStr ? "sous-ligne pack (réf colonne K uniquement)" : "réf dupliquée (sous-ligne pack déguisée)" });
    continue;
  }

  const catKey = String(currentCat || "").trim().toLowerCase();
  const category = SUN_CATEGORY_MAP[catKey];
  if (!category) {
    sunExcluded.push({ row: r, ref: refDStr, reason: `catégorie non reconnue: ${currentCat}` });
    continue;
  }

  sunRows.push({
    "Référence": refDStr,
    "Modèle": cleanText(model),
    "Couleur": bestEffortColor(refDStr),
    "Catégorie": category,
    "Prix France": toNum(fr),
    "Prix Export": toNum(exp),
    "Prix Suisse": toNum(ch),
    "RRP": toNum(rrp),
    "Description": cleanNote(note),
  });
}

// ---------------------------------------------------------------------------
// OPTICS 26
// ---------------------------------------------------------------------------
const wsOptics = wb.Sheets["OPTICS 26"];
const opticsRows = [];
const opticsExcluded = [];

for (let r = 5; r <= 154; r++) {
  const model = cell(wsOptics, r, 5);
  const boxing = cell(wsOptics, r, 6);
  const ref = cell(wsOptics, r, 7);
  const rrp = cell(wsOptics, r, 8);
  const marge27 = cell(wsOptics, r, 9);

  const refStr = cleanText(ref);
  if (!refStr || refStr === "#REF!") {
    opticsExcluded.push({ row: r, ref: refStr, reason: "référence manquante/invalide" });
    continue;
  }

  const price = toNum(marge27);
  const boxingClean = cleanText(boxing);

  opticsRows.push({
    "Référence": refStr,
    "Modèle": cleanText(model),
    "Couleur": bestEffortColor(refStr),
    "Catégorie": "OPTICS",
    "Prix France": price,
    "Prix Export": price,
    "Prix Suisse": price,
    "RRP": toNum(rrp),
    "Description": boxingClean ? `Taille monture : ${boxingClean}` : null,
  });
}

fs.mkdirSync(outDir, { recursive: true });
const sunPath = path.join(outDir, "import-sunglasses-2026.csv");
const opticsPath = path.join(outDir, "import-optics-2026.csv");
writeCsv(sunPath, sunRows);
writeCsv(opticsPath, opticsRows);

console.log("=== SUN 26 ===");
console.log(`  Retenues : ${sunRows.length}`);
console.log(`  Exclues  : ${sunExcluded.length}`);
for (const x of sunExcluded) console.log(`    ligne ${x.row} (${x.ref ?? "—"}) — ${x.reason}`);
const sunCatCounts = {};
for (const row of sunRows) sunCatCounts[row["Catégorie"]] = (sunCatCounts[row["Catégorie"]] || 0) + 1;
console.log("  Par catégorie:", sunCatCounts);

console.log("\n=== OPTICS 26 ===");
console.log(`  Retenues : ${opticsRows.length}`);
console.log(`  Exclues  : ${opticsExcluded.length}`);
for (const x of opticsExcluded) console.log(`    ligne ${x.row} (${x.ref ?? "—"}) — ${x.reason}`);

console.log(`\nFichiers écrits :\n  ${sunPath}\n  ${opticsPath}`);
