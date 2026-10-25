import { money } from "../lib/format.js";
import { totalsByCurrency } from "../lib/objectiveTotals.js";

// Point 7 — "réalisé / cible" d'un ensemble d'objectifs, une ligne par devise
// (EUR puis CHF), jamais additionnées. Sans aucun objectif : 0 € / 0 €, comme
// avant.
export default function ObjectiveAmounts({ objectives, locale, targetStyle, lineStyle }) {
  const byCur = totalsByCurrency(objectives);
  const currencies = ["EUR", "CHF"].filter((c) => byCur.has(c));
  if (currencies.length === 0) currencies.push("EUR");
  return currencies.map((cur) => {
    const v = byCur.get(cur) || { target: 0, achieved: 0 };
    return (
      <div key={cur} style={lineStyle}>
        {money(v.achieved, locale, cur)}
        <span style={targetStyle}> / {money(v.target, locale, cur)}</span>
      </div>
    );
  });
}
