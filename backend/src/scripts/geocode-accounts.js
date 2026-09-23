// Rattrapage rétroactif du géocodage, en ligne de commande — réservé aux
// environnements où l'accès Shell est disponible (cf. lib/geocoding.js pour
// le détail du calcul, et routes/accounts.js pour l'équivalent HTTP
// `POST /api/accounts/geocode-retroactive`, utilisable depuis l'écran Admin
// "Géocodage" sans accès Shell — c'est cette route qu'il faut utiliser sur
// un plan Render qui n'inclut pas le Shell).
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
// traite que les fiches encore sans coordonnées (idempotent).
import "dotenv/config";
import { pool } from "../lib/db.js";
import { fetchUngeocodedAccounts, geocodeAccountsBatch } from "../lib/geocoding.js";

const BATCH_SIZE = 50;

async function main() {
  let totalConverted = 0;
  let totalFailedNoAddress = 0;
  let totalFailedNotFound = 0;
  const allDetails = [];
  let totalProcessed = 0;

  for (;;) {
    const accounts = await fetchUngeocodedAccounts(BATCH_SIZE);
    if (accounts.length === 0) break;

    for (const account of accounts) {
      totalProcessed += 1;
      console.log(`[${totalProcessed}] ${account.name}...`);
    }

    const { converted, failedNoAddress, failedNotFound, details } = await geocodeAccountsBatch(accounts);
    totalConverted += converted;
    totalFailedNoAddress += failedNoAddress;
    totalFailedNotFound += failedNotFound;
    allDetails.push(...details);
  }

  console.log("\n=== RÉSUMÉ ===");
  console.log(`Total traité       : ${totalProcessed}`);
  console.log(`Converties          : ${totalConverted}`);
  console.log(`Échecs (sans adresse exploitable) : ${totalFailedNoAddress}`);
  console.log(`Échecs (adresse non reconnue)      : ${totalFailedNotFound}`);
  const failures = allDetails.filter((d) => d.status !== "converted");
  if (failures.length > 0) {
    console.log("\nDétail des échecs :");
    for (const f of failures) console.log(` - ${f.name} : ${f.reason}`);
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Erreur lors du géocodage rétroactif :", err);
  await pool.end();
  process.exit(1);
});
