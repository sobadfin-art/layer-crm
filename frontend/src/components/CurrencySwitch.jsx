// Point 7 (2026-10-25) — choix de la devise d'un écran d'agrégats (Data,
// Bestsellers, Analytics, Customer Performance). Les montants en euros et en
// francs suisses ne sont jamais additionnés : l'écran affiche une devise à la
// fois, EUR par défaut (comportement inchangé), CHF pour les ventes en Suisse.
export default function CurrencySwitch({ value, onChange, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t("data.currencyLabel")}</span>
      <div className="cat-tabs" style={{ margin: 0 }}>
        {["EUR", "CHF"].map((c) => (
          <button key={c} type="button" className={`cat-tab ${value === c ? "active" : ""}`} onClick={() => onChange(c)}>
            {c}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{t("data.currencyHint")}</span>
    </div>
  );
}
