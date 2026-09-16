import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Target } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate } from "../lib/format.js";
import AccountsMap from "../components/AccountsMap.jsx";
import { fiscalYearBounds, fiscalYearLabel } from "../lib/fiscalYear.js";

// 11 typologies réelles (remplace l'ancien modèle à 2 "secteurs" agrégés
// depuis la migration 015 — cf. PDF Directeur commercial section 4 :
// "sélectionner une ou plusieurs typologies de clients / réseaux").
const TYPOLOGIES = [
  "OPTICIEN", "SURF_SHOP", "FASHION_STORE", "SKATE_SHOP", "SKI_SHOP",
  "CONCEPT_STORE", "USHIP", "BIKE_STORE", "KEY_ACCOUNT", "DISTRIBUTOR", "AUTRE",
];
const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

// Un objectif est "actif" si la date du jour tombe dans sa période — même
// règle que Equipe.jsx/Dashboard.jsx.
function isActivePeriod(o) {
  const now = Date.now();
  return new Date(o.periodStart).getTime() <= now && now <= new Date(o.periodEnd).getTime();
}

function sumTargetAchieved(list) {
  return list.reduce(
    (acc, o) => ({
      target: acc.target + Number(o.targetAmount),
      achieved: acc.achieved + (o.progress ? Number(o.progress.achievedAmount) : 0),
    }),
    { target: 0, achieved: 0 }
  );
}

