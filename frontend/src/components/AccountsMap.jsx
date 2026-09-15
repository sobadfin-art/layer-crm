import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Map as MapIcon } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Bloc "Carte & tournées" — V1 volontairement NON géographique (décision
// documentée, cf. README : aucune colonne lat/lng dans le schéma réel). Les 3
// PDF qui le demandent (Directeur commercial section 2, Master Rep section 2,
// Représentant section 1) sont explicites sur ce point : "l'optimisation de
// tournée et la connexion Google Maps peuvent être traitées ultérieurement en
// V2, mais le bloc, les filtres et les comptes doivent exister en V1" — la
// maquette montre une zone de visualisation avec des points positionnés
// illustrativement, pas une vraie carte. Ce composant reproduit donc une
// zone de visualisation filtrable (Type / Typologie / Représentant), avec les
// comptes positionnés de façon illustrative (groupés par typologie), jamais
// une géolocalisation réelle.
//
// `scope` détermine le filtre représentant supplémentaire :
//  - "representant" : pas de filtre représentant (le rep ne voit que les
//    siens, déjà garanti côté serveur par accountsScopeClause).
//  - "masterrep" : filtre représentant limité à son équipe (fourni par
//    `repOptions`).
//  - "directeur" : filtre représentant + Master Rep sur toute l'équipe
//    (fourni par `repOptions`/`masterRepOptions`).
const TYPOLOGIES = [
  "OPTICIEN", "SURF_SHOP", "FASHION_STORE", "SKATE_SHOP", "SKI_SHOP",
  "CONCEPT_STORE", "USHIP", "BIKE_STORE", "KEY_ACCOUNT", "DISTRIBUTOR", "AUTRE",
];

// Palette fixe par typologie — purement visuelle (aucune donnée géographique
// réelle), pour distinguer les points au premier coup d'œil.
const TYPOLOGY_COLORS = {
  OPTICIEN: "#2f7d6b",
  SURF_SHOP: "#1f7fbf",
  FASHION_STORE: "#b1548a",
  SKATE_SHOP: "#c9762c",
  SKI_SHOP: "#5b6fd6",
  CONCEPT_STORE: "#8a5cc4",
  USHIP: "#2aa198",
  BIKE_STORE: "#4c8c3a",
  KEY_ACCOUNT: "#c9a227",
  DISTRIBUTOR: "#c0392b",
  AUTRE: "#7a8792",
};

export default function AccountsMap({ scope, repOptions = [], masterRepOptions = [] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [typologyFilter, setTypologyFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [masterRepFilter, setMasterRepFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (typologyFilter !== "all") params.set("typology", typologyFilter);
    if (repFilter !== "all") params.set("repId", repFilter);
    if (masterRepFilter !== "all") params.set("masterRepId", masterRepFilter);
    api
      .get(`/accounts/map?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setAccounts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeFilter, typologyFilter, repFilter, masterRepFilter]);

  // Positionnement illustratif : groupé par typologie (jamais une vraie
  // coordonnée géographique) — chaque typologie occupe une zone stable de la
  // surface, les comptes de cette typologie s'y répartissent en grille.
  const grouped = useMemo(() => {
    const byTypology = new Map();
    for (const a of accounts) {
      if (!byTypology.has(a.typology)) byTypology.set(a.typology, []);
      byTypology.get(a.typology).push(a);
    }
    return TYPOLOGIES.filter((ty) => byTypology.has(ty)).map((ty) => ({ typology: ty, accounts: byTypology.get(ty) }));
  }, [accounts]);

  return (
    <div className="panel">
      <h3>
        <MapIcon size={14} /> {t("accountsMap.title")}
      </h3>
      <p className="page-sub" style={{ marginTop: -6, marginBottom: 12 }}>
        {t("accountsMap.v1Note")}
      </p>

      <div className="filter-row">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t("accountsMap.filterTypeAll")}</option>
          <option value="CLIENT">{t("account.client")}</option>
          <option value="PROSPECT">{t("account.prospect")}</option>
        </select>
        <select value={typologyFilter} onChange={(e) => setTypologyFilter(e.target.value)}>
          <option value="all">{t("accountsMap.filterTypologyAll")}</option>
          {TYPOLOGIES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`typology.${ty}`)}
            </option>
          ))}
        </select>
        {(scope === "masterrep" || scope === "directeur") && repOptions.length > 0 && (
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
            <option value="all">{t("accountsMap.filterRepAll")}</option>
            {repOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName} {r.lastName}
              </option>
            ))}
          </select>
        )}
        {scope === "directeur" && masterRepOptions.length > 0 && (
          <select value={masterRepFilter} onChange={(e) => setMasterRepFilter(e.target.value)}>
            <option value="all">{t("accountsMap.filterMasterRepAll")}</option>
            {masterRepOptions.map((mr) => (
              <option key={mr.id} value={mr.id}>
                {mr.firstName} {mr.lastName}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p className="empty-state">{t("accountsMap.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="accounts-map-canvas">
          {accounts.length === 0 && <p className="empty-state">{t("accountsMap.empty")}</p>}
          {grouped.map((group) => (
            <div className="map-typology-zone" key={group.typology}>
              <div className="map-typology-label" style={{ color: TYPOLOGY_COLORS[group.typology] }}>
                {t(`typology.${group.typology}`)} · {group.accounts.length}
              </div>
              <div className="map-dots">
                {group.accounts.map((a) => (
                  <button
                    key={a.id}
                    className="map-dot"
                    style={{ "--dot-color": TYPOLOGY_COLORS[group.typology] }}
                    title={`${a.name} — ${a.type === "CLIENT" ? t("account.client") : t("account.prospect")}`}
                    onClick={() => navigate(`/clients/${a.id}`)}
                  >
                    <span className="map-dot-marker" />
                    <span className="map-dot-label">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
