import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, UserPlus } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import AccountFormFields, { accountPayloadFromForm, emptyAccountForm } from "../components/AccountFormFields.jsx";
import { filterAccountsBySearch } from "../lib/clientSearch.js";

// Liste des comptes (clients + prospects) — GET /api/accounts est déjà filtré
// côté serveur selon le rôle (accountsScopeClause) : un représentant n'y voit
// que ses propres comptes, jamais besoin de refiltrer côté client sur ce
// point. Seuls le texte libre et le type (client/prospect) sont filtrés ici.
//
// Pour le directeur (vision globale sur TOUS les comptes de l'entreprise),
// deux ajouts réservés à ce rôle :
//  - un filtre par représentant/Master Rep (sourcé sur GET /team/members,
//    filtrage 100% client puisque la liste est déjà complète côté serveur
//    pour ce rôle) — remplace la "Carte" du prototype (SVG de coordonnées
//    lat/lng inexistantes dans le schéma réel, cf. décision documentée dans
//    le README : la seule partie réellement utile de cet écran, le filtrage
//    multi-critères, est reprise ici plutôt que construire une carte à partir
//    de données qui n'existent pas) ;
//  - la création de compte (POST /api/accounts, déjà supporté pour DIRECTEUR
//    côté serveur avec ownerRepId obligatoire — cf. accounts.js).
//
// Représentant (correctif 2026-09-16, demande client directe : "je veux
// qu'un Rep puisse créer un client/prospect et saisir une commande") :
// POST /api/accounts a TOUJOURS accepté ce rôle côté serveur (ownerRepId
// auto-affecté à lui-même, masterRepId dérivé automatiquement — cf.
// accounts.js), et le scénario est même documenté comme attendu dans
// docs/recap-acces-test-beta.md ("Se connecter en Représentant, créer un
// client..."). Seule l'UI ne l'exposait pas. Le formulaire est donc
// disponible ici aussi pour ce rôle, mais SANS les champs
// représentant/Master Rep (non pertinents : le serveur les détermine
// lui-même pour ce rôle, cf. plus haut) — cf. rendu conditionnel plus bas.
export default function ClientsList() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDirecteur = user.role === "DIRECTEUR";
  // Front Desk : mêmes droits de création de compte que le Directeur (fiche
  // corrective Front Desk V3, section 2) — nécessite donc le même formulaire
  // complet (ownerRepId obligatoire côté serveur pour ce rôle, cf.
  // accounts.js) et la même liste représentants/Master Reps que ci-dessous.
  const isFrontDesk = user.role === "FRONT_DESK";
  const isRepresentant = user.role === "REPRESENTANT";
  // Directeur/Front Desk choisissent le représentant propriétaire du compte
  // (champ obligatoire côté serveur pour ces deux rôles) ; le Représentant,
  // lui, n'a pas ce choix à faire — le serveur l'affecte automatiquement à
  // lui-même, donc ce bloc de champs ne lui est jamais montré (cf. rendu).
  const needsOwnerRepPicker = isDirecteur || isFrontDesk;
  const canCreateAccount = isDirecteur || isFrontDesk || isRepresentant;
  const seesAllAccounts = isDirecteur || user.role === "ADMINISTRATEUR" || isFrontDesk;

  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState(emptyAccountForm());
  const setNewAccountField = useCallback((key, value) => {
    setNewAccountForm((f) => ({ ...f, [key]: value }));
  }, []);
  const [creating, setCreating] = useState(false);
  const [newAccountError, setNewAccountError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (needsOwnerRepPicker) {
        const [accountsData, membersData, countriesData] = await Promise.all([
          api.get("/accounts"),
          api.get("/team/members"),
          api.get("/countries"),
        ]);
        setAccounts(accountsData);
        setMembers(membersData);
        setCountries(countriesData);
      } else if (isRepresentant) {
        // Pas besoin de /team/members ici (pas de sélecteur représentant/
        // Master Rep pour ce rôle, cf. plus haut) mais /countries reste
        // nécessaire pour le formulaire "Nouveau compte".
        const [accountsData, countriesData] = await Promise.all([
          api.get("/accounts"),
          api.get("/countries"),
        ]);
        setAccounts(accountsData);
        setCountries(countriesData);
      } else {
        setAccounts(await api.get("/accounts"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [needsOwnerRepPicker, isRepresentant]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Correctif 2026-09-22 (demande client — "Recherche client par nom
  // commercial ET raison sociale... construis cette recherche comme un
  // composant réutilisable") : la logique de correspondance texte
  // (name/nomCommercial/contact/pays, insensible casse+accents) est
  // désormais centralisée dans lib/clientSearch.js — filterAccountsBySearch()
  // — partagée avec NewOrderQuickAccess.jsx et le nouveau ClientSearchPicker
  // (réutilisé depuis Agenda.jsx, point 3). Le filtre type/représentant reste
  // ici, propre à cet écran.
  const filtered = useMemo(() => {
    return filterAccountsBySearch(accounts, search).filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (repFilter !== "all" && a.ownerRepId !== repFilter && a.masterRepId !== repFilter) return false;
      return true;
    });
  }, [accounts, search, typeFilter, repFilter]);

  async function handleCreateAccount(e) {
    e.preventDefault();
    setNewAccountError(null);
    const missingOwnerRep = needsOwnerRepPicker && !newAccountForm.ownerRepId;
    if (!newAccountForm.name.trim() || !newAccountForm.countryCode || missingOwnerRep) {
      setNewAccountError(t("clients.newAccountMissing"));
      return;
    }
    // Correctif 2026-09-18 (fiche "UPDATE CRM" évolution 5) : SIRET/identifiant
    // d'entreprise et adresse de facturation deviennent obligatoires à la
    // création — les deux messages sont combinés si les deux informations
    // manquent, pour que le commercial voie tout ce qu'il lui manque en une
    // fois (cf. cahier de tests section 8, scénario "les deux absents").
    const missingTaxId = !newAccountForm.taxId.trim();
    const missingBilling =
      !newAccountForm.billingStreet.trim() || !newAccountForm.billingZip.trim() || !newAccountForm.billingCity.trim();
    if (missingTaxId || missingBilling) {
      const messages = [];
      if (missingTaxId) messages.push(t("clients.newAccountMissingTaxId"));
      if (missingBilling) messages.push(t("clients.newAccountMissingBilling"));
      setNewAccountError(messages.join(" "));
      return;
    }
    setCreating(true);
    try {
      // Correctif 2026-09-16 (spec "PROFIL REPRÉSENTANT" section 3) : tous
      // les champs du formulaire (adresses, contact, informations légales,
      // coordonnées bancaires) sont désormais envoyés — POST /api/accounts
      // les accepte déjà tous tels quels (cf. createSchema, accounts.js).
      const created = await api.post("/accounts", {
        ...accountPayloadFromForm(newAccountForm),
        // Pour le Représentant, ownerRepId/masterRepId ne sont ni affichés ni
        // pertinents : le serveur les détermine lui-même pour ce rôle (cf.
        // commentaire en tête de fichier) — on ne les envoie donc que quand
        // le sélecteur correspondant est réellement affiché.
        ...(needsOwnerRepPicker
          ? { ownerRepId: newAccountForm.ownerRepId, masterRepId: newAccountForm.masterRepId || null }
          : {}),
      });
      setNewAccountForm(emptyAccountForm());
      setShowNewAccount(false);
      setToast(t("clients.accountCreated"));
      await load();
      navigate(`/clients/${created.id}`);
    } catch (err) {
      setNewAccountError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const masterReps = members.filter((m) => m.role === "MASTER_REP");
  const reps = members.filter((m) => m.role === "REPRESENTANT");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{t("clients.title")}</h1>
          <p className="page-sub">{seesAllAccounts ? t("clients.subtitleDirecteur") : t("clients.subtitle")}</p>
        </div>
        {canCreateAccount && (
          <button className="btn primary" onClick={() => setShowNewAccount((v) => !v)}>
            <UserPlus size={15} /> {t("clients.newAccount")}
          </button>
        )}
      </div>

      {showNewAccount && (
        <div className="panel">
          <h3>{t("clients.newAccountTitle")}</h3>
          <form onSubmit={handleCreateAccount}>
            <AccountFormFields
              form={newAccountForm}
              setField={setNewAccountField}
              countries={countries}
              showOwnerPicker={needsOwnerRepPicker}
              reps={reps}
              masterReps={masterReps}
              t={t}
            />
            {newAccountError && <p className="error-text">{newAccountError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn primary" type="submit" disabled={creating}>
                {creating ? t("teamManagement.creating") : t("teamManagement.create")}
              </button>
              <button className="btn outline" type="button" onClick={() => setShowNewAccount(false)}>
                {t("teamManagement.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="search-bar">
        <Search size={15} color="#8892a0" />
        <input
          placeholder={t("clients.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filter-row">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t("clients.filterAll")}</option>
          <option value="CLIENT">{t("clients.filterClient")}</option>
          <option value="PROSPECT">{t("clients.filterProspect")}</option>
        </select>
        {isDirecteur && (members.length > 0) && (
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
            <option value="all">{t("clients.filterAllReps")}</option>
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
        )}
      </div>

      {loading && <p className="empty-state">{t("clients.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="empty-state">{t("clients.empty")}</p>}

      <div className="panel">
        {filtered.map((a) => (
          <div className="account-row" key={a.id} onClick={() => navigate(`/clients/${a.id}`)}>
            <div>
              <div className="account-name">{a.name}</div>
              {/* Correctif 2026-09-22 (ajustement demandé — capture d'écran
                  "Clients & prospects") : le nom commercial est affiché EN
                  DESSOUS du nom principal (plus lisible qu'en ligne avec un
                  tiret) — la recherche peut matcher sur l'un ou l'autre (name
                  OU nomCommercial), donc les deux doivent être visibles pour
                  que ce soit clair pourquoi la fiche est ressortie, pas
                  seulement en cas de match. */}
              {a.nomCommercial && <div className="account-nom-commercial">{a.nomCommercial}</div>}
              <div className="account-meta">
                <MapPin size={11} /> {a.countryName || a.countryCode}
                <span className="typology-badge">{t(`typology.${a.typology}`)}</span>
                {/* Nom du représentant propriétaire — utile au Master Rep, qui voit
                    ici les comptes de plusieurs représentants de son équipe en plus
                    des siens propres (cf. accountsScopeClause), et au directeur qui
                    voit tous les comptes de l'entreprise ; masqué quand le compte
                    lui appartient directement (bruit inutile). */}
                {a.ownerRepId !== user.id && (a.ownerRepFirstName || a.ownerRepLastName) && (
                  <span className="typology-badge">
                    {a.ownerRepFirstName} {a.ownerRepLastName}
                  </span>
                )}
              </div>
            </div>
            <span className="stage-badge">{t(`pipelineStage.${a.pipelineStage}`) || a.pipelineStage}</span>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
