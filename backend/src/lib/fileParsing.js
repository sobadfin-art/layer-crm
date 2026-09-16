// Parsing CSV/XLS/XLSX unifié via SheetJS (pure JS, pas de binaire natif —
// important dans cet environnement où les téléchargements de binaires externes
// sont bloqués). Un seul chemin de code pour les 3 formats acceptés par le
// cahier des charges (section 2).
import * as XLSX from "xlsx";

function isCsv(originalName, buffer) {
  if (/\.csv$/i.test(originalName || "")) return true;
  // Les .xlsx/.xls commencent par une signature binaire connue (ZIP "PK" ou OLE2) ;
  // à défaut, on traite le fichier comme du texte (CSV).
  const sig = buffer.subarray(0, 4);
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b; // "PK"
  const isOle2 = sig[0] === 0xd0 && sig[1] === 0xcf;
  return !isZip && !isOle2;
}

// sheetName (optionnel) : sélectionne l'onglet à lire — nécessaire depuis
// que le client fournit ses fichiers catalogue avec "1 onglet par
// catalogue" (correctif 2026-09-16, cf. docs/cahier-des-charges-import-
// catalogue.md). Absent -> premier onglet du classeur (comportement
// inchangé pour un fichier mono-onglet, ex. import fiches client). Le nom
// d'onglet demandé mais introuvable est une erreur explicite plutôt qu'un
// repli silencieux sur un autre onglet (jamais deviner quel catalogue
// importer). `sheetNames` est toujours renvoyé pour permettre à l'appelant
// de proposer un sélecteur d'onglet si le fichier en contient plusieurs.
export function parseSpreadsheet(buffer, originalName, sheetName) {
  // SheetJS devine parfois mal l'encodage d'un CSV brut (mojibake sur les
  // accents). On décode nous-mêmes le CSV en UTF-8 et on le passe en tant que
  // chaîne, ce qui contourne complètement sa détection de codepage.
  let workbook;
  if (isCsv(originalName, buffer)) {
    let text = buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM UTF-8 éventuel
    workbook = XLSX.read(text, { type: "string", raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer" });
  }
  const sheetNames = workbook.SheetNames;
  let targetSheet;
  if (sheetName) {
    if (!sheetNames.includes(sheetName)) {
      throw new Error(`L'onglet "${sheetName}" est introuvable dans ce fichier (onglets disponibles : ${sheetNames.join(", ")}).`);
    }
    targetSheet = sheetName;
  } else {
    targetSheet = sheetNames[0];
  }
  const sheet = workbook.Sheets[targetSheet];

  // header:1 -> tableau de tableaux, pour récupérer les en-têtes bruts tels quels.
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  if (matrix.length === 0) {
    throw new Error(`L'onglet "${targetSheet}" du fichier ${originalName} semble vide.`);
  }

  // Ignore toute ligne entièrement vide en haut de l'onglet avant de
  // chercher la ligne d'en-têtes (motif réel observé le 2026-09-16 : les 3
  // onglets du fichier catalogue fourni par le client ont chacun une ligne
  // vide au-dessus des en-têtes) — jamais deviné plus loin qu'une ligne
  // strictement vide, pour ne jamais sauter une vraie ligne de données par
  // erreur.
  const headerRowIndex = matrix.findIndex((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
  if (headerRowIndex === -1) {
    throw new Error(`L'onglet "${targetSheet}" du fichier ${originalName} semble vide.`);
  }

  const headers = matrix[headerRowIndex].map((h) => String(h ?? "").trim());
  const rows = matrix.slice(headerRowIndex + 1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? r[idx] : "";
      });
      return obj;
    });

  return { headers, rows, sheetNames, sheetName: targetSheet };
}
