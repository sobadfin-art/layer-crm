import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Pencil } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate } from "../lib/format.js";
import PhotoLightbox from "../components/PhotoLightbox.jsx";

const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];
const AVAILABILITY = ["EN_STOCK", "RUPTURE", "REASSORT_PREVU"];

// Écran "Catalogue produits" — consultation visuelle complète, distincte de
// "Admin produits" (CatalogueAdmin.jsx, gestion/édition) — cf. fiche
// corrective V2 Administrateur, section 6 : "Admin produits = administrer /
// modifier. Catalogue produits = consulter / visualiser." Lecture seule :
// aucune écriture ici, jamais de bouton créer/modifier/importer. Recherche
// par référence/SKU + filtres catalogue/catégorie/disponibilité (au-delà de
// Catalogue.jsx, la vue Représentant/Master Rep équivalente qui n'a qu'un
// filtre catégorie — volontairement un fichier séparé plutôt qu'un mode
// partagé, ces deux écrans n'ont pas le même public ni la même intention).
//
// Galerie photo : le champ produit reste `photoUrl` (unique) tant que le
// support multi-photo (jusqu'à 5, fiche corrective V2 section 5 "Photos")
// n'est pas construit côté backend — on lit déjà `photoUrls` (tableau) en
// priorité s'il existe, avec repli sur `photoUrl` seul, pour ne pas avoir à
// retoucher cet écran une fois ce support ajouté.
function photosFor(p) {
  if (Array.isArray(p.photoUrls) && p.photoUrls.length > 0) return p.photoUrls;
  return p.photoUrl ? [p.photoUrl] : [];
}

function ProductPhoto({ product, alt }) {
  const photos = photosFor(product);
  const [index, setIndex] = useState(0);
  // Photo cliquable -> vue en grand (demande directe : "rendre cliquable la
  // photo... voir le produit en plus grand... croix pour fermer"), même
  // composant partagé PhotoLightbox.jsx que Catalogue.jsx/NewOrder.jsx.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (photos.length === 0) {
    return <div style={{ height: 140, background: "var(--bg)" }} />;
  }

  return (
    <div style={{ position: "relative" }}>
      <img
        src={photos[index]}
        alt={alt}
        style={{ height: 140, width: "100%", objectFit: "cover", display: "block", cursor: "zoom-in" }}
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
      />
      {lightboxOpen && (
        <PhotoLightbox photos={photos} initialIndex={index} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i - 1 + photos.length) % photos.length);
            }}
            style={sliderBtnStyle("left")}
            aria-label="Photo précédente"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % photos.length);
            }}
            style={sliderBtnStyle("right")}
            aria-label="Photo suivante"
          >
            ›
          </button>
          <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
            {index + 1}/{photos.length}
          </div>
        </>
      )}
    </div>
  );
}

function sliderBtnStyle(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: 4,
    transform: "translateY(-50%)",
    background: "rgba(16,24,40,0.55)",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: 22,
    height: 22,
    lineHeight: "22px",
    padding: 0,
    cursor: "pointer",
    fontSize: 14,
  };
}

export default function CatalogueConsult() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.get("/products"), api.get("/catalogs")])
      .then(([productsData, catalogsData]) => {
        setProducts(productsData);
        setCatalogs(catalogsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => p.category === c)),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      // Rattachement multi-catalogue (correctif 2026-09-16, fiche corrective
      // "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", point 8) : une référence
      // matche dès qu'elle appartient AU MOINS au catalogue sélectionné,
      // jamais exclusivement à lui (elle peut en avoir d'autres).
      if (catalogFilter !== "all" && !(p.catalogIds || []).includes(catalogFilter)) return false;
      if (availabilityFilter !== "all" && p.stockStatus !== availabilityFilter) return false;
      if (!q) return true;
      return [p.ref, p.label, p.model, p.color].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [products, search, category, catalogFilter, availabilityFilter]);

  function stockLine(p) {
    if (p.stockStatus === "EN_STOCK") {
      return { text: t("catalogueConsult.stockEnStock"), color: "var(--teal)" };
    }
    if (p.stockStatus === "REASSORT_PREVU") {
      return {
        text: p.restockDate
          ? t("catalogueConsult.restockOn", { date: shortDate(p.restockDate, locale) })
          : t("catalogueConsult.restockUnknown"),
        color: "var(--danger)",
      };
    }
    return { text: t("catalogueConsult.stockRupture"), color: "var(--danger)" };
  }

  return (
    <>
      <h1 className="page-title">{t("catalogueConsult.title")}</h1>
      <p className="page-sub">{t("catalogueConsult.subtitle")}</p>

      <div className="search-bar">
        <Search size={15} color="#8892a0" />
        <input placeholder={t("catalogueConsult.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Sélecteur de catalogue en bulles/boutons plutôt qu'un simple menu
          déroulant unique (correctif 2026-09-16, fiche corrective "CORRECTIFS
          CRM — PROFIL ADMINISTRATEUR", point 7) — même style `cat-tab` que le
          filtre catégorie juste en dessous et que la sélection de catalogue
          côté prise de commande (NewOrder.jsx, classe `catalog-bubble`), pour
          rester cohérent "comme dans le reste de l'interface CRM". */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`cat-tab ${catalogFilter === "all" ? "active" : ""}`}
          onClick={() => setCatalogFilter("all")}
        >
          {t("catalogueConsult.filterAllCatalogs")}
        </button>
        {catalogs.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cat-tab ${catalogFilter === c.id ? "active" : ""}`}
            onClick={() => setCatalogFilter(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="filter-row" style={{ marginBottom: 10 }}>
        <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
          <option value="all">{t("catalogueConsult.filterAllAvailability")}</option>
          {AVAILABILITY.map((s) => (
            <option key={s} value={s}>
              {t(`catalogueConsult.availability.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="cat-tabs">
        <button className={`cat-tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
          {t("catalogue.filterAll")}
        </button>
        {presentCategories.map((c) => (
          <button key={c} className={`cat-tab ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {t(`category.${c}`)}
          </button>
        ))}
      </div>

      {loading && <p className="empty-state">{t("catalogueConsult.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="empty-state">{t("catalogueConsult.empty")}</p>}
      {!loading && !error && filtered.length > 0 && (
        <p style={{ fontSize: 11.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>
          {t("catalogueConsult.resultCount", { count: filtered.length })}
        </p>
      )}

      <div className="product-grid">
        {filtered.map((p) => {
          const stock = stockLine(p);
          return (
            <div className="product-card" key={p.id}>
              <ProductPhoto product={p} alt={p.label} />
              <div className="product-body">
                <div className="product-ref">{p.ref}</div>
                <div className="product-name">{p.label}</div>
                <div className="product-price">
                  {p.priceFr != null ? (
                    money(p.priceFr, locale)
                  ) : (
                    <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{t("catalogue.priceUnset")}</span>
                  )}
                </div>
                <div className="product-stock" style={{ color: stock.color }}>
                  {stock.text}
                </div>
                {p.catalogNames?.length > 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>{p.catalogNames.join(", ")}</div>
                )}
                {/* Lien rapide "Modifier la référence" vers Admin produits
                    (fiche corrective Administrateur V3) — seul point
                    d'écriture accessible depuis cet écran, qui reste
                    lui-même entièrement en lecture seule. */}
                <button
                  type="button"
                  className="btn outline"
                  style={{ marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => navigate(`/catalogue?editId=${p.id}`)}
                >
                  <Pencil size={12} /> {t("catalogueConsult.editReference")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
