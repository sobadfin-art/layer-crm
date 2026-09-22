// Utilitaires de formatage partagés entre tous les écrans — un seul endroit
// pour la correspondance locale i18n -> locale Intl (et les formats
// date/montant qui en découlent), pour ne pas la redéfinir (et risquer de la
// faire diverger) dans chaque page comme c'était le cas pour FrontDesk.jsx.
export function intlLocale(locale) {
  return locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "fr-FR";
}

export function money(n, locale) {
  return Number(n || 0).toLocaleString(intlLocale(locale), { style: "currency", currency: "EUR" });
}

export function shortDate(value, locale) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(intlLocale(locale));
}

export function dateTime(value, locale) {
  if (!value) return "—";
  return new Date(value).toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
}

// Correctif 2026-09-22 (demande client — "Recherche client par nom
// commercial ET raison sociale... insensible à la casse et aux accents") :
// normalisation partagée entre tous les écrans de recherche client
// (ClientsList.jsx, NewOrderQuickAccess.jsx) pour ne pas dupliquer cette
// logique deux fois et risquer de la faire diverger. `NFD` décompose les
// caractères accentués en lettre de base + diacritique séparé, que la classe
// unicode `\p{Diacritic}` retire ensuite — "Café"/"cafe"/"CAFÉ" deviennent
// tous "cafe".
export function normalizeSearch(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
