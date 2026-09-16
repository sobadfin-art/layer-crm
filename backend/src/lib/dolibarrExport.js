// Logique de la check-list et de l'export Dolibarr —
// cf. cahier-des-charges-export-dolibarr.md, mis à jour après confirmation du
// client (Dolibarr 23.0.3, intégration par fichier UNIQUEMENT, pas d'API) :
//   - Pas de gestion de TVA dans le CRM (retiré, cf. migration 006).
//   - fk_user des représentants écarté : inutile en intégration fichier (retiré).
//   - Conditions de règlement (30 jours par défaut) et mode de paiement
//     (Prélèvement SEPA ou LCR, aucun autre) ont maintenant de vraies valeurs
//     métier par défaut — les éventuels ID internes Dolibarr
//     (default_payment_term_id/default_payment_mode_id) restent configurables
//     mais ne sont plus bloquants ni signalés : ils sont optionnels/avancés.
//   - Le taux de TVA exporté est recalculé à partir du regime_fiscal de la
//     fiche compte (migration 007, lib/taxRegime.js), jamais du pays seul ni
//     de la typologie — base non définitive, à valider par l'expert-comptable.
//
// Règle définitive (revue de cohérence) sur l'IDENTIFICATION CLIENT : dans le
// flux retenu, l'utilisateur Dolibarr ouvre déjà la fiche du client concerné
// avant d'importer le fichier de commande — le client est donc déjà connu de
// Dolibarr au moment de l'import. Aucun contrôle/rapprochement d'identification
// client (dolibarr_code_client, SIRET/TVA...) n'est donc plus effectué ici, ni
// bloquant ni même en avertissement : `accounts.dolibarr_code_client` (et le
// réglage `account_match_field` qui pilotait ce contrôle) restent en base pour
// compatibilité mais n'interviennent plus ni dans la check-list ni dans la
// génération du CSV — la colonne "compte_client" du CSV est maintenant
// toujours le nom du compte, à titre informatif/lisible pour l'opérateur
// Dolibarr, sans aucune logique de rapprochement automatique.
//
// Règle définitive sur l'IDENTIFICATION PRODUIT — RÉVISÉE (fiche corrective
// "CORRECTIFS PRIORITAIRES — VISUALISATION DES COMMANDES + EXPORT DOLIBARR",
// sections 7 à 16, fichier exemple joint). Le format de fichier attendu par
// Dolibarr a changé : il ne porte plus qu'UNE commande à la fois, sur
// exactement 6 colonnes (fk_product, qty, label, remise_percent, tva_tx,
// subprice — noms et ordre EXACTS du fichier exemple, ne jamais les
// renommer/traduire/réordonner), une ligne par ligne de commande. La colonne
// `fk_product` DOIT être l'identifiant produit Dolibarr (`products.dolibarr_ref`)
// — jamais la référence CRM (`ref`) en repli, contrairement à l'ancienne
// règle : section 9, "NE PAS utiliser l'ID interne CRM, le SKU à la place de
// l'ID Dolibarr...". C'est donc désormais un point BLOQUANT strict (voir
// "product_references" ci-dessous), sans repli, avec le détail du/des
// produit(s) en cause dans le message d'erreur (section 16, exemple de
// message donné textuellement par la fiche). La colonne `label`, elle,
// reprend la référence CRM (`ref`) telle quelle (section 11 : "ne pas
// reconstruire arbitrairement le label si une valeur existe déjà" — le
// fichier exemple confirme que Dolibarr y attend la référence produit, pas un
// intitulé commercial).
import * as XLSX from "xlsx";
import { query } from "./db.js";
import { vatRateForRegime } from "./taxRegime.js";

export async function getDolibarrSettings() {
  const { rows } = await query("SELECT * FROM dolibarr_settings WHERE id = 'default'");
  return rows[0];
}

async function loadOrderBundle(orderId) {
  const { rows: orderRows } = await query(
    `SELECT o.*, a.name AS account_name, a.dolibarr_code_client, a.vat_number, a.tax_id,
            a.owner_rep_id, a.regime_fiscal, c.code AS country_code
     FROM orders o
     JOIN accounts a ON a.id = o.account_id
     JOIN countries c ON c.id = a.country_id
     WHERE o.id = $1`,
    [orderId]
  );
  const order = orderRows[0];
  if (!order) return null;

  const { rows: lines } = await query(
    `SELECT ol.*, p.ref AS product_ref, p.dolibarr_ref AS product_dolibarr_ref
     FROM order_lines ol
     JOIN products p ON p.id = ol.product_id WHERE ol.order_id = $1`,
    [orderId]
  );
  order.lines = lines;

  return order;
}

