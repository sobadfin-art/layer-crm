// Moteur de calcul de la prise de commande — cf. etat-final-prototype-handoff.md
// section 5 (règles commerciales) et section 6 (récapitulatif de commande).
// Le prix unitaire n'est JAMAIS accepté du client : il est toujours recalculé
// côté serveur à partir du produit + du pays du compte, pour éviter toute
// manipulation.

const DEFAULT_SHIPPING_FEE = 9.6;

// France et Espagne partagent la même grille tarifaire (priceFR) — section 5.
export function resolveUnitPrice(product, countryCode) {
  if (countryCode === "FR" || countryCode === "ES") return product.price_fr;
  if (countryCode === "CH") return product.price_ch;
  return product.price_export;
}

// Sélectionne la règle la plus spécifique applicable : Représentant > Pays > Global.
// Depuis la migration 013, le scope REPRESENTANT cible une SÉLECTION de
// représentants (rep_ids, via business_rule_reps) plutôt qu'un seul — voir
// lib/businessRules.js pour la jointure qui alimente ce champ.
function pickRule(rules, { type, category, repId, countryId }) {
  const candidates = rules.filter(
    (r) => r.type === type && r.active && (!category || r.categories.includes(category))
  );
  return (
    candidates.find((r) => r.scope === "REPRESENTANT" && (r.rep_ids || []).includes(repId)) ||
    candidates.find((r) => r.scope === "PAYS" && r.country_id === countryId) ||
    candidates.find((r) => r.scope === "GLOBAL") ||
    null
  );
}

// lines: [{ product, qty, unitPriceHt, discountPct?, isGift, isReliquat }]
// Calcule discountPct final par ligne (si non fourni explicitement par le client)
// et les totaux du récapitulatif.
//
// Règle confirmée : plus aucune notion de remise Combo — uniquement des remises
// par catégorie (REMISE_CATEGORIE). Retiré après revue (il n'y a donc plus de
// question de priorité entre Combo et Catégorie, la question ne se pose plus).
export function computeOrderTotals({ lines, businessRules, repId, countryId }) {
  const computedLines = lines.map((line) => {
    if (line.isGift) {
      return { ...line, discountPct: 100, lineTotal: 0 };
    }

    let discountPct = line.discountPct ?? 0;
    if (line.discountPct === undefined || line.discountPct === null) {
      const catRule = pickRule(businessRules, {
        type: "REMISE_CATEGORIE",
        category: line.product.category,
        repId,
        countryId,
      });
      discountPct = catRule ? Number(catRule.rate_pct) || 0 : 0;
    }

    const gross = line.unitPriceHt * line.qty;
    const lineTotal = gross * (1 - discountPct / 100);
    return { ...line, discountPct, lineTotal };
  });

  const merchandiseAmount = computedLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalQty = computedLines.reduce((sum, l) => sum + l.qty, 0);

  const byCategory = {};
  for (const l of computedLines) {
    const key = l.product.category;
    byCategory[key] = byCategory[key] || { qty: 0, amount: 0 };
    byCategory[key].qty += l.qty;
    byCategory[key].amount += l.lineTotal;
  }

  const shippingRule = businessRules.find((r) => r.type === "FRAIS_DE_PORT" && r.active);
  const shippingFeeHt = shippingRule?.flat_amount != null ? Number(shippingRule.flat_amount) : DEFAULT_SHIPPING_FEE;
  const shippingThreshold = shippingRule?.threshold != null ? Number(shippingRule.threshold) : null;
  const autoOffered = shippingThreshold !== null && merchandiseAmount >= shippingThreshold;

  return {
    lines: computedLines,
    totalQty,
    merchandiseAmount,
    byCategory,
    shippingFeeHt,
    shippingAutoOffered: autoOffered,
  };
}