// Tableau de bord global du Directeur (section 3 : "vision globale sur toute
// l'entreprise" + "fixe les objectifs"). Combine dans un seul écran :
//  - les indicateurs globaux (CA ferme, précommande, commandes en attente
//    front desk — GET /orders?status=ENVOYEE_FRONT_DESK, seul le compte
//    importe ici, la file elle-même reste consultable via /orders, l'onglet
//    "Front desk" déjà routé) ;
//  - la performance de toute l'équipe (Master Reps + leurs représentants +
//    représentants non rattachés), même construction que Equipe.jsx (Master
//    Rep) mais sur GET /team/members (équipe complète) + GET /objectives
//    (non filtré côté serveur pour un directeur — cf. objectives.js) ;
//  - la fixation d'objectifs (POST /objectives, réservé DIRECTEUR), seul
//    endroit de l'app où un objectif est créé — le Master Rep ne les voit
//    qu'en lecture seule (Equipe.jsx/RepProfile.jsx).
export default function DirecteurDashboard() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [members, setMembers] = useState([]);
  const [objectivesWithProgress, setObjectivesWithProgress] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 4 KPI clients (fiche corrective V2 Direction commerciale, section 2.3 :
  // "Réintégrer dans le dashboard Direction commerciale les indicateurs qui
  // existaient dans le dashboard des représentants" — actifs / inactifs /
  // commandé depuis le début de la période / pas commandé depuis le début de
  // la période). Portée globale (tous les comptes, pas de scoping par rep :
  // GET /accounts et GET /orders ne filtrent rien pour un DIRECTEUR — cf.
  // lib/scope.js / routes/orders.js).
  //
  // Mise à jour (2026-09-16, confirmation explicite du client) : ces deux
  // indicateurs "année en cours" basculent de l'année CIVILE (1er janvier) à
  // l'année COMMERCIALE (01/11-31/10, cf. lib/fiscalYear.js), pour rester
  // lisibles avec le même repère que le portefeuille du Dashboard
  // Représentant, qui utilisait déjà cette période. Périmètre volontairement
  // limité à la lisibilité de ces indicateurs cumulés du Dashboard (ici et le
  // bloc CA ferme/précommande cumulés plus bas) — aucune autre donnée
  // Directeur (Data/extraction, historique fiche compte...) n'est concernée.
  const [accounts, setAccounts] = useState([]);
  const [ordersThisYear, setOrdersThisYear] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  const loadPortfolio = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const { start } = fiscalYearBounds();
      const [accountsData, ordersData] = await Promise.all([
        api.get("/accounts"),
        api.get(`/orders?dateFrom=${encodeURIComponent(start.toISOString())}`),
      ]);
      setAccounts(accountsData);
      setOrdersThisYear(ordersData);
    } catch {
      // Non bloquant — le reste du tableau de bord reste utilisable.
    } finally {
      setLoadingPortfolio(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const [showNewObjective, setShowNewObjective] = useState(false);
  const [form, setForm] = useState({
    repId: "",
    type: "CHIFFRE_AFFAIRES",
    typologies: [],
    categories: [],
    periodStart: "",
    periodEnd: "",
    targetAmount: "",
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersData, objectivesData, pendingOrders] = await Promise.all([
        api.get("/team/members"),
        api.get("/objectives"),
        api.get("/orders?status=ENVOYEE_FRONT_DESK"),
      ]);
      setMembers(membersData);
      setPendingOrdersCount(pendingOrders.length);

      const activeObjectives = objectivesData.filter(isActivePeriod);
      const withProgress = await Promise.all(
        activeObjectives.map(async (o) => {
          try {
            const progress = await api.get(`/objectives/${o.id}/progress`);
            return { ...o, progress };
          } catch {
            return { ...o, progress: null };
          }
        })
      );
      setObjectivesWithProgress(withProgress);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function objectivesFor(repId, type) {
    return objectivesWithProgress.filter((o) => o.repId === repId && o.type === type);
  }

  const masterReps = members.filter((m) => m.role === "MASTER_REP");
  const reps = members.filter((m) => m.role === "REPRESENTANT");
  const unassignedReps = reps.filter((r) => !r.masterRepId);

  const activeClients = accounts.filter((a) => a.type === "CLIENT" && a.status === "ACTIF");
  const inactiveClients = accounts.filter((a) => a.type === "CLIENT" && a.status === "INACTIF");
  const accountIdsWithOrderThisYear = new Set(ordersThisYear.map((o) => o.accountId));
  const activeClientsOrdered = activeClients.filter((a) => accountIdsWithOrderThisYear.has(a.id));
  const activeClientsNotOrdered = activeClients.filter((a) => !accountIdsWithOrderThisYear.has(a.id));

  const teamCa = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "CHIFFRE_AFFAIRES"));
  const teamPrecommande = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "PRECOMMANDE"));
  const teamCaPct = teamCa.target > 0 ? Math.min(100, Math.round((teamCa.achieved / teamCa.target) * 100)) : 0;
  const teamPrecommandePct =
    teamPrecommande.target > 0 ? Math.min(100, Math.round((teamPrecommande.achieved / teamPrecommande.target) * 100)) : 0;

  function toggleFormValue(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((x) => x !== value) : [...f[field], value],
    }));
  }

  async function handleCreateObjective(e) {
    e.preventDefault();
    setFormError(null);
    if (!form.repId || !form.periodStart || !form.periodEnd || !form.targetAmount) {
      setFormError(t("directeurDashboard.objectiveMissing"));
      return;
    }
    if (new Date(form.periodEnd) <= new Date(form.periodStart)) {
      setFormError(t("directeurDashboard.objectivePeriodInvalid"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/objectives", {
        repId: form.repId,
        type: form.type,
        typologies: form.typologies,
        categories: form.categories,
        periodStart: new Date(form.periodStart).toISOString(),
        periodEnd: new Date(form.periodEnd).toISOString(),
        targetAmount: Number(form.targetAmount),
      });
      setForm({ repId: "", type: "CHIFFRE_AFFAIRES", typologies: [], categories: [], periodStart: "", periodEnd: "", targetAmount: "" });
      setShowNewObjective(false);
      setToast(t("directeurDashboard.objectiveCreated"));
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function MemberPerfRow({ member, indent }) {
    const caObjectives = objectivesFor(member.id, "CHIFFRE_AFFAIRES");
    const repCa = sumTargetAchieved(caObjectives);
    const repCaPct = repCa.target > 0 ? Math.min(100, Math.round((repCa.achieved / repCa.target) * 100)) : 0;
    return (
      <div className="account-row" style={{ paddingLeft: indent ? 20 : 0 }} onClick={() => navigate("/clients")}>
        <div>
          <div className="account-name">
            {indent && <span style={{ color: "var(--ink-soft)", marginRight: 4 }}>↳</span>}
            {member.firstName} {member.lastName}
            {!member.active && (
              <span className="typology-badge" style={{ marginLeft: 6 }}>
                {t("teamManagement.inactive")}
              </span>
            )}
          </div>
          <div className="account-meta">
            <Globe size={11} /> {member.email}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          {caObjectives.length > 0 ? (
            <div style={{ fontWeight: 700 }}>
              {money(repCa.achieved, locale)}
              <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> / {money(repCa.target, locale)}</span>
            </div>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>{t("directeurDashboard.noActiveObjective")}</span>
          )}
          {caObjectives.length > 0 && (
            <div className="progress-track" style={{ width: 120, marginTop: 4 }}>
              <div className="progress-fill" style={{ width: `${repCaPct}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{t("directeurDashboard.title")}</h1>
          <p className="page-sub">{t("directeurDashboard.subtitle")}</p>
        </div>
        <button className="btn primary" onClick={() => setShowNewObjective((v) => !v)}>
          <Target size={15} /> {t("directeurDashboard.newObjective")}
        </button>
      </div>

      {loading && <p className="empty-state">{t("directeurDashboard.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {showNewObjective && (
        <div className="panel">
          <h3>{t("directeurDashboard.newObjectiveTitle")}</h3>
          <form onSubmit={handleCreateObjective}>
            <div className="form-row">
              <div className="field">
                <label>{t("directeurDashboard.objectiveRep")}</label>
                <select value={form.repId} onChange={(e) => setForm((f) => ({ ...f, repId: e.target.value }))}>
                  <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
                  {masterReps.map((mr) => (
                    <option key={mr.id} value={mr.id}>
                      {mr.firstName} {mr.lastName} ({t("role.MASTER_REP")})
                    </option>
                  ))}
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.firstName} {r.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("directeurDashboard.objectiveType")}</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="CHIFFRE_AFFAIRES">{t("dashboard.objectiveType.CHIFFRE_AFFAIRES")}</option>
                  <option value="PRECOMMANDE">{t("dashboard.objectiveType.PRECOMMANDE")}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("directeurDashboard.objectivePeriodStart")}</label>
                <input type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("directeurDashboard.objectivePeriodEnd")}</label>
                <input type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>{t("directeurDashboard.objectiveTarget")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>{t("directeurDashboard.objectiveTypologies")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TYPOLOGIES.map((s) => (
                  <span
                    key={s}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: form.typologies.includes(s) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleFormValue("typologies", s)}
                  >
                    {t(`typology.${s}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("directeurDashboard.objectiveCategories")}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="typology-badge"
                    style={{ cursor: "pointer", background: form.categories.includes(c) ? "var(--teal-soft, #d7ece7)" : undefined }}
                    onClick={() => toggleFormValue("categories", c)}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? t("teamManagement.creating") : t("teamManagement.create")}
              </button>
              <button className="btn outline" type="button" onClick={() => setShowNewObjective(false)}>
                {t("teamManagement.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && !error && (
        <div className="cards-row">
          <div className="stat-card">
            <div className="stat-label">
              {t("directeurDashboard.statCa")}
              <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-soft)" }}>
                {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
              </div>
            </div>
            <div className="stat-value">
              {money(teamCa.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamCa.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamCaPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              {t("directeurDashboard.statPrecommande")}
              <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-soft)" }}>
                {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
              </div>
            </div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {money(teamPrecommande.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamPrecommande.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamPrecommandePct}%`, background: "var(--gold)" }} />
            </div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/orders")}>
            <div className="stat-label">{t("directeurDashboard.statPending")}</div>
            <div className="stat-value">{pendingOrdersCount}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>
          {t("directeurDashboard.clientKpiTitle")}{" "}
          <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 12 }}>
            — {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
          </span>
        </h3>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiActive")}</span>
          <span>{loadingPortfolio ? "…" : activeClients.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiInactive")}</span>
          <span>{loadingPortfolio ? "…" : inactiveClients.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsOrdered.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiNotOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsNotOrdered.length}</span>
        </div>
      </div>

      {!loading && !error && (
        <div className="panel">
          <h3>{t("directeurDashboard.teamPerfTitle")}</h3>
          {members.length === 0 && <p className="empty-state">{t("teamManagement.noMasterReps")}</p>}
          {masterReps.map((mr) => (
            <div key={mr.id}>
              <MemberPerfRow member={mr} />
              {reps.filter((r) => r.masterRepId === mr.id).map((r) => (
                <MemberPerfRow member={r} indent key={r.id} />
              ))}
            </div>
          ))}
          {unassignedReps.map((r) => (
            <MemberPerfRow member={r} key={r.id} />
          ))}
        </div>
      )}

      {/* Carte & tournées — directement sous "Performance par représentant"
          (PDF Directeur commercial section 2 : "Le bloc Carte & tournées doit
          apparaître directement sous « Performance par représentant »"). */}
      {!loading && !error && <AccountsMap scope="directeur" repOptions={reps} masterRepOptions={masterReps} />}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