// Check-list section 2/3/6 du cahier des charges — jamais bloquante en silence :
// chaque point manquant est listé explicitement pour le front desk.
export async function buildExportChecklist(orderId) {
  const settings = await getDolibarrSettings();
  const order = await loadOrderBundle(orderId);
  if (!order) return null;

  const items = [];

  items.push({
    key: "order_status",
    label: "Commande validée par le front desk",
    ok: order.status === "VALIDEE",
    detail: `Statut actuel : ${order.status}`,
  });

  items.push({
    key: "not_already_exported",
    label: "Commande pas déjà exportée",
    ok: order.status !== "EXPORTEE_DOLIBARR",
    detail: order.exported_at ? `Déjà exportée le ${order.exported_at}` : "OK",
  });

  // Volontairement AUCUN contrôle d'identification client ici (ni code client
  // Dolibarr, ni SIRET/TVA) — règle définitive, cf. commentaire en tête de
  // fichier : le client est déjà connu de Dolibarr au moment de l'import.

  // Régime fiscal (migration 007) — jamais bloquant, juste un avertissement
  // pour que le front desk sache qu'il manque une info avant l'export réel.
  if (order.regime_fiscal === "INTRACOMMUNAUTAIRE_HT") {
    items.push({
      key: "intracom_vat_number",
      label: "Numéro de TVA intracommunautaire renseigné (régime Intracommunautaire HT)",
      ok: Boolean(order.vat_number),
      detail: order.vat_number || "Manquant — à renseigner sur la fiche compte.",
    });
  }
  // (L'ancien avertissement "recargo_rate_configured", non bloquant, est
  // remplacé ci-dessous par le contrôle "vat_rate_available" — désormais
  // BLOQUANT pour tous les régimes, puisque tva_tx est une colonne
  // obligatoire du nouveau format d'export, sans repli possible.)

  items.push({
    key: "lines_present",
    label: "La commande contient au moins une ligne",
    ok: order.lines.length > 0,
    detail: `${order.lines.length} ligne(s)`,
  });

  // Contrôle produit (section 9/16 de la fiche corrective — RENFORCÉ, plus de
  // repli sur la référence CRM) : chaque ligne DOIT disposer d'un identifiant
  // produit Dolibarr (`products.dolibarr_ref`), c'est la valeur qui alimente
  // la colonne `fk_product` de l'export. Message d'erreur au format
  // explicitement donné par la fiche (section 16), un message par produit en
  // cause.
  const linesMissingDolibarrId = order.lines.filter((line) => !(line.product_dolibarr_ref || "").trim());
  items.push({
    key: "product_references",
    label: "Chaque ligne dispose d'un identifiant produit Dolibarr (fk_product)",
    ok: linesMissingDolibarrId.length === 0,
    detail:
      linesMissingDolibarrId.length === 0
        ? "OK"
        : linesMissingDolibarrId
            .map((l) => `Impossible d'exporter la commande : identifiant produit Dolibarr manquant pour la référence ${l.product_ref || l.product_id}.`)
            .join(" "),
  });

  // TVA (section 13) : colonne obligatoire du nouveau format, sans repli
  // possible — si le régime fiscal de la commande ne résout à aucun taux
  // connu (aujourd'hui uniquement Recargo de Equivalencia tant qu'il n'est
  // pas configuré), l'export est bloqué plutôt que d'écrire une cellule vide.
  const vatRate = vatRateForRegime(order.regime_fiscal, settings);
  items.push({
    key: "vat_rate_available",
    label: "Taux de TVA disponible pour la commande (colonne tva_tx)",
    ok: vatRate !== null,
    detail: vatRate !== null ? `${vatRate}%` : "Taux de TVA non configuré pour ce régime fiscal — voir Réglages Dolibarr.",
  });

  const blocking = ["order_status", "not_already_exported", "lines_present", "product_references", "vat_rate_available"];
  const blockingFailed = items.filter((it) => blocking.includes(it.key) && !it.ok);
  const warnings = items.filter((it) => !blocking.includes(it.key) && !it.ok);

  return {
    orderId,
    canExport: blockingFailed.length === 0,
    items,
    // Message explicite (section 16 : "NE PAS générer silencieusement un
    // fichier incorrect. Afficher une erreur explicite... Impossible
    // d'exporter la commande : identifiant produit Dolibarr manquant pour la
    // référence XXXXX.") — on préfère le `detail` (qui porte ce message
    // précis pour product_references) au `label` générique dès qu'il en dit
    // plus que "OK".
    blockingIssues: blockingFailed.map((i) => (i.detail && i.detail !== "OK" ? i.detail : i.label)),
    warnings: warnings.map((i) => i.label),
  };
}

