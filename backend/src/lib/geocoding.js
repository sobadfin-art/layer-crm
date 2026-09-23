import { query } from "./db.js";

// Géocodage automatique des fiches client (demande client 2026-09-23 —
// "vraie carte interactive qui positionne tous les clients/prospects").
//
// Fournisseur : Nominatim (service public d'OpenStreetMap), pas Mapbox.
// Mapbox reste le fournisseur de la CARTE (frontend/src/components/
// AccountsMap.jsx, token public VITE_MAPBOX_TOKEN), mais leur API de
// géocodage classe par défaut tout résultat comme "temporaire" — le
// stockage durable en base ("permanent") n'est débloqué qu'avec une carte
// bancaire enregistrée sur le compte Mapbox, ce que le client a
// explicitement refusé (cf. échange du 2026-09-23). Nominatim n'a ni ce
// problème ni besoin de compte/clé : leur politique d'usage officielle
// (operations.osmfoundation.org/policies/nominatim) autorise et même
// demande explicitement de mettre les résultats en cache côté application
// plutôt que de les redemander — exactement notre cas d'usage (coordonnées
// stockées une fois en base, jamais redemandées ensuite pour la même
// adresse).
//
// Deux contraintes de cette politique, respectées ci-dessous :
//  1. Maximum absolu d'1 requête/seconde (throttle() plus bas, à l'échelle
//     du process entier — création de fiche ET script de rattrapage
//     partagent la même file d'attente).
//  2. User-Agent identifiant l'application obligatoire (NOMINATIM_USER_AGENT).
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "Moken-CRM/1.0 (+contact: sobadfin@gmail.com)";

let lastRequestAt = 0;
async function throttle() {
  const wait = 1000 - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

// Champs qui, une fois modifiés sur une fiche existante, doivent
// redéclencher un géocodage — utilisé par la route PATCH (routes/
// accounts.js) pour ne JAMAIS rappeler Nominatim sur une mise à jour qui ne
// touche pas l'adresse (changement de représentant, de typologie, etc.),
// conformément à la limite d'1 requête/seconde ci-dessus.
export const GEOCODING_TRIGGER_FIELDS = [
  "shippingStreet",
  "shippingZip",
  "shippingCity",
  "billingStreet",
  "billingZip",
  "billingCity",
];

// Convertit une adresse (rue/CP/ville/pays) en { latitude, longitude }, ou
// `null` si aucune correspondance exploitable — adresse absente/trop
// incomplète pour être interrogée, aucun résultat retourné par Nominatim,
// ou erreur réseau/HTTP. Ne lève JAMAIS d'exception : un échec de
// géocodage ne doit jamais empêcher la création/mise à jour d'une fiche
// client (exigence "invisible pour l'utilisateur"), seulement laisser la
// fiche sans coordonnées.
export async function geocodeAddress({ street, zip, city, countryCode }) {
  if (!street && !zip && !city) return null;

  await throttle();

  const params = new URLSearchParams({ format: "jsonv2", limit: "1", addressdetails: "0" });
  if (street) params.set("street", street);
  if (city) params.set("city", city);
  if (zip) params.set("postalcode", zip);
  // `countrycodes` (filtre ISO 3166-1 alpha-2, PAS le champ structuré
  // "country" qui attend un nom en texte libre et dépend donc de la langue)
  // — plus fiable : on a déjà le code pays exact (countryCode) sur la
  // fiche, pas la peine de rejouer une résolution par nom.
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        `[geocoding] Nominatim a répondu ${res.status} pour "${street ?? ""}, ${zip ?? ""} ${city ?? ""}".`
      );
      return null;
    }
    const results = await res.json();
    const first = Array.isArray(results) ? results[0] : null;
    if (!first || first.lat == null || first.lon == null) return null;
    // Nominatim renvoie lat/lon sous forme de CHAÎNES de caractères, jamais
    // de nombres — piège classique de cette API, cf. leur documentation.
    const latitude = Number.parseFloat(first.lat);
    const longitude = Number.parseFloat(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch (err) {
    console.warn(
      `[geocoding] Échec géocodage "${street ?? ""}, ${zip ?? ""} ${city ?? ""}" : ${err.message}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Choix de l'adresse à géocoder pour une fiche client (validé avec le
// client, 2026-09-23) : adresse de LIVRAISON en priorité — c'est en général
// celle du point de vente physique que le représentant visite sur le
// terrain — avec repli sur la FACTURATION si la livraison n'est pas
// renseignée, plutôt que de laisser la fiche sans coordonnées. Accepte
// indifféremment un objet en camelCase (payload validé par zod,
// routes/accounts.js) ou en snake_case (ligne SQL brute, scripts/
// geocode-existing-accounts.mjs) pour être réutilisable par les deux.
export function pickAddressForGeocoding(account) {
  const shippingStreet = account.shippingStreet ?? account.shipping_street;
  const shippingZip = account.shippingZip ?? account.shipping_zip;
  const shippingCity = account.shippingCity ?? account.shipping_city;
  if (shippingStreet || shippingZip || shippingCity) {
    return { street: shippingStreet ?? null, zip: shippingZip ?? null, city: shippingCity ?? null };
  }
  const billingStreet = account.billingStreet ?? account.billing_street;
  const billingZip = account.billingZip ?? account.billing_zip;
  const billingCity = account.billingCity ?? account.billing_city;
  return { street: billingStreet ?? null, zip: billingZip ?? null, city: billingCity ?? null };
}

// Géocode une fiche et écrit latitude/longitude en base (toujours les
// DEUX colonnes, y compris à `null` en cas d'échec — une fiche dont
// l'adresse est modifiée vers une adresse introuvable ne doit jamais
// garder un point périmé sur la carte). Utilisé aussi bien par la
// création/mise à jour (routes/accounts.js) que par le script de
// rattrapage (scripts/geocode-existing-accounts.mjs).
export async function geocodeAndStoreAccount(accountId, addressLike, countryCode) {
  const address = pickAddressForGeocoding(addressLike);
  const coords = await geocodeAddress({ ...address, countryCode });
  await query(`UPDATE accounts SET latitude = $1, longitude = $2 WHERE id = $3`, [
    coords?.latitude ?? null,
    coords?.longitude ?? null,
    accountId,
  ]);
  return coords;
}
