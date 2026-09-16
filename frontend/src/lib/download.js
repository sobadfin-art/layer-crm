import { api } from "../api.js";

// Déclenche le téléchargement d'un fichier binaire renvoyé par l'API (blob,
// cf. api.js : toute réponse non-JSON est automatiquement traitée comme un
// blob) — même mécanique que l'export Dolibarr (FrontDesk.jsx) et l'extract
// (Data.jsx), centralisée ici pour les nouveaux boutons "Télécharger un
// modèle" (correctif 2026-09-16, cf. ImportWizard.jsx).
export async function downloadFile(path, filename) {
  const blob = await api.get(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
