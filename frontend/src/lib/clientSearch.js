import { normalizeSearch } from "./format.js";

// Correctif 2026-09-22 (demande client — "Recherche client par nom
// commercial ET raison sociale... construis cette recherche comme un
// composant réutilisable, puisqu'elle doit être réutilisée telle quelle au
// point 3 [Agenda]") : logique de correspondance centralisée en un seul
// endroit plutôt que dupliquée dans chaque écran — ClientsList.jsx,
// NewOrderQuickAccess.jsx et le nouveau composant ClientSearchPicker.jsx
// (réutilisé depuis Agenda.jsx pour la création de RDV/tâches) s'y branchent
// tous. Un compte matche si `search` (normalisé insensible casse+accents,
// cf. normalizeSearch) est trouvé dans SA raison sociale (name) OU son nom
// commercial (nomCommercial) OU son nom de magasin (storeName) OU son contact
// OU son pays — une correspondance sur un seul de ces champs suffit à faire
// remonter la fiche.
//
// Correctif 2026-09-22 (suite) : `storeName` ("Nom du magasin") est un champ
// distinct de `name` (raison sociale) et `nomCommercial` (nom commercial) —
// existant de longue date (cf. migrations/014_import_fiches_client.sql),
// jusqu'ici utilisé UNIQUEMENT pour le rapprochement d'import Dolibarr en
// masse (accountsImport.js), jamais pour la recherche à l'écran. Le client a
// explicitement demandé qu'il devienne recherchable au même titre que les
// deux autres — ajouté ici, au même endroit centralisé, donc effectif
// immédiatement partout où filterAccountsBySearch est déjà branché (aucun
// écran supplémentaire à modifier).
export function filterAccountsBySearch(accounts, search) {
  const q = normalizeSearch(search);
  if (!q) return accounts;
  return accounts.filter(
    (a) =>
      normalizeSearch(a.name).includes(q) ||
      (a.nomCommercial && normalizeSearch(a.nomCommercial).includes(q)) ||
      (a.storeName && normalizeSearch(a.storeName).includes(q)) ||
      (a.contactName && normalizeSearch(a.contactName).includes(q)) ||
      (a.countryName && normalizeSearch(a.countryName).includes(q))
  );
}
