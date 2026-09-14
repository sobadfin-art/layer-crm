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
// Règle définitive sur l'IDENTIFICATION PRODUIT (renforcée) : en revanche
// chaque ligne de commande DOIT disposer d'une référence exploitable avant
// export — dolibarr_ref du produit si renseignée, sinon la référence CRM
// (product.ref). C'est désormais un point BLOQUANT de la check-list (voir
// "product_references" ci-dessous), avec le détail du/des produit(s) en cause
// dans le message d'erreur.
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
  if (order.regime_fiscal === "RECARGO_EQUIVALENCIA") {
    items.push({
      key: "recargo_rate_configured",
      label: "Taux de TVA Recargo de Equivalencia configuré",
      ok: settings.vat_rate_recargo_equivalencia !== null,
      detail:
        settings.vat_rate_recargo_equivalencia !== null
          ? `${settings.vat_rate_recargo_equivalencia}%`
          : "Non configuré — taux à définir avec votre expert-comptable avant l'export réel.",
    });
  }

  items.push({
    key: "lines_present",
    label: "La commande contient au moins une ligne",
    ok: order.lines.length > 0,
    detail: `${order.lines.length} ligne(s)`,
  });

  // Contrôle produit (renforcé, bloquant) : chaque ligne doit disposer d'au
  // moins une référence exploitable — dolibarr_ref si renseignée, sinon la
  // référence CRM. On identifie explicitement le(s) produit(s) en cause dans
  // le détail pour que le front desk sache exactement quoi corriger.
  const linesMissingRef = order.lines.filter((line) => {
    const ref = (line.product_dolibarr_ref || line.product_ref || "").trim();
    return ref.length === 0;
  });
  items.push({
    key: "product_references",
    label: "Chaque ligne dispose d'une référence produit exploitable (Dolibarr ou CRM)",
    ok: linesMissingRef.length === 0,
    detail:
      linesMissingRef.length === 0
        ? "OK"
        : `Référence manquante pour : ${linesMissingRef.map((l) => l.product_ref || l.product_id).join(", ")}`,
  });

  const blocking = ["order_status", "not_already_exported", "lines_present", "product_references"];
  const blockingFailed = items.filter((it) => blocking.includes(it.key) && !it.ok);
  const warnings = items.filter((it) => !blocking.includes(it.key) && !it.ok);

  return {
    orderId,
    canExport: blockingFailed.length === 0,
    items,
    blockingIssues: blockingFailed.map((i) => i.label),
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

const CSV_COLUMNS = [
  "ref_client",
  "compte_client",
  "devise",
  "date_livraison_souhaitee",
  "entrepot",
  "produit_ref",
  "quantite",
  "prix_unitaire_ht",
  "taux_remise_pct",
  "regime_fiscal",
  "taux_tva_pct",
  "condition_paiement_jours",
  "condition_paiement_dolibarr_id",
  "mode_paiement",
  "mode_paiement_dolibarr_id",
  "ligne_offerte",
  "ligne_reliquat",
];

const PAYMENT_MODE_LABEL = {
  PRELEVEMENT_SEPA: "Prélèvement SEPA",
  LCR: "LCR",
};

// Une ligne CSV par ligne de commande — plusieurs commandes peuvent être
// combinées dans un seul fichier (export par lot, section 7 : "par lot
// quotidien").
export function buildDolibarrCsv(orders, settings) {
  const delimiter = settings.csv_delimiter || ";";
  const rows = [CSV_COLUMNS.join(delimiter)];

  for (const order of orders) {
    // Nom du compte uniquement — aucune logique de rapprochement automatique
    // client CRM <-> Dolibarr (règle définitive, cf. commentaire en tête de
    // fichier) : le client est déjà identifié côté Dolibarr avant l'import,
    // cette colonne est purement informative/lisible pour l'opérateur.
    const accountKey = order.account_name;

    const refClient = order.dolibarr_ref_client || `O-${order.id.slice(0, 8)}`;
    // Régime fiscal de la fiche compte (jamais du pays seul ni de la
    // typologie) — null pour RECARGO_EQUIVALENCIA tant que le taux n'est pas
    // configuré, jamais deviné (cf. check-list "recargo_rate_configured").
    const vatRate = vatRateForRegime(order.regime_fiscal, settings);

    for (const line of order.lines) {
      const isGift = line.is_gift;
      const unitPrice = isGift && settings.gift_line_strategy === "ZERO_PRICE" ? 0 : Number(line.unit_price_ht);
      const discountPct = isGift && settings.gift_line_strategy === "FULL_DISCOUNT" ? 100 : Number(line.discount_pct || 0);

      const row = [
        refClient,
        accountKey || "",
        order.currency,
        order.desired_delivery_date ? new Date(order.desired_delivery_date).toISOString().slice(0, 10) : "",
        settings.default_warehouse_id || "Entrepôt principal",
        line.product_dolibarr_ref || line.product_ref,
        line.qty,
        unitPrice.toFixed(2),
        discountPct.toFixed(2),
        order.regime_fiscal,
        vatRate === null ? "" : vatRate.toFixed(2),
        settings.payment_term_days,
        settings.default_payment_term_id || "",
        PAYMENT_MODE_LABEL[settings.payment_mode] || settings.payment_mode,
        settings.default_payment_mode_id || "",
        isGift ? "oui" : "non",
        line.is_reliquat ? "oui" : "non",
      ];
      rows.push(row.map((v) => csvEscape(v, delimiter)).join(delimiter));
    }
  }

  return rows.join("\r\n") + "\r\n";
}

export { loadOrderBundle };
