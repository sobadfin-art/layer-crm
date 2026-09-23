// Rattrapage rétroactif du géocodage (correctif 2026-09-23 — "vraie carte
// interactive Mapbox GL JS", cf. migration 024_accounts_geocoding.sql et
// lib/geocoding.js pour le détail du calcul).
//
// Toute fiche client/prospect (hors archivées) sans latitude/longitude est
// géocodée une fois, dans l'ordre de création, en respectant la limite
// d'1 requête/seconde de la politique d'usage Nominatim (throttle() dans
// lib/geocoding.js, partagé avec la création/mise à jour de fiche — ce
// script ne peut donc jamais dépasser cette limite même s'il tournait en
// même temps qu'un usage normal de l'application).
//
// Usage : npm run geocode-accounts (depuis backend/), ou directement
// `node src/scripts/geocode-accounts.js`. Relançable sans risque : ne
// traite que les fiches encore sans coordonnées (idempotent — une fiche
// déjà géocodée, avec succès ou non, n'est jamais retraitée par un futur
// lancement ; pour forcer un nouveau géocodage sur une fiche précise après
// correction de son adresse, repasser par une modification de fiche
// normale, qui redéclenche automatiquement l'appel, cf. routes/accounts.js).
import "dotenv/config";
import { pool, query } from "../lib/db.js";
import { geocodeAndStoreAccount, pickAddressForGeocoding } from "../lib/geocoding.js";

async function main() {
  const { rows: accounts } = await query(
    `SELECT a.id, a.name, a.status,
            a.shipping_street, a.shipping_zip, a.shipping_city,
            a.billing_street, a.billing_zip, a.billing_city,
            c.code AS country_code
     FROM accounts a
     JOIN countries c ON c.id = a.country_id
     WHERE a.latitude IS NULL AND a.longitude IS NULL AND a.status != 'ARCHIVE'
     ORDER BY a.created_at ASC`
  );

  console.log(`${accounts.length} fiche(s) sans coordonnées à traiter (à ~1 requête/seconde)...\n`);

  let converted = 0;
  let failedNoAddress = 0;
  let failedNotFound = 0;
  const failedDetails = [];

  for (const [idx, account] of accounts.entries()) {
    const address = pickAddressForGeocoding(account);
    if (!address.street && !address.zip && !address.city) {
      failedNoAddress += 1;
      failedDetails.push({ name: account.name, reason: "aucune adresse exploitable (livraison et facturation vides)" });
      console.log(`[${idx + 1}/${accounts.length}] ✗ ${account.name} — aucune adresse exploitable, ignorée.`);
      continue;
    }

    const coords = await geocodeAndStoreAccount(account.id, account, account.country_code);
    if (coords) {
      converted += 1;
      console.log(
        `[${idx + 1}/${accounts.length}] ✓ ${account.name} — ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
      );
    } else {
      failedNotFound += 1;
      failedDetails.push({
        name: account.name,
        reason: `adresse non reconnue par Nominatim (${[address.street, address.zip, address.city].filter(Boolean).join(", ")})`,
      });
      console.log(`[${idx + 1}/${accounts.length}] ✗ ${account.name} — adresse non reconnue par Nominatim.`);
    }
  }

  console.log("\n=== RÉSUMÉ ===");
  console.log(`Total traité       : ${accounts.length}`);
  console.log(`Converties          : ${converted}`);
  console.log(`Échecs (sans adresse exploitable) : ${failedNoAddress}`);
  console.log(`Échecs (adresse non reconnue)      : ${failedNotFound}`);
  if (failedDetails.length > 0) {
    console.log("\nDétail des échecs :");
    for (const f of failedDetails) {
      console.log(` - ${f.name} : ${f.reason}`);
    }
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Erreur lors du géocodage rétroactif :", err);
  await pool.end();
  process.exit(1);
});
