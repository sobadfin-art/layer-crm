import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

const TABS = ["bestsellers", "customers", "analytics", "extraction"];

// Écran "Data" du directeur (section 3 : "accès complet à Data
// (Bestsellers/Analytics/Extraction)") — le Représentant/Master Rep n'ont
// encore qu'un ComingSoon sur /data (cf. App.jsx), ce module DIRECTEUR est
// donc le premier écran réel branché sur dashboard.js au-delà des widgets du
// tableau de bord. Quatre onglets, chacun sur son propre endpoint :
// bestsellers (DATA_ROLES), customer-performance (DATA_ROLES, comparatif N
// vs N-1), analytics (DIRECTEUR uniquement, ferme vs précommande par
// catégorie/pays) et extraction Excel (DIRECTEUR uniquement, téléchargement).
export default function Data() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("bestsellers");

  const [bestsellers, setBestsellers] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async (which) => {
    setLoading(true);
    setError(null);
    try {
      if (which === "bestsellers" && !bestsellers) setBestsellers(await api.get("/dashboard/bestsellers"));
      if (which === "customers" && !customers) setCustomers(await api.get("/dashboard/customer-performance"));
      if (which === "analytics" && !analytics) setAnalytics(await api.get("/dashboard/analytics"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestsellers, customers, analytics]);

  useEffect(() => {
    if (tab !== "extraction") load(tab);
  }, [tab, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleExtract() {
    setExporting(true);
    try {
      const blob = await api.get("/dashboard/extract.xlsx");
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

  function analyticsSplit(rows) {
    const ferme = rows.filter((r) => !r.isPrecommande).reduce((s, r) => s + Number(r.amount), 0);
    const precommande = rows.filter((r) => r.isPrecommande).reduce((s, r) => s + Number(r.amount), 0);
    return { ferme, precommande, total: ferme + precommande };
  }

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

      {tab !== "extraction" && loading && <p className="empty-state">{t("data.loading")}</p>}
      {tab !== "extraction" && error && <p className="error-text">{error}</p>}

      {tab === "bestsellers" && !loading && !error && (
        <div className="panel">
          {(!bestsellers || bestsellers.length === 0) && <p className="empty-state">{t("data.empty")}</p>}
          {bestsellers && bestsellers.length > 0 && (
            <table className="lines-table">
              <thead>
                <tr>
                  <th>{t("data.colRef")}</th>
                  <th>{t("data.colLabel")}</th>
                  <th>{t("data.colCategory")}</th>
                  <th>{t("data.colQty")}</th>
                  <th>{t("data.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {bestsellers.map((row) => (
                  <tr key={row.ref}>
                    <td>{row.ref}</td>
                    <td>{row.label}</td>
                    <td>{row.category}</td>
                    <td>{row.totalQty}</td>
                    <td>{money(row.totalAmount, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "customers" && !loading && !error && (
        <div className="panel">
          {(!customers || customers.length === 0) && <p className="empty-state">{t("data.empty")}</p>}
          {customers && customers.length > 0 && (
            <table className="lines-table">
              <thead>
                <tr>
                  <th>{t("data.colAccount")}</th>
                  <th>{t("data.colStage")}</th>
                  <th>{t("data.colCaCurrent")}</th>
                  <th>{t("data.colCaPrevious")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.accountId}>
                    <td>{row.accountName}</td>
                    <td>{t(`pipelineStage.${row.pipelineStage}`) || row.pipelineStage}</td>
                    <td>{money(row.caAnneeCourante, locale)}</td>
                    <td>{money(row.caAnneePrecedente, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "analytics" && !loading && !error && analytics && (
        <>
          <div className="cards-row">
            {(() => {
              const s = analyticsSplit(analytics.totals);
              const pct = s.total > 0 ? Math.round((s.ferme / s.total) * 100) : 0;
              return (
                <>
                  <div className="stat-card">
                    <div className="stat-label">{t("data.totalFerme")}</div>
                    <div className="stat-value">{money(s.ferme, locale)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">{t("data.totalPrecommande")}</div>
                    <div className="stat-value" style={{ color: "var(--gold)" }}>{money(s.precommande, locale)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">{t("data.fermeShare")}</div>
                    <div className="stat-value">{pct}%</div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="panel">
            <h3>{t("data.byCategory")}</h3>
            {analytics.byCategory.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
            {analytics.byCategory.map((row, idx) => (
              <div className="task-row" key={`${row.category}-${idx}`}>
                <span>
                  {row.category}
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
            {analytics.byCountry.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
            {analytics.byCountry.map((row, idx) => (
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
        </>
      )}

      {tab === "extraction" && (
        <div className="panel">
          <h3>{t("data.extractTitle")}</h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("data.extractHint")}</p>
          <button className="btn primary" onClick={handleExtract} disabled={exporting}>
            <Download size={15} /> {exporting ? t("data.extracting") : t("data.extractButton")}
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
