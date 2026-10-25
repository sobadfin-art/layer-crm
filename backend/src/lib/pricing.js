// Moteur de calcul de la prise de commande — cf. etat-final-prototype-handoff.md
// section 5 (règles commerciales) et section 6 (récapitulatif de commande).
// Le prix unitaire n'est JAMAIS accepté du client : il est toujours recalculé
// côté serveur à partir du produit + du pays du compte, pour éviter toute
// manipulation.

const DEFAULT_SHIPPING_FEE = 9.6;

// GROS BUG CORRIGÉ (2026-09-16, remontée directe utilisateur : "Quand un
// représentant est dans un pays autre que la France, (Autre Prix) le prix
// export ne s'applique pas") : cette fonction faisait bénéficier l'Espagne de
// la grille tarifaire France (priceFR) — c'était même documenté ainsi dans le
// handoff d'origine ("France et Espagne partagent la même grille tarifaire",
// section 5), mais ce n'est PAS la règle commerciale réelle. Règle confirmée
// par l'utilisateur : en Europe et DOM-TOM, seule la France a le prix France ;
// tous les autres pays (dont l'Espagne) ont le prix Export ; la Suisse a son
// propre prix Suisse. Basé sur le pays du COMPTE client (account.country_code,
// déjà présent sur la fiche client), jamais celui du représentant — un
// représentant peut avoir des clients dans plusieurs pays.
export function resolveUnitPrice(product, countryCode) {
  if (countryCode === "FR") return product.price_fr;
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
//
// Point 7 (2026-10-25) — commande en CHF (client suisse) : les remises
// catégorie sont des POURCENTAGES (sans unité) et suivent la priorité
// habituelle Représentant > Pays (Suisse) > Global. Les frais de port, eux,
// sont des MONTANTS : une règle globale est exprimée en euros et ne
// s'applique jamais à une commande en CHF. Seule une règle FRAIS_DE_PORT de
// portée "Pays : Suisse" (montants saisis en CHF) est retenue ; sans elle, le
// port est "à définir" (shippingToDefine) — jamais les 9,60 € par défaut.
// Réciproquement, une règle de port "Pays : Suisse" n'est jamais appliquée à
// une commande en EUR.
export function isSwissRule(rule) {
  return rule.scope === "PAYS" && rule.country_code === "CH";
}

export function pickShippingRule(businessRules, { currency }) {
  const active = businessRules.filter((r) => r.type === "FRAIS_DE_PORT" && r.active);
  if (currency === "CHF") return active.find(isSwissRule) || null;
  return active.find((r) => !isSwissRule(r)) || null;
}

export function computeOrderTotals({ lines, businessRules, repId, countryId, currency = "EUR" }) {
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

  const shippingRule = pickShippingRule(businessRules, { currency });
  const shippingToDefine = currency === "CHF" && (!shippingRule || shippingRule.flat_amount == null);
  const shippingFeeHt = shippingToDefine
    ? 0
    : shippingRule?.flat_amount != null
    ? Number(shippingRule.flat_amount)
    : DEFAULT_SHIPPING_FEE;
  const shippingThreshold = shippingRule?.threshold != null ? Number(shippingRule.threshold) : null;
  const autoOffered = !shippingToDefine && shippingThreshold !== null && merchandiseAmount >= shippingThreshold;

  return {
    currency,
    shippingToDefine,
    lines: computedLines,
    totalQty,
    merchandiseAmount,
    byCategory,
    shippingFeeHt,
    shippingAutoOffered: autoOffered,
  };
}
