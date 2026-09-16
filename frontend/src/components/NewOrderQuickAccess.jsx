import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import AccountFormFields, { accountPayloadFromForm, emptyAccountForm } from "./AccountFormFields.jsx";

// Parcours C — "Accès rapide depuis le dashboard" (fiche corrective Parcours
// de création de commande, 2026-09-16) : bouton "Nouvelle commande" visible
// en haut à droite du dashboard, qui exige TOUJOURS une sélection de client
// existant avant d'ouvrir le catalogue ("ne doit jamais permettre de créer
// une commande sans client rattaché"). Partagé entre le Dashboard
// Représentant et le Dashboard Directeur (fiche corrective Direction
// Commerciale V3) — jamais le Master Rep, qui reste en lecture seule.
//
// GET /accounts est déjà scopé par rôle côté serveur (ses propres comptes
// pour un représentant, tous les comptes pour un directeur) : aucun filtrage
// de portée supplémentaire à faire ici, seulement la recherche texte libre.
//
// Correctif 2026-09-16 (fiche corrective "CORRECTIONS PRIORITAIRES CRM —
// PROFIL REPRÉSENTANT", sections 2 et 16) : le représentant doit pouvoir
// créer un nouveau prospect/client SANS quitter ce parcours — ni retour à
// "Clients & prospects", ni nouvelle recherche, ni réouverture de fiche. Le
// bouton "+ Nouveau prospect / client" bascule donc cette même modale sur le
// formulaire complet (AccountFormFields, identique à celui de la page
// Clients & prospects), et la création navigue directement vers le
// catalogue du compte fraîchement créé — exactement comme la sélection d'un
// compte existant, cf. pick() plus bas.
export default function NewOrderQuickAccess() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("search"); // "search" | "create"
  const [accounts, setAccounts] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [createForm, setCreateForm] = useState(emptyAccountForm());
  const setCreateField = (key, value) => setCreateForm((f) => ({ ...f, [key]: value }));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Le Directeur crée aussi des comptes depuis ce raccourci (fiche corrective
  // Direction Commerciale V3) et doit donc choisir le représentant
  // propriétaire, comme sur la page "Clients & prospects" — le Représentant,
  // lui, est toujours auto-affecté par le serveur (cf. accounts.js).
  const needsOwnerRepPicker = user.role === "DIRECTEUR" || user.role === "FRONT_DESK";
  const [members, setMembers] = useState([]);
  const masterReps = members.filter((m) => m.role === "MASTER_REP");
  const reps = members.filter((m) => m.role === "REPRESENTANT");

  function openPicker() {
    setOpen(true);
    setMode("search");
    setSearch("");
    setError(null);
    setCreateError(null);
    setCreateForm(emptyAccountForm());
    setLoading(true);
    api
      .get("/accounts")
      .then(setAccounts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function openCreateMode() {
    setMode("create");
    setCreateError(null);
    // Chargés à la demande (pas besoin tant qu'on reste en mode recherche) :
    // pays (toujours nécessaire) et, pour Directeur/Front Desk uniquement,
    // la liste des représentants/Master Reps pour le sélecteur.
    if (countries.length === 0) {
      api.get("/countries").then(setCountries).catch((err) => setError(err.message));
    }
    if (needsOwnerRepPicker && members.length === 0) {
      api.get("/team/members").then(setMembers).catch((err) => setError(err.message));
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => [a.name, a.contactName, a.countryName].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [accounts, search]);

  function pick(account) {
    setOpen(false);
    navigate(`/clients/${account.id}/commande`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    const missingOwnerRep = needsOwnerRepPicker && !createForm.ownerRepId;
    if (!createForm.name.trim() || !createForm.countryCode || missingOwnerRep) {
      setCreateError(t("clients.newAccountMissing"));
      return;
    }
    setCreating(true);
    try {
      const created = await api.post("/accounts", {
        ...accountPayloadFromForm(createForm),
        ...(needsOwnerRepPicker
          ? { ownerRepId: createForm.ownerRepId, masterRepId: createForm.masterRepId || null }
          : {}),
      });
      // Exigence explicite de la fiche corrective (section 16) : le nouveau
      // client devient actif et le représentant est envoyé DIRECTEMENT au
      // catalogue — jamais de retour à "Clients & prospects", pas de
      // nouvelle recherche, pas de réouverture de fiche.
      pick(created);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn primary" onClick={openPicker} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Plus size={15} /> {t("newOrderQuickAccess.button")}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {mode === "search" ? (
              <>
                <h3 style={{ marginTop: 0 }}>{t("newOrderQuickAccess.title")}</h3>
                <p className="page-sub" style={{ marginTop: 0 }}>
                  {t("newOrderQuickAccess.subtitle")}
                </p>
                <div className="search-bar">
                  <Search size={15} color="#8892a0" />
                  <input
                    autoFocus
                    placeholder={t("newOrderQuickAccess.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button type="button" className="btn outline" style={{ margin: "10px 0" }} onClick={openCreateMode}>
                  {t("newOrderQuickAccess.createNew")}
                </button>
                {loading && <p className="empty-state">{t("newOrderQuickAccess.loading")}</p>}
                {error && <p className="error-text">{error}</p>}
                {!loading && !error && filtered.length === 0 && <p className="empty-state">{t("newOrderQuickAccess.empty")}</p>}
                {!loading && !error && (
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {filtered.map((a) => (
                      <div className="account-row" key={a.id} style={{ cursor: "pointer" }} onClick={() => pick(a)}>
                        <div>
                          <div className="account-name">{a.name}</div>
                          <div className="account-meta">{a.countryName || t("newOrderQuickAccess.noCountry")}</div>
                        </div>
                        <span className="typology-badge">{t(a.type === "CLIENT" ? "account.client" : "account.prospect")}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button className="btn outline" onClick={() => setOpen(false)}>
                    {t("teamManagement.cancel")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{t("newOrderQuickAccess.createNewTitle")}</h3>
                <button type="button" className="btn outline" style={{ marginBottom: 10 }} onClick={() => setMode("search")}>
                  {t("newOrderQuickAccess.backToSearch")}
                </button>
                <form onSubmit={handleCreate}>
                  <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                    <AccountFormFields
                      form={createForm}
                      setField={setCreateField}
                      countries={countries}
                      showOwnerPicker={needsOwnerRepPicker}
                      reps={reps}
                      masterReps={masterReps}
                      t={t}
                    />
                  </div>
                  {createError && <p className="error-text">{createError}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn primary" type="submit" disabled={creating}>
                      {creating ? t("teamManagement.creating") : t("teamManagement.create")}
                    </button>
                    <button className="btn outline" type="button" onClick={() => setOpen(false)}>
                      {t("teamManagement.cancel")}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
