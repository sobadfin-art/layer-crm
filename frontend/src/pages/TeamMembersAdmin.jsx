import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { normalizeSearch } from "../lib/format.js";

// Point 6 (2026-10-25) — écran "Membres de l'équipe" de l'ADMINISTRATEUR :
// bouton "Modifier" sur chaque compte, limité (décision client) au prénom /
// nom et à l'attribution de zone (territoires d'un représentant). Rien n'est
// appliqué au fil de la saisie : "Enregistrer" ouvre d'abord un récapitulatif
// avant/après, et seule la confirmation envoie la modification
// (PATCH /api/admin/members/:userId, vérifié côté serveur).
export default function TeamMembersAdmin() {
  const { t } = useI18n();
  const [members, setMembers] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  const [editing, setEditing] = useState(null); // membre en cours de modification
  const [form, setForm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, terr] = await Promise.all([api.get("/admin/members"), api.get("/admin/members/territories")]);
      setMembers(m);
      setTerritories(terr);
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

  const territoryName = useMemo(() => new Map(territories.map((x) => [x.id, x.name])), [territories]);
  const namesOf = (ids) => (ids || []).map((id) => territoryName.get(id) || "?").sort((a, b) => a.localeCompare(b));

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return members;
    return members.filter((m) => normalizeSearch(`${m.firstName} ${m.lastName} ${m.email}`).includes(q));
  }, [members, search]);

  function openEdit(member) {
    setEditing(member);
    setForm({ firstName: member.firstName, lastName: member.lastName, territoryIds: [...(member.territoryIds || [])] });
    setConfirming(false);
    setSaveError(null);
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setForm(null);
    setConfirming(false);
  }

  function toggleTerritory(id) {
    setForm((f) => ({
      ...f,
      territoryIds: f.territoryIds.includes(id) ? f.territoryIds.filter((x) => x !== id) : [...f.territoryIds, id],
    }));
  }

  // Différences réelles entre la fiche actuelle et le formulaire — c'est ce
  // récapitulatif qui est affiché avant confirmation, et uniquement ces
  // champs qui sont envoyés au serveur.
  const changes = useMemo(() => {
    if (!editing || !form) return [];
    const list = [];
    if (form.firstName.trim() !== editing.firstName) {
      list.push({ key: "firstName", label: t("teamMembersAdmin.firstName"), from: editing.firstName, to: form.firstName.trim() });
    }
    if (form.lastName.trim() !== editing.lastName) {
      list.push({ key: "lastName", label: t("teamMembersAdmin.lastName"), from: editing.lastName, to: form.lastName.trim() });
    }
    if (editing.hasTerritories) {
      const before = namesOf(editing.territoryIds);
      const after = namesOf(form.territoryIds);
      if (before.join("|") !== after.join("|")) {
        list.push({
          key: "territoryIds",
          label: t("teamMembersAdmin.territories"),
          from: before.join(", ") || t("teamMembersAdmin.none"),
          to: after.join(", ") || t("teamMembersAdmin.none"),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form, territoryName, t]);

  function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setSaveError(t("teamMembersAdmin.nameRequired"));
      return;
    }
    if (changes.length === 0) {
      setSaveError(t("teamMembersAdmin.noChange"));
      return;
    }
    setConfirming(true);
  }

  async function handleConfirm() {
    setSaving(true);
    setSaveError(null);
    const body = {};
    for (const c of changes) {
      if (c.key === "territoryIds") body.territoryIds = form.territoryIds;
      else body[c.key] = form[c.key].trim();
    }
    try {
      await api.patch(`/admin/members/${editing.id}`, body);
      setEditing(null);
      setForm(null);
      setConfirming(false);
      setToast(t("teamMembersAdmin.saved"));
      await load();
    } catch (err) {
      setSaveError(err.message);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="page-title">{t("teamMembersAdmin.title")}</h1>
      <p className="page-sub">{t("teamMembersAdmin.subtitle")}</p>

      <div className="search-bar">
        <Search size={15} color="#8892a0" />
        <input placeholder={t("teamMembersAdmin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <p className="empty-state">{t("account.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="panel">
          {filtered.length === 0 && <p className="empty-state">{t("teamMembersAdmin.empty")}</p>}
          {filtered.map((m) => (
            <div className="account-row" key={m.id} style={{ gap: 10, flexWrap: "wrap", opacity: m.active ? 1 : 0.6 }}>
              <div style={{ minWidth: 0 }}>
                <div className="account-name">
                  {m.firstName} {m.lastName}
                </div>
                <div className="account-meta">{m.email}</div>
                <div className="account-meta">
                  <span className="typology-badge">{t(`role.${m.role}`)}</span>{" "}
                  {!m.active && <span className="typology-badge">{t("teamMembersAdmin.inactive")}</span>}{" "}
                  {m.hasTerritories && (
                    <span>
                      {t("teamMembersAdmin.territories")} : {namesOf(m.territoryIds).join(", ") || t("teamMembersAdmin.none")}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" className="btn outline" onClick={() => openEdit(m)}>
                <Pencil size={14} /> {t("teamMembersAdmin.edit")}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && form && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {!confirming ? (
              <form onSubmit={handleSave}>
                <h3 style={{ marginTop: 0 }}>{t("teamMembersAdmin.editTitle", { email: editing.email })}</h3>
                <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 0 }}>{t("teamMembersAdmin.scopeHint")}</p>
                <div className="form-row">
                  <div className="field">
                    <label>{t("teamMembersAdmin.firstName")}</label>
                    <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("teamMembersAdmin.lastName")}</label>
                    <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                {editing.hasTerritories ? (
                  <div className="field">
                    <label>{t("teamMembersAdmin.territories")}</label>
                    {territories.length === 0 && <p className="empty-state">{t("teamMembersAdmin.noTerritories")}</p>}
                    <div className="cat-tabs" style={{ flexWrap: "wrap" }}>
                      {territories.map((terr) => (
                        <button
                          key={terr.id}
                          type="button"
                          className={`cat-tab ${form.territoryIds.includes(terr.id) ? "active" : ""}`}
                          onClick={() => toggleTerritory(terr.id)}
                          title={(terr.countryCodes || []).join(", ")}
                        >
                          {terr.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t("teamMembersAdmin.territoriesRepOnly")}</p>
                )}
                {saveError && <p className="error-text">{saveError}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" className="btn outline" onClick={closeEdit}>
                    {t("teamManagement.cancel")}
                  </button>
                  <button type="submit" className="btn primary">
                    {t("teamMembersAdmin.save")}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{t("teamMembersAdmin.confirmTitle")}</h3>
                <p className="page-sub" style={{ marginTop: 0 }}>
                  {editing.firstName} {editing.lastName} — {editing.email}
                </p>
                <div className="table-scroll">
                  <table className="confirm-diff">
                    <thead>
                      <tr>
                        <th>{t("teamMembersAdmin.field")}</th>
                        <th>{t("teamMembersAdmin.before")}</th>
                        <th>{t("teamMembersAdmin.after")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.key}>
                          <td>{c.label}</td>
                          <td>{c.from}</td>
                          <td>
                            <strong>{c.to}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {saveError && <p className="error-text">{saveError}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" className="btn outline" disabled={saving} onClick={() => setConfirming(false)}>
                    {t("teamMembersAdmin.back")}
                  </button>
                  <button type="button" className="btn primary" disabled={saving} onClick={handleConfirm}>
                    {saving ? t("teamMembersAdmin.saving") : t("teamMembersAdmin.confirm")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
