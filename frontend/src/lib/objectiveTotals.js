// Point 7 (2026-10-25) — totaux d'objectifs SÉPARÉS PAR DEVISE. Les objectifs
// EUR et les objectifs CHF (représentant qui vend en Suisse) ne sont jamais
// additionnés : chaque devise a son propre total cible/réalisé, et aucune
// conversion n'est faite. Un objectif sans `currency` (antérieur à la
// migration 026) est en EUR.
export const objectiveCurrency = (o) => o.currency || "EUR";

export function totalsByCurrency(list) {
  const out = new Map();
  for (const o of list) {
    const cur = objectiveCurrency(o);
    const acc = out.get(cur) || { target: 0, achieved: 0 };
    acc.target += Number(o.targetAmount);
    acc.achieved += o.progress ? Number(o.progress.achievedAmount) : 0;
    out.set(cur, acc);
  }
  return out;
}

// Totaux de la devise "principale" (EUR s'il existe au moins un objectif en
// euros, sinon CHF) — sert uniquement au pourcentage des barres de
// progression, qui ne peut pas mélanger deux devises.
export function primaryTotals(list) {
  const byCur = totalsByCurrency(list);
  return byCur.get("EUR") || byCur.get("CHF") || { target: 0, achieved: 0 };
}