function csvEscape(value, delimiter) {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(delimiter) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Colonnes STRICTEMENT reprises du fichier exemple fourni (fiche corrective,
// pièce jointe "exemple export pour Doli.xlsx", feuille "Feuil1") — mêmes
// noms, même ordre, aucune colonne ajoutée. Ne JAMAIS renommer/traduire/
// réordonner (section 7/8 : "LE FICHIER JOINT PRIME SUR TOUTE
// INTERPRÉTATION"). L'ancien format 17 colonnes (ref_client, compte_client,
// devise, entrepôt, conditions/modes de paiement, régime fiscal, indicateurs
// offert/reliquat...) est abandonné : ces informations restent gérées côté
// Dolibarr lui-même au moment de l'import (l'opérateur a déjà ouvert la fiche
// du bon client/de la bonne commande avant d'importer ce fichier de lignes,
// cf. cahier-des-charges-export-dolibarr.md) et n'ont plus leur place ici.
const CSV_COLUMNS = ["fk_product", "qty", "label", "remise_percent", "tva_tx", "subprice"];

// Construit les lignes de données (une par ligne de commande produit),
// indépendamment du format de fichier final (CSV ou XLSX, cf.
// buildDolibarrCsv/buildDolibarrXlsx ci-dessous) — mêmes valeurs, même
// logique métier, pour ne jamais faire diverger les deux formats. Le fichier
// exemple ne porte pas d'identifiant de commande/client (section 8) : cette
// fonction reste appelable avec plusieurs commandes (concaténation simple
// des lignes, ex. un export groupé), mais l'écran Front Desk n'en sélectionne
// jamais qu'une seule à la fois, conformément au flux Dolibarr décrit
// ci-dessus (une commande = un fichier de lignes importé dans la fiche
// commande déjà ouverte côté Dolibarr).
function buildDolibarrRows(orders, settings) {
  const rows = [];

  for (const order of orders) {
    // Régime fiscal de la fiche compte (jamais du pays seul ni de la
    // typologie) — null pour RECARGO_EQUIVALENCIA tant que le taux n'est pas
    // configuré, jamais deviné. Bloqué en amont par la check-list
    // ("vat_rate_available") : à ce stade, vatRate ne devrait jamais être
    // null pour une commande dont l'export a été autorisé — filet de sécurité
    // uniquement (ne devrait jamais produire de cellule vide en pratique).
    const vatRate = vatRateForRegime(order.regime_fiscal, settings);

    for (const line of order.lines) {
      const isGift = line.is_gift;
      // subprice (section 14) : PRIX UNITAIRE HISTORIQUE de la ligne, tel
      // qu'enregistré à la validation de la commande (order_lines.unit_price_ht,
      // jamais un prix catalogue actuel). Le "prix offert" reste géré comme
      // avant via le réglage giftLineStrategy (prix à 0 ou remise à 100%),
      // sans colonne dédiée puisque le nouveau format n'en prévoit pas.
      const unitPrice = isGift && settings.gift_line_strategy === "ZERO_PRICE" ? 0 : Number(line.unit_price_ht);
      // remise_percent (section 12) : LA REMISE HISTORIQUE de la commande
      // (order_lines.discount_pct), jamais recalculée avec les règles
      // commerciales actuelles.
      const discountPct = isGift && settings.gift_line_strategy === "FULL_DISCOUNT" ? 100 : Number(line.discount_pct || 0);
      // fk_product (section 9) : l'identifiant produit Dolibarr enregistré
      // sur la fiche produit CRM — jamais l'ID interne CRM, jamais le SKU en
      // repli (la check-list bloque déjà l'export si absent). Converti en
      // nombre quand c'est un identifiant purement numérique (comme dans le
      // fichier exemple : 931, 926, 1366...), laissé en texte sinon (cas
      // d'un identifiant Dolibarr alphanumérique).
      const rawDolibarrId = (line.product_dolibarr_ref || "").trim();
      const fkProduct = /^\d+$/.test(rawDolibarrId) ? Number(rawDolibarrId) : rawDolibarrId;

      rows.push([
        fkProduct,
        line.qty,
        // label (section 11) : reprend la référence CRM telle quelle (le
        // fichier exemple y porte des références produit, pas un intitulé
        // commercial) — jamais reconstruite/reformatée.
        line.product_ref,
        Math.round(discountPct * 100) / 100,
        vatRate === null ? "" : Math.round(vatRate * 100) / 100,
        Math.round(unitPrice * 100) / 100,
      ]);
    }
  }

  return rows;
}

// Conservé pour compatibilité (script/outillage éventuel côté serveur) même
// si le téléchargement front desk génère désormais un .xlsx par défaut — cf.
// buildDolibarrXlsx, README section "Lot 4".
export function buildDolibarrCsv(orders, settings) {
  const delimiter = settings.csv_delimiter || ";";
  const rows = [CSV_COLUMNS.join(delimiter)];
  for (const row of buildDolibarrRows(orders, settings)) {
    rows.push(row.map((v) => csvEscape(v, delimiter)).join(delimiter));
  }
  return rows.join("\r\n") + "\r\n";
}

// Fichier Dolibarr au format .xlsx — bascule demandée par la fiche corrective
// V2 Front Desk (section 2 : "Fichier Dolibarr (.xlsx)"), confirmée par vous
// en remplacement du CSV d'origine (Lot 4). Mêmes colonnes/valeurs que le CSV
// (buildDolibarrRows) ; seul le format de fichier change. Réutilise la
// bibliothèque `xlsx` déjà en dépendance (cf. GET /api/dashboard/extract.xlsx,
// routes/dashboard.js, même pattern XLSX.utils).
export function buildDolibarrXlsx(orders, settings) {
  const rows = buildDolibarrRows(orders, settings);
  const sheet = XLSX.utils.aoa_to_sheet([CSV_COLUMNS, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Commandes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export { loadOrderBundle };
