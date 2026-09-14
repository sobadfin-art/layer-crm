import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate } from "../lib/format.js";

const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

// Catalogue de référence — consultation seule, fidèle à la maquette
// (docs/prototype-crm-commercial.jsx, role === "rep", view === "catalogue") :
// la prise de commande elle-même se fait depuis la fiche d'un client
// (bouton "Nouvelle commande" sur AccountDetail.jsx -> /clients/:id/commande),
// jamais depuis cet écran.
export default function Catalogue() {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState([]);
  const [shippingRule, setShippingRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.get("/products"), api.get("/business-rules")])
      .then(([productsData, rulesData]) => {
        setProducts(productsData);
        setShippingRule(rulesData.find((r) => r.type === "FRAIS_DE_PORT" && r.active) || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => p.category === c)),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.productStatus === "DISCONTINUE") return false;
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return [p.ref, p.label, p.model, p.color].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [products, search, category]);

  function stockLine(p) {
    if (p.stockStatus === "EN_STOCK") {
      return { text: t("catalogue.stockEnStock"), color: "var(--teal)" };
    }
    if (p.stockStatus === "REASSORT_PREVU") {
      return {
        text: p.restockDate ? t("catalogue.restockOn", { date: shortDate(p.restockDate, locale) }) : t("catalogue.restockUnknown"),
        color: "var(--danger)",
      };
    }
    return {
      text: p.restockDate ? t("catalogue.outOfStockReturn", { date: shortDate(p.restockDate, locale) }) : t("catalogue.outOfStockUnknown"),
      color: "var(--danger)",
    };
  }

  return (
    <>
      <h1 className="page-title">{t("catalogue.title")}</h1>
      <p className="page-sub">{t("catalogue.subtitle")}</p>

      {shippingRule && (
        <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t("catalogue.shippingLabel")}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
              {shippingRule.threshold != null
                ? t("catalogue.shippingHintThreshold", { amount: money(shippingRule.threshold, locale) })
                : t("catalogue.shippingHint")}
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{money(shippingRule.flatAmount ?? 9.6, locale)}</div>
        </div>
      )}

      <div className="search-bar">
        <Search size={15} color="#8892a0" />
        <input placeholder={t("catalogue.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="cat-tabs">
        <button className={`cat-tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
          {t("catalogue.filterAll")}
        </button>
        {presentCategories.map((c) => (
          <button key={c} className={`cat-tab ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {t(`category.${c}`)}
          </button>
        ))}
      </div>

      {loading && <p className="empty-state">{t("catalogue.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="empty-state">{t("catalogue.empty")}</p>}

      <div className="product-grid">
        {filtered.map((p) => {
          const stock = stockLine(p);
          const price = p.priceFr ?? p.rrp;
          return (
            <div className="product-card" key={p.id}>
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.label} />
              ) : (
                <div style={{ height: 100, background: "var(--bg)" }} />
              )}
              <div className="product-body">
                <div className="product-ref">
                  {p.ref} {p.productStatus === "NOUVEAU" && <span className="offert-badge">{t("catalogue.newBadge")}</span>}
                </div>
                <div className="product-name">{p.label}</div>
                <div className="product-price">
                  {price != null ? money(price, locale) : <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{t("catalogue.priceUnset")}</span>}
                </div>
                <div className="product-stock" style={{ color: stock.color }}>
                  {stock.text}
                </div>
                {p.catalogName && <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>{p.catalogName}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
