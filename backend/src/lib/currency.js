// Point 7 (2026-10-25) — devise d'une commande, déduite du pays du COMPTE
// client (jamais du représentant). Seule la Suisse est en CHF (prix catalogue
// `price_ch`, saisi en CHF) ; tous les autres pays restent en EUR, y compris
// ceux dont `countries.currency` indique une autre monnaie (ex. GB/GBP) :
// leurs prix sont le prix Export, en euros. Aucune conversion n'est jamais
// faite.
export const CURRENCIES = ["EUR", "CHF"];

export function currencyForCountry(countryCode) {
  return countryCode === "CH" ? "CHF" : "EUR";
}

// Devise demandée par un écran d'agrégat (?currency=) — EUR par défaut, pour
// que les écrans existants gardent exactement leur comportement actuel.
export function requestedCurrency(req) {
  return req.query.currency === "CHF" ? "CHF" : "EUR";
}
