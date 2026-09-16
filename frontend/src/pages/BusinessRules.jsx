import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

const RULE_TYPES = ["REMISE_CATEGORIE", "FRAIS_DE_PORT", "CONDITIONS_PAIEMENT", "TAXE", "EXPORT_DOLIBARR"];
const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];
// Types dont le prototype (docs/prototype-crm-commercial.jsx, modal ~3690-3765)
// ne définit aucun champ structuré propre (stubs non implémentés côté
// maquette) — on ne leur invente pas de champs métier (montant, taux...) sans
// donnée réelle du client ; seuls scope/représentants/statut actif leur sont
// proposés ici.
const STUB_TYPES = new Set(["CONDITIONS_PAIEMENT", "TAXE", "EXPORT_DOLIBARR"]);

const emptyForm = {
  type: "REMISE_CATEGORIE",
  scope: "GLOBAL",
  countryId: "",
  repIds: [],
  categories: [],
  ratePct: "",
  flatAmount: "",
  threshold: "",
};

// Écran "Config" du directeur — règles commerciales (section 5 : "tout passe
// par la table de règles, gérée par le directeur") + réglages Dolibarr
// (dolibarr.js, déjà consommés en lecture/écriture par front desk pour la
// checklist d'export, ici en écriture par le directeur). Les règles ne sont
// JAMAIS supprimées (cf. conventions du projet) : le "Modifier" du prototype
// devient ici un statut actif/inactif togglable (PATCH {active}), et la liste
// inclut les règles inactives (GET ?includeInactive=true, réservé au
// directeur — cf. business-rules.js) pour pouvoir les réactiver.
export default function BusinessRules() {
  const { t } = useI18n();

  const [rules, setRules] = useState([]);
  const [members, setMembers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const [showNewRule, setShowNewRule] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesData, membersData, countriesData, settingsData] = await Promise.all([
        api.get("/business-rules?includeInactive=true"),
        api.get("/team/members"),
        api.get("/countries"),
        api.get("/dolibarr/settings"),
      ]);
      setRules(rulesData);
      setMembers(membersData);
      setCountries(countriesData);
      setSettingsForm(settingsData);
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

  function toggleFormArray(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((x) => x !== value) : [...f[field], value],
    }));
  }

  async function toggleRuleActive(rule) {
    setBusyId(rule.id);
    try {
      await api.patch(`/business-rules/${rule.id}`, { active: !rule.active });
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    setFormError(null);
    if (form.scope === "REPRESENTANT" && form.repIds.length === 0) {
      setFormError(t("businessRules.repIdsRequired"));
      return;
    }
    if (form.scope === "PAYS" && !form.countryId) {
      setFormError(t("businessRules.countryRequired"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/business-rules", {
        type: form.type,
        scope: form.scope,
        countryId: form.scope === "PAYS" ? form.countryId : null,
        repIds: form.scope === "REPRESENTANT" ? form.repIds : [],
        categories: form.type === "REMISE_CATEGORIE" ? form.categories : [],
        ratePct: form.type === "REMISE_CATEGORIE" && form.ratePct !== "" ? Number(form.ratePct) : null,
        flatAmount: form.type === "FRAIS_DE_PORT" && form.flatAmount !== "" ? Number(form.flatAmount) : null,
        threshold: form.type === "FRAIS_DE_PORT" && form.threshold !== "" ? Number(form.threshold) : null,
        active: true,
      });
      setForm(emptyForm);
      setShowNewRule(false);
      setToast(t("businessRules.ruleCreated"));
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsError(null);
    setSavingSettings(true);
    try {
      const updated = await api.patch("/dolibarr/settings", {
        productMatchField: settingsForm.productMatchField,
        accountMatchField: settingsForm.accountMatchField,
        giftLineStrategy: settingsForm.giftLineStrategy,
        defaultOrderStatus: settingsForm.defaultOrderStatus,
        paymentTermDays: Number(settingsForm.paymentTermDays),
        paymentMode: settingsForm.paymentMode,
        csvDelimiter: settingsForm.csvDelimiter,
        vatRateFranceStandard: Number(settingsForm.vatRateFranceStandard),
      });
      setSettingsForm(updated);
      setToast(t("businessRules.settingsSaved"));
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  function repLabel(repId) {
    const m = members.find((mm) => mm.id === repId);
    return m ? `${m.firstName} ${m.lastName}` : repId.slice(0, 8);
  }

  function countryLabel(countryId) {
    const c = countries.find((cc) => cc.id === countryId);
    return c ? c.name : countryId;
  }

  return (
    <>
      <h1 className="page-title">{t("businessRules.title")}</h1>
      <p className="page-sub">{t("businessRules.subtitle")}</p>

      {loading && <p className="empty-state">{t("businessRules.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <h3 style={{ margin: 0 }}>{t("businessRules.rulesTitle")}</h3>
            <button className="btn primary" onClick={() => setShowNewRule((v) => !v)}>
              {t("businessRules.newRule")}
            </button>
          </div>

          {showNewRule && (
            <div className="panel">
              <form onSubmit={handleCreateRule}>
                <div className="form-row">
                  <div className="field">
                    <label>{t("businessRules.type")}</label>
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                      {RULE_TYPES.map((ty) => (
                        <option key={ty} value={ty}>
                          {t(`businessRules.ruleType.${ty}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t("businessRules.scope")}</label>
                    <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                      <option value="GLOBAL">{t("businessRules.scopeGlobal")}</option>
                      <option value="PAYS">{t("businessRules.scopePays")}</option>
                      <option value="REPRESENTANT">{t("businessRules.scopeRepresentant")}</option>
                    </select>
                  </div>
                </div>

                {form.scope === "PAYS" && (
                  <div className="field">
                    <label>{t("clients.newAccountCountry")}</label>
                    <select value={form.countryId} onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}>
                      <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.scope === "REPRESENTANT" && (
                  <div className="field">
                    <label>{t("businessRules.reps")}</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {members.map((m) => (
                        <span
                          key={m.id}
                          className="typology-badge"
                          style={{ cursor: "pointer", background: form.repIds.includes(m.id) ? "var(--teal-soft, #d7ece7)" : undefined }}
                          onClick={() => toggleFormArray("repIds", m.id)}
                        >
                          {m.firstName} {m.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {form.type === "REMISE_CATEGORIE" && (
                  <>
                    <div className="field">
                      <label>{t("businessRules.categories")}</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {CATEGORIES.map((c) => (
                          <span
                            key={c}
                            className="typology-badge"
                            style={{ cursor: "pointer", background: form.categories.includes(c) ? "var(--teal-soft, #d7ece7)" : undefined }}
                            onClick={() => toggleFormArray("categories", c)}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label>{t("businessRules.ratePct")}</label>
                      {/* Correctif 2026-09-16 (demande directe Direction Commerciale : "Le niveau de
                          remise peut avoir deux decimale") — step passé de 0.1 à 0.01 : la colonne
                          business_rules.rate_pct est NUMERIC(5,2) et le schéma serveur (Zod, ratePct
                          z.number().min(0).max(100)) acceptait déjà les décimales, mais avec step="0.1"
                          la validation native du navigateur refusait la saisie d'un deuxième chiffre
                          après la virgule (ex. 12,34) et bloquait silencieusement l'envoi du
                          formulaire. */}
                      <input type="number" min="0" max="100" step="0.01" value={form.ratePct} onChange={(e) => setForm((f) => ({ ...f, ratePct: e.target.value }))} />
                    </div>
                  </>
                )}

                {form.type === "FRAIS_DE_PORT" && (
                  <div className="form-row">
                    <div className="field">
                      <label>{t("businessRules.flatAmount")}</label>
                      <input type="number" min="0" step="0.01" value={form.flatAmount} onChange={(e) => setForm((f) => ({ ...f, flatAmount: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t("businessRules.threshold")}</label>
                      <input type="number" min="0" step="0.01" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} />
                    </div>
                  </div>
                )}

                {STUB_TYPES.has(form.type) && <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{t("businessRules.stubHint")}</p>}

                {formError && <p className="error-text">{formError}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button className="btn primary" type="submit" disabled={saving}>
                    {saving ? t("teamManagement.creating") : t("teamManagement.create")}
                  </button>
                  <button className="btn outline" type="button" onClick={() => setShowNewRule(false)}>
                    {t("teamManagement.cancel")}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="panel">
            {rules.length === 0 && <p className="empty-state">{t("businessRules.empty")}</p>}
            {rules.map((rule) => (
              <div className="task-row" style={{ alignItems: "flex-start" }} key={rule.id}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong>{t(`businessRules.ruleType.${rule.type}`)}</strong>
                    <span className="typology-badge">{t(`businessRules.scope${rule.scope === "GLOBAL" ? "Global" : rule.scope === "PAYS" ? "Pays" : "Representant"}`)}</span>
                    {!rule.active && (
                      <span className="typology-badge" style={{ color: "var(--danger)" }}>
                        {t("teamManagement.inactive")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rule.categories && rule.categories.length > 0 && <span>{rule.categories.join(", ")}</span>}
                    {rule.ratePct != null && <span>{t("businessRules.ratePctValue", { pct: rule.ratePct })}</span>}
                    {rule.flatAmount != null && <span>{t("businessRules.flatAmountValue", { amount: rule.flatAmount })}</span>}
                    {rule.threshold != null && <span>{t("businessRules.thresholdValue", { amount: rule.threshold })}</span>}
                    {rule.countryId && <span>{countryLabel(rule.countryId)}</span>}
                    {rule.repIds && rule.repIds.length > 0 && <span>{rule.repIds.map(repLabel).join(", ")}</span>}
                  </div>
                </div>
                <button className="btn outline" disabled={busyId === rule.id} onClick={() => toggleRuleActive(rule)}>
                  {rule.active ? t("teamManagement.deactivate") : t("teamManagement.reactivate")}
                </button>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 22 }}>
            <Settings2 size={14} /> {t("businessRules.settingsTitle")}
          </h3>
          {settingsForm && (
            <div className="panel">
              <form onSubmit={handleSaveSettings}>
                <div className="form-row">
                  <div className="field">
                    <label>{t("businessRules.productMatchField")}</label>
                    <select value={settingsForm.productMatchField} onChange={(e) => setSettingsForm((f) => ({ ...f, productMatchField: e.target.value }))}>
                      <option value="ref">ref</option>
                      <option value="rowid">rowid</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{t("businessRules.accountMatchField")}</label>
                    <select value={settingsForm.accountMatchField} onChange={(e) => setSettingsForm((f) => ({ ...f, accountMatchField: e.target.value }))}>
                      <option value="code_client">code_client</option>
                      <option value="siret_vat">siret_vat</option>
                      <option value="name">name</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("businessRules.giftLineStrategy")}</label>
                    <select value={settingsForm.giftLineStrategy} onChange={(e) => setSettingsForm((f) => ({ ...f, giftLineStrategy: e.target.value }))}>
                      <option value="ZERO_PRICE">ZERO_PRICE</option>
                      <option value="FULL_DISCOUNT">FULL_DISCOUNT</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{t("businessRules.defaultOrderStatus")}</label>
                    <select value={settingsForm.defaultOrderStatus} onChange={(e) => setSettingsForm((f) => ({ ...f, defaultOrderStatus: e.target.value }))}>
                      <option value="BROUILLON">BROUILLON</option>
                      <option value="VALIDEE">VALIDEE</option>
                      <option value="A_VALIDER">A_VALIDER</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("businessRules.paymentTermDays")}</label>
                    <input type="number" min="1" value={settingsForm.paymentTermDays} onChange={(e) => setSettingsForm((f) => ({ ...f, paymentTermDays: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("businessRules.paymentMode")}</label>
                    <select value={settingsForm.paymentMode} onChange={(e) => setSettingsForm((f) => ({ ...f, paymentMode: e.target.value }))}>
                      <option value="PRELEVEMENT_SEPA">PRELEVEMENT_SEPA</option>
                      <option value="LCR">LCR</option>
                    </select>
                  </div>
                </div>
                {/* Le champ "délimiteur CSV" a été retiré de cet écran : le fichier
                    Dolibarr téléchargé par le front desk est désormais un .xlsx
                    (bascule V2, cf. README), ce réglage ne s'y applique plus et
                    n'aurait fait que prêter à confusion. La colonne backend
                    (csv_delimiter) et buildDolibarrCsv restent en base/code pour
                    un usage outillage éventuel, simplement plus exposés ici. */}
                <div className="form-row">
                  <div className="field">
                    <label>{t("businessRules.vatRateFranceStandard")}</label>
                    <input type="number" min="0" max="100" step="0.1" value={settingsForm.vatRateFranceStandard} onChange={(e) => setSettingsForm((f) => ({ ...f, vatRateFranceStandard: e.target.value }))} />
                  </div>
                </div>
                {settingsError && <p className="error-text">{settingsError}</p>}
                <button className="btn primary" type="submit" disabled={savingSettings}>
                  {savingSettings ? t("teamManagement.creating") : t("businessRules.saveSettings")}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
