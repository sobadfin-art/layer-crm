import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

// Data — profil Représentant (PDF section 9) : périmètre volontairement plus
// restreint que le Directeur — seulement Bestsellers et Customer Performance,
// limités à son propre portefeuille (déjà garanti côté serveur par
// repScopeForDashboard, jamais par un filtre côté client). Remplace le
// ComingSoon qui occupait /data pour ce rôle jusqu'ici.
const TABS = ["bestsellers", "customers"];

export default function RepData() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("bestsellers");
  const [accounts, setAccounts] = useState([]);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [accountId, setAccountId] = useState("all");
  const [bestsellers, setBestsellers] = useState(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsError, setBsError] = useState(null);
  const [generated, setGenerated] = useState(false);

  const [custYear, setCustYear] = useState(String(new Date().getFullYear()));
  const [customers, setCustomers] = useState(null);
  const [custLoading, setCustLoading] = useState(true);
  const [custError, setCustError] = useState(null);

  useEffect(() => {
    api.get("/accounts").then(setAccounts).catch(() => {});
  }, []);

  const loadCustomerPerformance = useCallback((yr) => {
    setCustLoading(true);
    setCustError(null);
    api
      .get(`/dashboard/customer-performance?year=${yr}`)
      .then(setCustomers)
      .catch((err) => setCustError(err.message))
      .finally(() => setCustLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "customers" || customers) return;
    loadCustomerPerformance(custYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, customers]);

  // Contribution au portefeuille (part du CA de l'année sélectionnée) —
  // critère demandé par la fiche corrective V2 section 8 ("contribution au
  // portefeuille selon les données réellement disponibles"), dérivé côté
  // client à partir du classement déjà renvoyé par le serveur.
  const portfolioTotal = (customers || []).reduce((s, r) => s + Number(r.caAnneeCourante || 0), 0);

  async function handleGenerate() {
    setBsLoading(true);
    setBsError(null);
    try {
      const params = new URLSearchParams();
      params.set("dateFrom", `${year}-01-01T00:00:00.000Z`);
      params.set("dateTo", `${year}-12-31T23:59:59.999Z`);
      if (accountId !== "all") params.set("accountId", accountId);
      setBestsellers(await api.get(`/dashboard/bestsellers?${params.toString()}`));
      setGenerated(true);
    } catch (err) {
      setBsError(err.message);
    } finally {
      setBsLoading(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <>
      <h1 className="page-title">{t("repData.title")}</h1>
      <p className="page-sub">{t("repData.subtitle")}</p>

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
            <div className="form-row">
              <div className="field">
                <label>{t("repData.year")}</label>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("repData.client")}</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="all">{t("repData.allClients")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn primary" onClick={handleGenerate} disabled={bsLoading}>
              {bsLoading ? t("data.generating") : t("data.generate")}
            </button>
          </div>

          {bsError && <p className="error-text">{bsError}</p>}

          {generated && (
            <div className="panel">
              {bestsellers && bestsellers.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
              {bestsellers && bestsellers.length > 0 && (
                <div className="table-scroll">
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
                      {bestsellers.map((row, idx) => (
                        <tr key={`${row.ref}-${idx}`}>
                          <td>{row.ref}</td>
                          <td>{row.label}</td>
                          <td>{row.category}</td>
                          <td>{row.totalQty}</td>
                          <td>{money(row.totalAmount, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "customers" && (
        <>
          <div className="panel">
            <div className="form-row">
              <div className="field">
                <label>{t("repData.year")}</label>
                <select value={custYear} onChange={(e) => setCustYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn primary" onClick={() => loadCustomerPerformance(custYear)} disabled={custLoading}>
              {custLoading ? t("data.generating") : t("data.generate")}
            </button>
          </div>

          <div className="panel">
            {custLoading && <p className="empty-state">{t("data.loading")}</p>}
            {custError && <p className="error-text">{custError}</p>}
            {!custLoading && customers && customers.length === 0 && <p className="empty-state">{t("data.empty")}</p>}
            {!custLoading && customers && customers.length > 0 && (
              <div className="table-scroll">
                <table className="lines-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("data.colAccount")}</th>
                      <th>{t("data.colStage")}</th>
                      <th>{t("data.colCaCurrent")}</th>
                      <th>{t("data.colCaPrevious")}</th>
                      <th>{t("repData.colEvolution")}</th>
                      <th>{t("repData.colOrderCount")}</th>
                      <th>{t("repData.colContribution")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((row, idx) => {
                      const current = Number(row.caAnneeCourante || 0);
                      const previous = Number(row.caAnneePrecedente || 0);
                      const evolution = previous > 0 ? ((current - previous) / previous) * 100 : null;
                      const contribution = portfolioTotal > 0 ? (current / portfolioTotal) * 100 : 0;
                      return (
                        <tr key={row.accountId}>
                          <td>{idx + 1}</td>
                          <td>{row.accountName}</td>
                          <td>{row.pipelineStage}</td>
                          <td>{money(current, locale)}</td>
                          <td>{money(previous, locale)}</td>
                          <td>{evolution === null ? "—" : `${evolution >= 0 ? "+" : ""}${evolution.toFixed(0)}%`}</td>
                          <td>{row.orderCount ?? 0}</td>
                          <td>{contribution.toFixed(0)}%</td>
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
    </>
  );
}
