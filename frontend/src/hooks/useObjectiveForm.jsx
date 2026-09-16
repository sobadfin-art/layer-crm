import { useState } from "react";
import { Target } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Correctif 2026-09-16 (amendement Direction Commerciale : "Le bouton
// « Objectifs », actuellement présent dans le Tableau de bord, doit également
// être accessible depuis l'onglet Équipe") — extrait du bouton + formulaire
// "Nouvel objectif" jusqu'ici propres à DirecteurDashboard.jsx, pour que
// TeamManagement.jsx (l'onglet Équipe) puisse réutiliser EXACTEMENT le même
// moteur de création (même formulaire, mêmes règles de validation, même
// endpoint POST /objectives) plutôt qu'un second formulaire dupliqué —
// principe déjà appliqué au parcours "Nouvelle commande"
// (components/NewOrderQuickAccess.jsx).
//
// Rendu en deux morceaux (`trigger`, `panel`) plutôt qu'un seul élément :
// dans les deux écrans qui l'utilisent, le bouton doit rester dans la rangée
// d'en-tête (à côté des autres actions) alors que le panneau du formulaire,
// lui, doit s'afficher pleine largeur EN DESSOUS de toute cette rangée — les
// regrouper dans un seul élément les aurait forcés à vivre au même endroit du
// DOM, ce qui aurait cassé cette mise en page dans au moins un des deux
// écrans.
const TYPOLOGIES = [
  "OPTICIEN", "SURF_SHOP", "FASHION_STORE", "SKATE_SHOP", "SKI_SHOP",
  "CONCEPT_STORE", "USHIP", "BIKE_STORE", "KEY_ACCOUNT", "DISTRIBUTOR", "AUTRE",
];
const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];

const emptyForm = {
  repId: "",
  type: "CHIFFRE_AFFAIRES",
  typologies: [],
  categories: [],
  periodStart: "",
  periodEnd: "",
  targetAmount: "",
};

export function useObjectiveForm({ masterReps, reps, onCreated }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

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
      setForm(emptyForm);
      setShow(false);
      await onCreated?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const trigger = (
    <button className="btn primary" onClick={() => setShow((v) => !v)}>
      <Target size={15} /> {t("directeurDashboard.newObjective")}
    </button>
  );

  const panel = show && (
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
          <button className="btn outline" type="button" onClick={() => setShow(false)}>
            {t("teamManagement.cancel")}
          </button>
        </div>
      </form>
    </div>
  );

  return { trigger, panel };
}
