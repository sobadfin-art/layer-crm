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

export function parseSpreadsheet(buffer, originalName) {
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
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // header:1 -> tableau de tableaux, pour récupérer les en-têtes bruts tels quels.
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  if (matrix.length === 0) {
    throw new Error(`Le fichier ${originalName} semble vide.`);
  }

  const headers = matrix[0].map((h) => String(h ?? "").trim());
  const rows = matrix.slice(1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? r[idx] : "";
      });
      return obj;
    });

  return { headers, rows };
}
