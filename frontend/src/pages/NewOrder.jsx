import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate } from "../lib/format.js";

const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

function parsePgArray(str) {
  if (!str || typeof str !== "string") return [];
  const inner = str.replace(/^\{/, "").replace(/\}$/, "");
  return inner ? inner.split(",").filter(Boolean) : [];
}

function unitPriceFor(product, countryCode) {
  if (countryCode === "FR" || countryCode === "ES") return Number(product.priceFr) || 0;
  if (countryCode === "CH") return Number(product.priceCh) || 0;
  return Number(product.priceExport) || 0;
}

// Choisit la règle de remise catégorie la plus spécifique (Représentant >
// Pays > Global) — même logique de priorité que lib/pricing.js côté serveur.
// Depuis la migration 013, une règle de portée REPRESENTANT cible une
// sélection multiple de représentants (`repIds`) plutôt qu'un seul : le
// bouton de remise n'apparaît que pour les représentants inclus dans cette
// sélection, qui choisissent ensuite de l'activer ou non par commande.
// Ceci n'est qu'un APERÇU affiché au représentant : le serveur recalcule
// toujours la remise réelle à l'enregistrement de la commande (POST /api/orders),
// jamais fait confiance à ce que le client envoie.
function pickDiscountRule(rules, category, repId, countryId) {
  const candidates = rules.filter((r) => {
    if (r.type !== "REMISE_CATEGORIE" || !r.active) return false;
    const cats = parsePgArray(r.categories);
    return cats.length === 0 || cats.includes(category);
  });
  return (
    candidates.find((r) => r.scope === "REPRESENTANT" && (r.repIds || []).includes(repId)) ||
    candidates.find((r) => r.scope === "PAYS" && r.countryId === countryId) ||
    candidates.find((r) => r.scope === "GLOBAL") ||
    null
  );
}

