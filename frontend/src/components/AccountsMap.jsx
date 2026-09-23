import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Map as MapIcon } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Correctif 2026-09-23 (demande client — "Intègre une vraie carte
// interactive (pas le SVG stylisé actuel) qui positionne tous les
// clients/prospects, en remplacement de l'écran Carte existant chez le
// représentant et le directeur") : remplace la visualisation illustrative
// V1 (groupage par typologie, positions non géographiques, cf. historique
// git de ce fichier) par une vraie carte Mapbox GL JS, un point par compte à
// sa position réelle (latitude/longitude calculées par géocodage
// automatique — cf. migration 024_accounts_geocoding.sql et
// backend/src/lib/geocoding.js), coloré par TYPE (client/prospect) plutôt
// que par typologie comme avant — cette dernière reste un filtre, pas un
// code couleur, la distinction client/prospect étant l'information la plus
// utile en un coup d'œil sur une carte de tournée.
//
// Fournisseur carte : Mapbox GL JS (token PUBLIC — c'est volontaire et
// normal chez Mapbox qu'il soit visible dans le bundle JS livré au
// navigateur, cf. échange du 2026-09-23 ; restreint par domaine côté
// Mapbox pour éviter toute réutilisation ailleurs). Fournisseur géocodage :
// Nominatim/OpenStreetMap, PAS Mapbox (cf. lib/geocoding.js côté backend
// pour le détail complet de ce choix) — ce composant ne fait lui-même
// jamais aucun géocodage, il ne fait qu'afficher les coordonnées déjà
// calculées et stockées en base.
//
// `scope` détermine le filtre représentant supplémentaire (comportement
// inchangé depuis la V1) :
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

// Palette fixe par TYPE (client/prospect) — remplace l'ancienne palette par
// typologie de la V1 (conservée nulle part ailleurs, la typologie reste un
// filtre texte uniquement désormais). Reprend des teintes déjà présentes
// dans le reste de l'UI (le vert de OPTICIEN pour "client" — relation
// établie ; un orange proche de SURF_SHOP/DISTRIBUTOR pour "prospect" —
// démarche en cours) plutôt que d'inventer une nouvelle palette.
const TYPE_COLORS = {
  CLIENT: "#2f7d6b",
  PROSPECT: "#c9762c",
};

const FRANCE_CENTER = [2.3522, 46.6034];
const FRANCE_ZOOM = 5;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

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

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

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

  // Comptes avec des coordonnées exploitables (géocodage jamais fait ou
  // sans résultat = latitude/longitude à null, cf. lib/geocoding.js côté
  // serveur) — jamais une erreur bloquante, juste exclus du rendu carte ;
  // le compteur `withoutCoordinates` en informe l'utilisateur sous la carte
  // plutôt que de le laisser deviner pourquoi un compte n'apparaît pas.
  const geocoded = useMemo(
    () => accounts.filter((a) => typeof a.latitude === "number" && typeof a.longitude === "number"),
    [accounts]
  );
  const withoutCoordinates = accounts.length - geocoded.length;

  // Initialisation de la carte — une seule fois (le token ne change jamais
  // en cours de session, et re-créer l'objet Map à chaque changement de
  // filtre serait à la fois inutile et visuellement désagréable, la vue
  // "sauterait" en permanence). React.StrictMode (main.jsx) monte/démonte
  // les effets deux fois en développement — map.remove() au nettoyage est
  // donc indispensable pour ne pas accumuler plusieurs instances Mapbox
  // superposées sur le même conteneur.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marqueurs — recréés à chaque changement de `geocoded` (nouveau fetch
  // filtré, ou premier chargement). Les marqueurs Mapbox sont des éléments
  // DOM positionnés par-dessus la carte, indépendants du chargement des
  // tuiles/du style : ils s'affichent même si le fond de carte met du temps
  // à charger (connexion lente), jamais besoin d'attendre l'événement
  // `load` de la carte pour les poser.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    for (const account of geocoded) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-marker";
      el.style.setProperty("--marker-color", TYPE_COLORS[account.type] || "#7a8792");
      el.title = `${account.name} — ${account.type === "CLIENT" ? t("account.client") : t("account.prospect")}`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateRef.current(`/clients/${account.id}`);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([account.longitude, account.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Cadre automatiquement la vue sur les comptes affichés — évite de
    // laisser l'utilisateur sur un centrage France par défaut alors que le
    // filtre actif ne montre par exemple qu'un seul pays/représentant.
    if (geocoded.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const account of geocoded) bounds.extend([account.longitude, account.latitude]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
    }
  }, [geocoded, t]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="panel">
        <h3>
          <MapIcon size={14} /> {t("accountsMap.title")}
        </h3>
        <p className="empty-state">{t("accountsMap.notConfigured")}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>
        <MapIcon size={14} /> {t("accountsMap.title")}
      </h3>

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

      <div className="map-legend">
        <span className="map-legend-item">
          <span className="map-legend-dot" style={{ "--marker-color": TYPE_COLORS.CLIENT }} /> {t("account.client")}
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot" style={{ "--marker-color": TYPE_COLORS.PROSPECT }} /> {t("account.prospect")}
        </span>
      </div>

      {loading && <p className="empty-state">{t("accountsMap.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && accounts.length === 0 && <p className="empty-state">{t("accountsMap.empty")}</p>}

      <div className="accounts-map-container" ref={mapContainerRef} style={{ display: loading || error ? "none" : "block" }} />

      {!loading && !error && withoutCoordinates > 0 && (
        <p className="page-sub" style={{ marginTop: 8 }}>
          {t("accountsMap.withoutCoordinates", { count: withoutCoordinates })}
        </p>
      )}
    </div>
  );
}
