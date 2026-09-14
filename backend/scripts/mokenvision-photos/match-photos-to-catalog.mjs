// Rapproche les fiches produit du catalogue CRM avec les photos scrappées de
// mokenvision.com (moken_photos_map.json, même dossier), par modèle (et
// couleur si possible). Écrit photo_url via l'API produits (PATCH /api/products/:id) —
// jamais en écriture SQL directe — pour rester dans le même chemin que la
// mise à jour manuelle d'une fiche produit et déclencher l'audit log
// (PRODUCT_UPDATED). Ne devine jamais : un modèle absent du fichier n'est
// pas rapproché, quelle que soit sa ressemblance approximative avec un autre
// nom (cf. docs/rapprochement-photos-mokenvision.md).
//
// Usage : node match-photos-to-catalog.mjs [--dry-run]
//   BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD peuvent être surchargés par variables
//   d'environnement (valeurs par défaut = environnement de développement).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://localhost:4000";
const DRY_RUN = process.argv.includes("--dry-run");

function normalize(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(body)}`);
  return res.headers.get("set-cookie").split(";")[0];
}

async function main() {
  const cookie = await login(
    process.env.ADMIN_EMAIL || "admin@moken.demo",
    process.env.ADMIN_PASSWORD || "moken1234"
  );
  const photoMap = JSON.parse(fs.readFileSync(path.join(__dirname, "moken_photos_map.json"), "utf8"));

  const products = await (await fetch(`${BASE}/api/products`, { headers: { Cookie: cookie } })).json();
  console.log(`Fiches produit dans le catalogue CRM : ${products.length}`);

  const matched = [];
  const unmatched = [];

  for (const p of products) {
    if (p.photoUrl) { continue; } // déjà une photo -> jamais écrasée automatiquement
    if (!p.model) { unmatched.push({ ref: p.ref, reason: "pas de champ Modèle renseigné" }); continue; }
    const key = normalize(p.model);
    const entry = photoMap[key];
    if (!entry) { unmatched.push({ ref: p.ref, model: p.model, reason: "aucun modèle mokenvision.com correspondant" }); continue; }

    let variant = entry.variants[0];
    if (p.color) {
      const colorKey = normalize(p.color);
      const byColor = entry.variants.find((v) => v.color && colorKey.includes(normalize(v.color)));
      if (byColor) variant = byColor;
    }
    matched.push({ id: p.id, ref: p.ref, model: p.model, color: p.color, imageUrl: variant.imageUrl, productUrl: variant.productUrl });
  }

  console.log(`\n--- Rapprochements trouvés : ${matched.length} ---`);
  console.log(JSON.stringify(matched, null, 2));
  console.log(`\n--- Non rapprochés (${unmatched.length}) — à traiter manuellement, jamais devinés ---`);
  console.log(JSON.stringify(unmatched, null, 2));

  if (matched.length === 0) {
    console.log("\nAucune mise à jour à appliquer (0 rapprochement).");
    return;
  }
  if (DRY_RUN) {
    console.log("\n--dry-run : aucune écriture effectuée.");
    return;
  }

  console.log("\n--- Application (PATCH /api/products/:id) ---");
  for (const m of matched) {
    const res = await fetch(`${BASE}/api/products/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ photoUrl: m.imageUrl }),
    });
    const body = await res.json();
    console.log(`${res.ok ? "OK" : "ERREUR"} - ${m.ref} (${m.model}) -> ${m.imageUrl}`, res.ok ? "" : JSON.stringify(body));
  }
}

main().catch((e) => { console.error("SCRIPT FAILED:", e); process.exit(1); });