// Prise de commande + panier, combinés en un seul écran (deux sous-vues
// internes, fidèle à la maquette docs/prototype-crm-commercial.jsx —
// view === "prise-commande" / "panier") pour ne pas perdre l'état du panier
// entre deux routes. Toujours rattachée à un compte (accountId dans l'URL),
// jamais accessible depuis le catalogue de référence.
export default function NewOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [account, setAccount] = useState(null);
  const [products, setProducts] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [subview, setSubview] = useState("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  // cart: Map productId -> { qty, isGift }
  const [cart, setCart] = useState(new Map());
  const [discountApplied, setDiscountApplied] = useState({}); // par catégorie
  const [shippingOffered, setShippingOffered] = useState(false);
  const [isPrecommande, setIsPrecommande] = useState(false);
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.get(`/accounts/${id}`), api.get("/products"), api.get("/business-rules")])
      .then(([accountData, productsData, rulesData]) => {
        setAccount(accountData);
        setProducts(productsData);
        setRules(rulesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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

  function changeQty(productId, delta) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { qty: 0, isGift: false };
      const qty = Math.max(0, current.qty + delta);
      if (qty === 0) {
        next.delete(productId);
      } else {
        next.set(productId, { ...current, qty });
      }
      return next;
    });
  }

  function toggleGift(productId) {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId);
      if (!current) return prev;
      next.set(productId, { ...current, isGift: !current.isGift });
      return next;
    });
  }

  const cartItems = useMemo(() => {
    return [...cart.entries()]
      .map(([productId, entry]) => {
        const product = productById.get(productId);
        if (!product) return null;
        const unitPrice = account ? unitPriceFor(product, account.countryCode) : 0;
        return { productId, product, ...entry, unitPrice };
      })
      .filter(Boolean);
  }, [cart, productById, account]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const byCategory = useMemo(() => {
    const groups = {};
    for (const item of cartItems) {
      const cat = item.product.category;
      groups[cat] = groups[cat] || { items: [], subtotal: 0 };
      groups[cat].items.push(item);
      if (!item.isGift) groups[cat].subtotal += item.unitPrice * item.qty;
    }
    return groups;
  }, [cartItems]);

  function discountRateFor(cat) {
    if (!account) return 0;
    const rule = pickDiscountRule(rules, cat, account.ownerRepId, account.countryId);
    return rule ? Number(rule.ratePct) || 0 : 0;
  }

  const shippingRule = rules.find((r) => r.type === "FRAIS_DE_PORT" && r.active);
  const shippingAmount = shippingRule?.flatAmount != null ? Number(shippingRule.flatAmount) : 9.6;
  const shippingThreshold = shippingRule?.threshold != null ? Number(shippingRule.threshold) : null;

  const totalAmount = cartItems.reduce((s, i) => {
    if (i.isGift) return s;
    const rate = discountApplied[i.product.category] !== false ? discountRateFor(i.product.category) : 0;
    return s + i.unitPrice * i.qty * (1 - rate / 100);
  }, 0);
  const shippingAutoEligible = shippingThreshold !== null && totalAmount >= shippingThreshold;
  const grandTotal = shippingOffered || shippingAutoEligible ? totalAmount : totalAmount + shippingAmount;

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const lines = cartItems.map((item) => {
        const applied = discountApplied[item.product.category] !== false;
        const isReliquat = !isPrecommande && item.product.stockStatus === "REASSORT_PREVU";
        return {
          productId: item.productId,
          qty: item.qty,
          isGift: item.isGift,
          discountPct: item.isGift ? undefined : applied ? undefined : 0,
          isReliquat,
        };
      });

      const order = await api.post("/orders", {
        accountId: id,
        isPrecommande,
        desiredDeliveryDate: desiredDeliveryDate ? new Date(`${desiredDeliveryDate}T00:00:00`).toISOString() : null,
        note: note.trim() || null,
        shippingOffered,
        lines,
      });

      await api.post(`/orders/${order.id}/send-to-front-desk`);

      setCart(new Map());
      navigate("/commandes", { state: { toast: t("newOrder.submitSuccess") } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="empty-state">{t("account.loading")}</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!account) return <p className="error-text">{t("account.notFound")}</p>;

  return (
    <>
      <button className="btn outline" style={{ marginBottom: 14 }} onClick={() => navigate(`/clients/${id}`)}>
        <ArrowLeft size={14} /> {t("newOrder.backToClient")}
      </button>

      {subview === "browse" && (
        <>
          <h1 className="page-title">{t("newOrder.title", { name: account.name })}</h1>
          <p className="page-sub">{t("newOrder.subtitle")}</p>

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

          {filtered.length === 0 && <p className="empty-state">{t("catalogue.empty")}</p>}

          <div className="product-grid">
            {filtered.map((p) => {
              const entry = cart.get(p.id);
              const price = account ? unitPriceFor(p, account.countryCode) : null;
              return (
                <div className="product-card" key={p.id}>
                  {p.photoUrl ? <img src={p.photoUrl} alt={p.label} /> : <div style={{ height: 100, background: "var(--bg)" }} />}
                  <div className="product-body">
                    <div className="product-ref">{p.ref}</div>
                    <div className="product-name">{p.label}</div>
                    <div className="product-price">{price ? money(price, locale) : t("catalogue.priceUnset")}</div>
                    <div className="qty-row">
                      <button type="button" disabled={!entry} onClick={() => changeQty(p.id, -1)}>
                        <Minus size={13} />
                      </button>
                      <span className="qty">{entry?.qty || 0}</span>
                      <button type="button" onClick={() => changeQty(p.id, 1)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {cartCount > 0 && (
            <button
              className="btn primary"
              style={{ position: "sticky", bottom: 14, marginTop: 18, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setSubview("cart")}
            >
              <ShoppingCart size={15} /> {t("newOrder.viewCart", { count: cartCount })}
            </button>
          )}
        </>
      )}

      {subview === "cart" && (
        <>
          <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => setSubview("browse")}>
            <ArrowLeft size={14} /> {t("newOrder.backToCatalogue")}
          </button>
          <h1 className="page-title">{t("newOrder.cartTitle", { name: account.name })}</h1>
          <p className="page-sub">{t("newOrder.cartSubtitle")}</p>

          {cartItems.length === 0 && <p className="empty-state">{t("newOrder.cartEmpty")}</p>}

          {Object.entries(byCategory).map(([cat, g]) => {
            const rate = discountRateFor(cat);
            const applied = discountApplied[cat] !== false;
            return (
              <div className="cat-block panel" key={cat}>
                <div className="cat-head">
                  <h4>{t(`category.${cat}`)}</h4>
                  {rate > 0 && (
                    <div className="toggle" onClick={() => setDiscountApplied((d) => ({ ...d, [cat]: !applied }))}>
                      {t("newOrder.discountLabel", { pct: rate })}
                      <div className={`switch ${applied ? "on" : ""}`} />
                    </div>
                  )}
                </div>
                {g.items.map((i) => (
                  <div className="line-item" key={i.productId}>
                    <span>
                      {i.qty} × {i.product.label} {i.isGift && <span className="offert-badge">{t("newOrder.giftLabel")}</span>}
                      {!isPrecommande && i.product.stockStatus === "REASSORT_PREVU" && (
                        <span className="offert-badge" style={{ marginLeft: 4 }}>
                          {t("newOrder.reliquatBadge")}
                          {i.product.restockDate ? ` (${shortDate(i.product.restockDate, locale)})` : ""}
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="toggle" onClick={() => toggleGift(i.productId)}>
                        {t("newOrder.giftLabel")} <div className={`switch gold ${i.isGift ? "on" : ""}`} />
                      </div>
                      <span>{i.isGift ? money(0, locale) : money(i.unitPrice * i.qty, locale)}</span>
                    </div>
                  </div>
                ))}
                <div className="cat-subtotal">
                  <span>
                    {applied && rate > 0
                      ? t("newOrder.subtotalDiscounted", { qty: g.items.reduce((s, i) => s + i.qty, 0) })
                      : t("newOrder.subtotalGross", { qty: g.items.reduce((s, i) => s + i.qty, 0) })}
                  </span>
                  <span>{money(applied ? g.subtotal * (1 - rate / 100) : g.subtotal, locale)}</span>
                </div>
              </div>
            );
          })}

          {cartItems.length > 0 && (
            <div className="cat-block panel">
              <div className="cat-head">
                <h4>{t("newOrder.shippingSection")}</h4>
                <div className="toggle" onClick={() => setShippingOffered((v) => !v)}>
                  {t("newOrder.shippingOffer")} <div className={`switch gold ${shippingOffered ? "on" : ""}`} />
                </div>
              </div>
              <div className="line-item">
                <span>
                  {t("newOrder.shippingSection")} {shippingOffered && <span className="offert-badge">{t("newOrder.shippingOffered")}</span>}
                </span>
                <span>{shippingOffered || shippingAutoEligible ? t("newOrder.shippingOffered") : money(shippingAmount, locale)}</span>
              </div>
              {shippingThreshold !== null && !shippingOffered && (
                <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                  {shippingAutoEligible
                    ? t("newOrder.shippingHintEligible", { amount: money(shippingThreshold, locale) })
                    : t("newOrder.shippingHintMissing", {
                        amount: money(shippingThreshold, locale),
                        remaining: money(Math.max(0, shippingThreshold - totalAmount), locale),
                      })}
                </p>
              )}
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="panel">
              <h3>{t("newOrder.totalsTitle")}</h3>
              <div className="task-row">
                <span>{t("newOrder.totalQty")}</span>
                <span>{t("newOrder.totalQtyValue", { qty: cartCount })}</span>
              </div>
              <div className="task-row">
                <span>{t("newOrder.totalAmount")}</span>
                <span>{money(totalAmount, locale)}</span>
              </div>
              <div className="task-row">
                <span>{t("newOrder.totalShipping")}</span>
                <span>{shippingOffered || shippingAutoEligible ? t("newOrder.shippingOffered") : money(shippingAmount, locale)}</span>
              </div>
              <div className="task-row" style={{ fontWeight: 800, borderTop: "1px dashed var(--line)", paddingTop: 8, marginTop: 4 }}>
                <span>{t("newOrder.totalOrder")}</span>
                <span>{money(grandTotal, locale)}</span>
              </div>
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="panel">
              <h3>{t("newOrder.extraInfoTitle")}</h3>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  marginBottom: 12,
                  padding: "8px 10px",
                  background: isPrecommande ? "var(--gold-soft)" : "transparent",
                  borderRadius: 5,
                }}
              >
                <input type="checkbox" checked={isPrecommande} onChange={(e) => setIsPrecommande(e.target.checked)} />
                <span style={{ fontWeight: 600 }}>{t("newOrder.precommandeLabel")}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>— {t("newOrder.precommandeHint")}</span>
              </label>
              <div className="cc-field">
                <label>{t("newOrder.desiredDeliveryLabel")}</label>
                <input
                  type="date"
                  value={desiredDeliveryDate}
                  onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="cc-field">
                <label>{t("newOrder.noteLabel")}</label>
                <textarea placeholder={t("newOrder.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}

          {submitError && <p className="error-text">{submitError}</p>}

          {cartItems.length > 0 && (
            <>
              <div className="grand-total">
                <span>{t("newOrder.totalOrder")}</span>
                <span>{money(grandTotal, locale)}</span>
              </div>
              <button className="btn primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? t("newOrder.submitting") : t("newOrder.submit")}
              </button>
            </>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
