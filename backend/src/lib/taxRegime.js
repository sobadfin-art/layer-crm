// Régime fiscal de la fiche client — indépendant de la typologie commerciale
// (cf. lib/typology.js, qui reste un champ marketing distinct). Base pour le
// calcul de TVA à l'export Dolibarr ; règles fournies par le client, à valider
// par son expert-comptable avant mise en production — rien n'est deviné/en dur
// au-delà de ce qui a été explicitement communiqué.
export const REGIMES_FISCAUX = [
  "FRANCE_STANDARD",
  "INTRACOMMUNAUTAIRE_HT",
  "RECARGO_EQUIVALENCIA",
  "EXPORT_HORS_UE_HT",
];

const INTRACOM_COUNTRIES = ["ES", "DE", "IT", "PT", "BE", "NL"];
const EXPORT_HORS_UE_COUNTRIES = ["CH", "GB"];

// Règle confirmée (par défaut, cas par cas) — RECARGO_EQUIVALENCIA n'est
// JAMAIS choisi automatiquement, uniquement à la main sur un client espagnol
// identifié comme tel.
export function defaultRegimeFiscalForCountry(countryCode) {
  if (countryCode === "FR") return "FRANCE_STANDARD";
  if (INTRACOM_COUNTRIES.includes(countryCode)) return "INTRACOMMUNAUTAIRE_HT";
  if (EXPORT_HORS_UE_COUNTRIES.includes(countryCode)) return "EXPORT_HORS_UE_HT";
  // Aucun des 9 pays actuellement au référentiel ne tombe ici — repli
  // raisonnable pour un pays futur non encore couvert par la règle fournie,
  // à ajuster quand ce cas se présentera réellement.
  return "FRANCE_STANDARD";
}

// Taux de TVA à exporter vers Dolibarr, dérivé du regime_fiscal (jamais du
// pays seul, jamais de la typologie) — cf. dolibarr_settings pour les valeurs
// configurables. Retourne null si le taux n'est volontairement pas connu
// (RECARGO_EQUIVALENCIA tant qu'il n'est pas configuré) : ne jamais deviner.
export function vatRateForRegime(regimeFiscal, settings) {
  if (regimeFiscal === "FRANCE_STANDARD") return Number(settings.vat_rate_france_standard);
  if (regimeFiscal === "INTRACOMMUNAUTAIRE_HT") return 0;
  if (regimeFiscal === "EXPORT_HORS_UE_HT") return 0;
  if (regimeFiscal === "RECARGO_EQUIVALENCIA") {
    return settings.vat_rate_recargo_equivalencia === null ? null : Number(settings.vat_rate_recargo_equivalencia);
  }
  return null;
}
