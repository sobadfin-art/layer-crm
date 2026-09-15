import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

const TYPOLOGIES = [
  "OPTICIEN", "SURF_SHOP", "FASHION_STORE", "SKATE_SHOP", "SKI_SHOP",
  "CONCEPT_STORE", "USHIP", "BIKE_STORE", "KEY_ACCOUNT", "DISTRIBUTOR", "AUTRE",
];
const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

// Cible confirmée par la dernière consigne de recette (PDF Directeur
// commercial section 6) : 3 entrées principales — Bestsellers, Analytics,
// Extraction. L'ancien 4e onglet "Performance clients" (comparatif N vs N-1,
// endpoint /dashboard/customer-performance) est retiré de cet écran — décision
// explicite plutôt qu'un arbitrage silencieux, cf. le PDF lui-même : "ce point
// doit être arbitré seulement si l'ancien onglet doit être conservé en plus".
// L'endpoint backend reste néanmoins en place : il est réutilisé tel quel par
// la page Data du Représentant (RepData.jsx), qui EST scopée pour la garder
// ("Bestsellers et Customer Performance" — PDF Représentant section 9).
const TABS = ["bestsellers", "analytics", "extraction"];

const ORDER_TYPES = ["ALL", "FERME", "PRECOMMANDE"];

export default function Data() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("bestsellers");

  const [bestsellers, setBestsellers] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const [members, setMembers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bsFilters, setBsFilters] = useState({ dateFrom: "", dateTo: "", repIds: [], typologies: [], categories: [] });

  // Analytics — comparatif Période A / Période B (PDF Directeur commercial
  // section 6.2). Période B optionnelle : sans borne, l'appel ne renvoie que
  // la période A (pas de comparatif), cf. dashboard.js.
  const [anFilters, setAnFilters] = useState({
    periodAStart: "",
    periodAEnd: "",
    periodBStart: "",
    periodBEnd: "",
    orderType: "ALL",
    repIds: [],
    masterRepIds: [],
    countryCodes: [],
    categories: [],
    typologies: [],
    accountId: "",
  });

  const [extractDateFrom, setExtractDateFrom] = useState("");
  const [extractDateTo, setExtractDateTo] = useState("");

  useEffect(() => {
    api.get("/team/members").then(setMembers).catch(() => {});
    api.get("/countries").then(setCountries).catch(() => {});
    api.get("/accounts").then(setAccounts).catch(() => {});
  }, []);

  const loadBestsellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (bsFilters.dateFrom) params.set("dateFrom", new Date(bsFilters.dateFrom).toISOString());
      if (bsFilters.dateTo) params.set("dateTo", new Date(`${bsFilters.dateTo}T23:59:59`).toISOString());
      if (bsFilters.repIds.length) params.set("repIds", bsFilters.repIds.join(","));
      if (bsFilters.typologies.length) params.set("typologies", bsFilters.typologies.join(","));
      if (bsFilters.categories.length) params.set("categories", bsFilters.categories.join(","));
      setBestsellers(await api.get(`/dashboard/bestsellers?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bsFilters]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = new URLSearchParams();
      if (anFilters.periodAStart) params.set("periodAStart", new Date(anFilters.periodAStart).toISOString());
      if (anFilters.periodAEnd) params.set("periodAEnd", new Date(`${anFilters.periodAEnd}T23:59:59`).toISOString());
      if (anFilters.periodBStart) params.set("periodBStart", new Date(anFilters.periodBStart).toISOString());
      if (anFilters.periodBEnd) params.set("periodBEnd", new Date(`${anFilters.periodBEnd}T23:59:59`).toISOString());
      if (anFilters.orderType !== "ALL") params.set("orderType", anFilters.orderType);
      if (anFilters.repIds.length) params.set("repIds", anFilters.repIds.join(","));
      if (anFilters.masterRepIds.length) params.set("masterRepIds", anFilters.masterRepIds.join(","));
      if (anFilters.countryCodes.length) params.set("countryCodes", anFilters.countryCodes.join(","));
      if (anFilters.categories.length) params.set("categories", anFilters.categories.join(","));
      if (anFilters.typologies.length) params.set("typologies", anFilters.typologies.join(","));
      if (anFilters.accountId) params.set("accountId", anFilters.accountId);
      setAnalytics(await api.get(`/dashboard/analytics?${params.toString()}`));
    } catch (err) {
      setAnalyticsError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [anFilters]);

  useEffect(() => {
    if (tab === "bestsellers") loadBestsellers();
    else if (tab === "analytics" && !analytics) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function toggleFilter(field, value) {
    setBsFilters((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((x) => x !== value) : [...f[field], value],
    }));
  }

  function toggleAnFilter(field, value) {
    setAnFilters((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((x) => x !== value) : [...f[field], value],
    }));
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleExtract() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (extractDateFrom) params.set("dateFrom", new Date(extractDateFrom).toISOString());
      if (extractDateTo) params.set("dateTo", new Date(`${extractDateTo}T23:59:59`).toISOString());
      const qs = params.toString();
      const blob = await api.get(`/dashboard/extract.xlsx${qs ? `?${qs}` : ""}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `extraction-moken-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast(t("data.extractDone"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setExporting(false);
    }
  }

  function renderPeriodCards(period, label) {
    const pct = period.totals.total > 0 ? Math.round((period.totals.ferme / period.totals.total) * 100) : 0;
    return (
      <div className="cards-row">
        <div className="stat-card">
          <div className="stat-label">{label}</div>
          <div className="stat-value">{money(period.totals.total, locale)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("data.totalFerme")}</div>
          <div className="stat-value">{money(period.totals.ferme, locale)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("data.totalPrecommande")}</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{money(period.totals.precommande, locale)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("data.fermeShare")}</div>
          <div className="stat-value">{pct}%</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  function renderPeriodDetail(period) {
    return (
      <>
        <div className="panel">
          <h3>{t("data.byCategory")}</h3>
          {period.byCategory.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
          {period.byCategory.map((row, idx) => (
            <div className="task-row" key={`${row.category}-${idx}`}>
              <span>
                {t(`category.${row.category}`) || row.category}
                <span className="typology-badge" style={{ marginLeft: 6 }}>
                  {row.isPrecommande ? t("data.precommande") : t("data.ferme")}
                </span>
              </span>
              <span>{money(row.amount, locale)}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>{t("data.byCountry")}</h3>
          {period.byCountry.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
          {period.byCountry.map((row, idx) => (
            <div className="task-row" key={`${row.countryCode}-${idx}`}>
              <span>
                {row.countryCode}
                <span className="typology-badge" style={{ marginLeft: 6 }}>
                  {row.isPrecommande ? t("data.precommande") : t("data.ferme")}
                </span>
              </span>
              <span>{money(row.amount, locale)}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>{t("data.byRep")}</h3>
          {period.byRep.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
          {period.byRep.map((row, idx) => (
            <div className="task-row" key={`${row.repId}-${idx}`}>
              <span>
                {row.repFirstName} {row.repLastName}
                <span className="typology-badge" style={{ marginLeft: 6 }}>
                  {row.isPrecommande ? t("data.precommande") : t("data.ferme")}
                </span>
              </span>
              <span>{money(row.amount, locale)}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  const masterRepsForAn = members.filter((m) => m.role === "MASTER_REP");
  const repsForAn = members.filter((m) => m.role === "REPRESENTANT");

  return (
    <>
      <h1 className="page-title">{t("data.title")}</h1>
      <p className="page-sub">{t("data.subtitle")}</p>

      <div className="cat-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((tb) => (
          <button key={tb} className={`cat-tab ${tab === tb ? "active" : ""}`} onClick={() => setTab(tb)}>
            {t(`data.tab.${tb}`)}
          </button>
        ))}
      </div>

      {tab === "bestsellers" && (
        <>
          <div className="panel">
            <h3>{t("data.filtersTitle")}</h3>
            <div className="form-row">
              <div className="field">
                <label>{t("data.filterDateFrom")}</label>
                <input type="date" value={bsFilters.dateFrom} onChange={(e) => setBsFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("data.filterDateTo")}</label>
                <input type="date" value={bsFilters.dateTo} onChange={(e) => setBsFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>{t("data.filterReps")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {members.map((m) => (
                  <span
                    key={m.id}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: bsFilters.repIds.includes(m.id) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleFilter("repIds", m.id)}
                  >
                    {m.firstName} {m.lastName}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.filterTypologies")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TYPOLOGIES.map((ty) => (
                  <span
                    key={ty}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: bsFilters.typologies.includes(ty) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleFilter("typologies", ty)}
                  >
                    {t(`typology.${ty}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.filterCategories")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: bsFilters.categories.includes(c) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleFilter("categories", c)}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={loadBestsellers} disabled={loading}>
              {loading ? t("data.generating") : t("data.generate")}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="panel">
            {(!bestsellers || bestsellers.length === 0) && !loading && <p className="empty-state">{t("data.empty")}</p>}
            {bestsellers && bestsellers.length > 0 && (
              <div className="table-scroll">
                <table className="lines-table">
                  <thead>
                    <tr>
                      <th>{t("data.colRef")}</th>
                      <th>{t("data.colLabel")}</th>
                      <th>{t("data.colCategory")}</th>
                      <th>{t("data.colTypology")}</th>
                      <th>{t("data.colRep")}</th>
                      <th>{t("data.colQty")}</th>
                      <th>{t("data.colAmount")}</th>
                      <th>{t("data.colAmountPrev")}</th>
                      <th>{t("data.colEvolution")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestsellers.map((row, idx) => {
                      const evolution =
                        row.prevAmount !== null && Number(row.prevAmount) > 0
                          ? Math.round(((Number(row.totalAmount) - Number(row.prevAmount)) / Number(row.prevAmount)) * 100)
                          : null;
                      return (
                        <tr key={`${row.ref}-${row.repFirstName}-${idx}`}>
                          <td>{row.ref}</td>
                          <td>{row.label}</td>
                          <td>{row.category}</td>
                          <td>{t(`typology.${row.typology}`)}</td>
                          <td>{row.repFirstName} {row.repLastName}</td>
                          <td>{row.totalQty}</td>
                          <td>{money(row.totalAmount, locale)}</td>
                          <td>{row.prevAmount !== null ? money(row.prevAmount, locale) : "—"}</td>
                          <td>{evolution !== null ? `${evolution > 0 ? "+" : ""}${evolution}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "analytics" && (
        <>
          <div className="panel">
            <h3>{t("data.anFiltersTitle")}</h3>
            <div className="form-row">
              <div className="field">
                <label>{t("data.anPeriodAStart")}</label>
                <input type="date" value={anFilters.periodAStart} onChange={(e) => setAnFilters((f) => ({ ...f, periodAStart: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("data.anPeriodAEnd")}</label>
                <input type="date" value={anFilters.periodAEnd} onChange={(e) => setAnFilters((f) => ({ ...f, periodAEnd: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("data.anPeriodBStart")}</label>
                <input type="date" value={anFilters.periodBStart} onChange={(e) => setAnFilters((f) => ({ ...f, periodBStart: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("data.anPeriodBEnd")}</label>
                <input type="date" value={anFilters.periodBEnd} onChange={(e) => setAnFilters((f) => ({ ...f, periodBEnd: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>{t("data.anOrderType")}</label>
              <select value={anFilters.orderType} onChange={(e) => setAnFilters((f) => ({ ...f, orderType: e.target.value }))}>
                {ORDER_TYPES.map((ot) => (
                  <option key={ot} value={ot}>{t(`data.anOrderType${ot}`)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("data.filterReps")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {repsForAn.map((m) => (
                  <span
                    key={m.id}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: anFilters.repIds.includes(m.id) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleAnFilter("repIds", m.id)}
                  >
                    {m.firstName} {m.lastName}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.anFilterMasterReps")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {masterRepsForAn.map((mr) => (
                  <span
                    key={mr.id}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: anFilters.masterRepIds.includes(mr.id) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleAnFilter("masterRepIds", mr.id)}
                  >
                    {mr.firstName} {mr.lastName}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.anFilterCountries")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {countries.map((c) => (
                  <span
                    key={c.code}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: anFilters.countryCodes.includes(c.code) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleAnFilter("countryCodes", c.code)}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.filterTypologies")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TYPOLOGIES.map((ty) => (
                  <span
                    key={ty}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: anFilters.typologies.includes(ty) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleAnFilter("typologies", ty)}
                  >
                    {t(`typology.${ty}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.filterCategories")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: anFilters.categories.includes(c) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleAnFilter("categories", c)}
                  >
                    {t(`category.${c}`) || c}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("data.anFilterAccount")}</label>
              <select value={anFilters.accountId} onChange={(e) => setAnFilters((f) => ({ ...f, accountId: e.target.value }))}>
                <option value="">{t("repData.allClients")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={loadAnalytics} disabled={analyticsLoading}>
              {analyticsLoading ? t("data.generating") : t("data.generate")}
            </button>
          </div>

          {analyticsError && <p className="error-text">{analyticsError}</p>}

          {analytics && analytics.periodA && (
            <>
              <h3 style={{ margin: "4px 0 8px" }}>{t("data.anPeriodALabel")}</h3>
              {renderPeriodCards(analytics.periodA, t("data.anPeriodALabel"))}

              {analytics.periodB && (
                <>
                  <div className="cards-row">
                    <div className="stat-card">
                      <div className="stat-label">{t("data.anEvolution")}</div>
                      <div className="stat-value" style={{ color: analytics.evolutionPct >= 0 ? "var(--success, #2f9e5c)" : "var(--danger)" }}>
                        {analytics.evolutionPct !== null ? `${analytics.evolutionPct > 0 ? "+" : ""}${Math.round(analytics.evolutionPct)}%` : "—"}
                      </div>
                    </div>
                  </div>
                  <h3 style={{ margin: "18px 0 8px" }}>{t("data.anPeriodBLabel")}</h3>
                  {renderPeriodCards(analytics.periodB, t("data.anPeriodBLabel"))}
                </>
              )}

              <h3 style={{ margin: "18px 0 8px" }}>{t("data.anPeriodALabel")} — {t("data.anDetailTitle")}</h3>
              {renderPeriodDetail(analytics.periodA)}

              {analytics.periodB && (
                <>
                  <h3 style={{ margin: "18px 0 8px" }}>{t("data.anPeriodBLabel")} — {t("data.anDetailTitle")}</h3>
                  {renderPeriodDetail(analytics.periodB)}
                </>
              )}
            </>
          )}
        </>
      )}

      {tab === "extraction" && (
        <div className="panel">
          <h3>{t("data.extractTitle")}</h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("data.extractHint")}</p>
          <div className="form-row">
            <div className="field">
              <label>{t("data.filterDateFrom")}</label>
              <input type="date" value={extractDateFrom} onChange={(e) => setExtractDateFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("data.filterDateTo")}</label>
              <input type="date" value={extractDateTo} onChange={(e) => setExtractDateTo(e.target.value)} />
            </div>
          </div>
          <button className="btn primary" onClick={handleExtract} disabled={exporting}>
            <Download size={15} /> {exporting ? t("data.extracting") : t("data.extractButton")}
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
