import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, Search, ImageUp, Pencil, ChevronLeft, ChevronRight, X, Images } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { shortDate } from "../lib/format.js";
import { downloadFile } from "../lib/download.js";
import ImportWizard from "../components/ImportWizard.jsx";

// Écran Administrateur — catalogue produits (gestion des catalogues + import
// en masse, cf. docs/cahier-des-charges-import-catalogue.md et
// docs/cahier-des-charges-champs-import-catalogue.md). La prise de commande
// elle-même reste hors périmètre (Catalogue.jsx, rôles vente). Les champs
// enrichis ci-dessous ne sont utiles que si l'export a été configuré pour
// les fournir — laissés à "non mappé" sinon, sans bloquer l'import. La photo
// produit reste hors périmètre de cet import (section 9 du cahier des
// charges) : elle est réglée par le rapprochement mokenvision.com ou
// manuellement sur la fiche, jamais par une colonne du fichier.
const FIELD_LABELS = {
  ref: "Référence",
  model: "Modèle",
  color: "Couleur",
  category: "Catégorie",
  priceFR: "Prix France",
  priceExport: "Prix Export",
  priceCH: "Prix Suisse",
  rrp: "Prix conseillé (RRP)",
  qty: "Quantité en stock",
  dolibarrRef: "ID Dolibarr",
  // --- Enrichi ---
  collection: "Collection",
  stockStatus: "Statut stock",
  productStatus: "Statut produit",
  restockDate: "Date de réassort",
  expectedQty: "Quantité attendue (réassort)",
};
const REQUIRED_FIELDS = ["ref"];

// Référentiels officiels — jamais inventés, cf. lib/categories.js (backend) /
// commentaire en tête de ce fichier : "Kids" est une vraie catégorie, "Non
// classé" est réservé aux lignes d'import non reconnues (jamais choisissable
// à la création manuelle d'une référence).
const CATEGORIES = ["PREMIUM", "CLASSIC", "OPTICS", "ACCESS", "DISPLAY", "MERCH", "GOGGLES", "KIDS"];
const STOCK_STATUSES = ["EN_STOCK", "RUPTURE", "REASSORT_PREVU"];
const PRODUCT_STATUSES = ["NOUVEAU", "ACTIF", "DISCONTINUE"];
const PAGE_SIZE = 20;
const MAX_PRODUCT_PHOTOS = 5;

const emptyProductForm = {
  ref: "",
  label: "",
  model: "",
  color: "",
  category: "PREMIUM",
  description: "",
  priceFR: "",
  priceExport: "",
  priceCH: "",
  rrp: "",
  qty: "0",
  stockStatus: "EN_STOCK",
  productStatus: "NOUVEAU",
  restockDate: "",
  expectedQty: "",
};

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function CatalogueAdmin() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  // Lien direct "Modifier la référence" depuis l'onglet "Visualisation du
  // catalogue" (CatalogueConsult.jsx, fiche corrective Administrateur V3) :
  // ?editId=... — cet écran-ci liste les produits PAR catalogue (un seul
  // sélectionné à la fois), il faut donc d'abord retrouver le catalogue de la
  // référence visée avant de pouvoir ouvrir sa fiche d'édition.
  const editId = searchParams.get("editId");
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noPhotoOnly, setNoPhotoOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Galerie photo (jusqu'à 5 par référence, fiche corrective V2
  // Administrateur section 5) — `photoGalleryProduct` porte la fiche en
  // cours d'édition dans la modale (avec `photos` = détail {id, url,
  // position} nécessaire pour supprimer/réordonner, absent de la liste
  // paginée qui ne renvoie que `photoUrls`).
  const [photoGalleryProduct, setPhotoGalleryProduct] = useState(null);
  const [photoGalleryPhotos, setPhotoGalleryPhotos] = useState([]);
  const [photoGalleryLoading, setPhotoGalleryLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState(null);

  const loadCatalogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/catalogs");
      setCatalogs(data);
      if (!selectedCatalogId && data.length > 0) setSelectedCatalogId(data[0].id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const loadProducts = useCallback(() => {
    if (!selectedCatalogId) {
      setProducts([]);
      return;
    }
    api.get(`/products?catalogId=${selectedCatalogId}`).then(setProducts).catch(() => setProducts([]));
  }, [selectedCatalogId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Étape 1 du lien direct ?editId=... : dès que les catalogues sont chargés,
  // retrouve le catalogue de la référence visée et le sélectionne (déclenche
  // loadProducts ci-dessus pour ce catalogue).
  useEffect(() => {
    if (!editId || catalogs.length === 0) return;
    api
      .get(`/products/${editId}`)
      .then((product) => {
        if (product?.catalogId) setSelectedCatalogId(product.catalogId);
      })
      .catch(() => {
        // Référence introuvable/supprimée entre-temps : on abandonne
        // silencieusement le lien direct plutôt que de bloquer l'écran.
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("editId");
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, catalogs.length]);

  // Étape 2 : une fois les produits du bon catalogue chargés, ouvre la fiche
  // d'édition et retire le paramètre (même précaution anti-réouverture que
  // les autres liens directs de l'appli — notifications, etc.).
  useEffect(() => {
    if (!editId || products.length === 0) return;
    const target = products.find((p) => p.id === editId);
    if (target) {
      openEditProductForm(target);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("editId");
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, products]);

  // Filtres + recherche + pagination réinitialisée à chaque changement de
  // critère (PDF section 1.2 : "Ajouter une pagination claire ... Précédent /
  // Suivant et, idéalement, numéro de page ou nombre de résultats").
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, stockFilter, statusFilter, noPhotoOnly, selectedCatalogId]);

  async function handleCreateCatalog(e) {
    e.preventDefault();
    if (!newCatalogName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post("/catalogs", { name: newCatalogName.trim() });
      setNewCatalogName("");
      await loadCatalogs();
      setSelectedCatalogId(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(catalog) {
    setBusyId(catalog.id);
    try {
      await api.patch(`/catalogs/${catalog.id}`, { active: !catalog.active });
      await loadCatalogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCatalog(catalog) {
    setBusyId(catalog.id);
    try {
      await api.del(`/catalogs/${catalog.id}`);
      if (selectedCatalogId === catalog.id) setSelectedCatalogId(null);
      await loadCatalogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function openPhotoGallery(product) {
    setPhotoGalleryProduct(product);
    setPhotoGalleryPhotos([]);
    setUploadError(null);
    setPhotoGalleryLoading(true);
    try {
      const photos = await api.get(`/products/${product.id}/photos`);
      setPhotoGalleryPhotos(photos);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setPhotoGalleryLoading(false);
    }
  }

  function closePhotoGallery() {
    setPhotoGalleryProduct(null);
    setPhotoGalleryPhotos([]);
    setUploadError(null);
  }

  // Fusionne la fiche produit + le tableau de photos (renvoyés ensemble par
  // les routes d'ajout/suppression) dans la liste paginée ET dans la modale
  // ouverte, pour que les deux restent synchronisées sans recharger la page.
  function applyGalleryResult({ product, photos }) {
    const photoUrls = photos.map((ph) => ph.url);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...product, photoUrls } : p)));
    setPhotoGalleryPhotos(photos);
    setPhotoGalleryProduct((prev) => (prev && prev.id === product.id ? { ...prev, ...product, photoUrls } : prev));
  }

  function openPhotoPicker() {
    fileInputRef.current?.click();
  }

  async function handlePhotoFileChange(e) {
    const file = e.target.files?.[0];
    const productId = photoGalleryProduct?.id;
    e.target.value = ""; // permet de re-choisir le même fichier ensuite
    if (!file || !productId) return;

    setUploadError(null);
    setUploadingId(productId);
    try {
      const form = new FormData();
      form.append("photo", file);
      const result = await api.post(`/products/${productId}/photos`, form);
      applyGalleryResult(result);
    } catch (err) {
      setUploadError(err.message || t("catalogueAdmin.uploadPhotoError"));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeleteGalleryPhoto(photoId) {
    const productId = photoGalleryProduct?.id;
    if (!productId) return;
    setUploadError(null);
    setUploadingId(productId);
    try {
      const result = await api.del(`/products/${productId}/photos/${photoId}`);
      applyGalleryResult(result);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  // "Désignation de la photo principale" (fiche corrective Administrateur V3,
  // section 5) — jusqu'ici la couverture n'était QUE la position 0, sans
  // aucun moyen d'en désigner une autre. PATCH /products/:id/photos/reorder
  // existait déjà côté serveur (utilisé nulle part côté client) : on l'utilise
  // ici pour faire passer la photo choisie en tête, le reste conservant son
  // ordre relatif ("order preservation").
  async function handleSetCoverPhoto(photoId) {
    const productId = photoGalleryProduct?.id;
    if (!productId) return;
    const order = [photoId, ...photoGalleryPhotos.filter((ph) => ph.id !== photoId).map((ph) => ph.id)];
    setUploadError(null);
    setUploadingId(productId);
    try {
      const result = await api.patch(`/products/${productId}/photos/reorder`, { order });
      applyGalleryResult(result);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  function openNewProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductFormError(null);
    setShowProductForm(true);
  }

  function openEditProductForm(p) {
    setEditingProductId(p.id);
    setProductForm({
      ref: p.ref || "",
      label: p.label || "",
      model: p.model || "",
      color: p.color || "",
      category: CATEGORIES.includes(p.category) ? p.category : "PREMIUM",
      description: p.description || "",
      // Note : la sérialisation snake_case -> camelCase générique (toCamel)
      // transforme price_fr / price_ch en priceFr / priceCh (un seul "r"/"h"
      // majuscule après l'underscore, pas deux) — donc différent de la casse
      // priceFR / priceCH attendue par le schéma zod en écriture (POST/PATCH).
      // Cf. NewOrder.jsx / Catalogue.jsx qui lisent déjà product.priceFr.
      priceFR: p.priceFr ?? "",
      priceExport: p.priceExport ?? "",
      priceCH: p.priceCh ?? "",
      rrp: p.rrp ?? "",
      qty: String(p.qty ?? 0),
      stockStatus: p.stockStatus || "EN_STOCK",
      productStatus: p.productStatus || "NOUVEAU",
      restockDate: p.restockDate ? p.restockDate.slice(0, 10) : "",
      expectedQty: p.expectedQty ?? "",
    });
    setProductFormError(null);
    setShowProductForm(true);
  }

  function closeProductForm() {
    setShowProductForm(false);
    setEditingProductId(null);
    setProductFormError(null);
  }

  async function handleSubmitProduct(e) {
    e.preventDefault();
    if (!productForm.ref.trim() || !productForm.label.trim()) {
      setProductFormError(t("catalogueAdmin.productFormMissing"));
      return;
    }
    setSavingProduct(true);
    setProductFormError(null);
    try {
      const payload = {
        ref: productForm.ref.trim(),
        label: productForm.label.trim(),
        model: productForm.model.trim() || null,
        color: productForm.color.trim() || null,
        category: productForm.category,
        description: productForm.description.trim() || null,
        priceFR: toNumberOrNull(productForm.priceFR),
        priceExport: toNumberOrNull(productForm.priceExport),
        priceCH: toNumberOrNull(productForm.priceCH),
        rrp: toNumberOrNull(productForm.rrp),
        qty: toNumberOrNull(productForm.qty) ?? 0,
        stockStatus: productForm.stockStatus,
        productStatus: productForm.productStatus,
        restockDate: productForm.restockDate ? new Date(`${productForm.restockDate}T00:00:00.000Z`).toISOString() : null,
        expectedQty: toNumberOrNull(productForm.expectedQty),
      };
      if (editingProductId) {
        const updated = await api.patch(`/products/${editingProductId}`, payload);
        setProducts((prev) => prev.map((p) => (p.id === editingProductId ? updated : p)));
      } else {
        const created = await api.post("/products", { ...payload, catalogId: selectedCatalogId });
        setProducts((prev) => [created, ...prev]);
        await loadCatalogs();
      }
      closeProductForm();
    } catch (err) {
      setProductFormError(err.message);
    } finally {
      setSavingProduct(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (stockFilter !== "all" && p.stockStatus !== stockFilter) return false;
      if (statusFilter !== "all" && p.productStatus !== statusFilter) return false;
      if (noPhotoOnly && p.photoUrl) return false;
      if (!q) return true;
      return [p.ref, p.label, p.model, p.color].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [products, search, categoryFilter, stockFilter, statusFilter, noPhotoOnly]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <h1 className="page-title">{t("catalogueAdmin.title")}</h1>
      <p className="page-sub">{t("catalogueAdmin.subtitle")}</p>

      {error && <p className="error-text">{error}</p>}

      <div className="panel">
        <h3>{t("catalogueAdmin.catalogsTitle")}</h3>
        <form onSubmit={handleCreateCatalog} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            placeholder={t("catalogueAdmin.newCatalogPlaceholder")}
            value={newCatalogName}
            onChange={(e) => setNewCatalogName(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13 }}
          />
          <button className="btn primary" type="submit" disabled={creating}>
            <Plus size={14} /> {t("catalogueAdmin.newCatalogSubmit")}
          </button>
        </form>

        {loading && <p className="empty-state">{t("catalogueAdmin.loading")}</p>}
        {!loading && catalogs.length === 0 && <p className="empty-state">{t("catalogueAdmin.noCatalogs")}</p>}

        {catalogs.map((c) => (
          <div
            className="task-row"
            key={c.id}
            style={{
              cursor: "pointer",
              background: selectedCatalogId === c.id ? "var(--bg)" : undefined,
              borderRadius: 6,
            }}
            onClick={() => setSelectedCatalogId(c.id)}
          >
            <div>
              <strong>{c.name}</strong>{" "}
              {!c.active && (
                <span className="typology-badge" style={{ color: "var(--danger)" }}>
                  {t("catalogueAdmin.inactive")}
                </span>
              )}
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                {t("catalogueAdmin.productCount", { count: c.productCount })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
              <button className="btn outline" disabled={busyId === c.id} onClick={() => toggleActive(c)}>
                {c.active ? t("catalogueAdmin.deactivate") : t("catalogueAdmin.activate")}
              </button>
              <button className="btn outline" disabled={busyId === c.id} onClick={() => deleteCatalog(c)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedCatalogId && (
        <>
          <div className="panel">
            <h3>{t("catalogueAdmin.importTitle")}</h3>
            <p className="page-sub">{t("catalogueAdmin.importHint")}</p>
          </div>

          <ImportWizard
            fieldLabels={FIELD_LABELS}
            requiredFields={REQUIRED_FIELDS}
            allowSheetSelection
            onDownloadTemplate={() => downloadFile("/catalogs/import-template", "modele-import-catalogue.xlsx")}
            onPreview={async (file, sheetName) => {
              const form = new FormData();
              form.append("file", file);
              if (sheetName) form.append("sheetName", sheetName);
              return api.post(`/catalogs/${selectedCatalogId}/import/preview`, form);
            }}
            onSummary={async (file, mapping, sheetName) => {
              const form = new FormData();
              form.append("file", file);
              form.append("mapping", JSON.stringify(mapping));
              if (sheetName) form.append("sheetName", sheetName);
              return api.post(`/catalogs/${selectedCatalogId}/import/summary`, form);
            }}
            onCommit={async (file, mapping, mode, sheetName) => {
              const form = new FormData();
              form.append("file", file);
              form.append("mapping", JSON.stringify(mapping));
              form.append("mode", mode);
              if (sheetName) form.append("sheetName", sheetName);
              const result = await api.post(`/catalogs/${selectedCatalogId}/import/commit`, form);
              await loadCatalogs();
              loadProducts();
              return result;
            }}
          />

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{t("catalogueAdmin.productsTitle")}</h3>
              <button className="btn primary" onClick={openNewProductForm}>
                <Plus size={14} /> {t("catalogueAdmin.newProduct")}
              </button>
            </div>

            {showProductForm && (
              <form onSubmit={handleSubmitProduct} className="panel" style={{ background: "var(--bg)", marginTop: 10 }}>
                <h3 style={{ marginTop: 0 }}>
                  {editingProductId ? t("catalogueAdmin.editProductTitle") : t("catalogueAdmin.newProductTitle")}
                </h3>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.colRef")}</label>
                    <input value={productForm.ref} onChange={(e) => setProductForm((f) => ({ ...f, ref: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.colLabel")}</label>
                    <input value={productForm.label} onChange={(e) => setProductForm((f) => ({ ...f, label: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldModel")}</label>
                    <input value={productForm.model} onChange={(e) => setProductForm((f) => ({ ...f, model: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldColor")}</label>
                    <input value={productForm.color} onChange={(e) => setProductForm((f) => ({ ...f, color: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label>{t("catalogueAdmin.colCategory")}</label>
                  <select value={productForm.category} onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`category.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{t("catalogueAdmin.fieldDescription")}</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldPriceFR")}</label>
                    <input type="number" step="0.01" value={productForm.priceFR} onChange={(e) => setProductForm((f) => ({ ...f, priceFR: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldPriceExport")}</label>
                    <input type="number" step="0.01" value={productForm.priceExport} onChange={(e) => setProductForm((f) => ({ ...f, priceExport: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldPriceCH")}</label>
                    <input type="number" step="0.01" value={productForm.priceCH} onChange={(e) => setProductForm((f) => ({ ...f, priceCH: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldRrp")}</label>
                    <input type="number" step="0.01" value={productForm.rrp} onChange={(e) => setProductForm((f) => ({ ...f, rrp: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.colQty")}</label>
                    <input type="number" value={productForm.qty} onChange={(e) => setProductForm((f) => ({ ...f, qty: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldStockStatus")}</label>
                    <select value={productForm.stockStatus} onChange={(e) => setProductForm((f) => ({ ...f, stockStatus: e.target.value }))}>
                      {STOCK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`catalogueAdmin.stockStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldRestockDate")}</label>
                    <input type="date" value={productForm.restockDate} onChange={(e) => setProductForm((f) => ({ ...f, restockDate: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>{t("catalogueAdmin.fieldExpectedQty")}</label>
                    <input type="number" value={productForm.expectedQty} onChange={(e) => setProductForm((f) => ({ ...f, expectedQty: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label>{t("catalogueAdmin.fieldProductStatus")}</label>
                  <select value={productForm.productStatus} onChange={(e) => setProductForm((f) => ({ ...f, productStatus: e.target.value }))}>
                    {PRODUCT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`catalogueAdmin.productStatus.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {productFormError && <p className="error-text">{productFormError}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button className="btn primary" type="submit" disabled={savingProduct}>
                    {savingProduct ? t("catalogueAdmin.savingProduct") : t("catalogueAdmin.saveProduct")}
                  </button>
                  <button className="btn outline" type="button" onClick={closeProductForm} disabled={savingProduct}>
                    {t("catalogueAdmin.cancelProduct")}
                  </button>
                </div>
              </form>
            )}

            <div className="search-bar" style={{ marginTop: 14 }}>
              <Search size={15} color="#8892a0" />
              <input placeholder={t("catalogueAdmin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-row">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">{t("catalogueAdmin.filterCategoryAll")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`)}
                  </option>
                ))}
              </select>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">{t("catalogueAdmin.filterStockAll")}</option>
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`catalogueAdmin.stockStatus.${s}`)}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">{t("catalogueAdmin.filterStatusAll")}</option>
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`catalogueAdmin.productStatus.${s}`)}
                  </option>
                ))}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={noPhotoOnly} onChange={(e) => setNoPhotoOnly(e.target.checked)} />
                {t("catalogueAdmin.filterNoPhoto")}
              </label>
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "4px 0 10px" }}>
              {t("catalogueAdmin.uploadPhotoHint")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoFileChange}
              style={{ display: "none" }}
            />
            {filteredProducts.length === 0 && <p className="empty-state">{t("catalogueAdmin.noProducts")}</p>}
            {filteredProducts.length > 0 && (
              <div className="table-scroll">
                <table className="lines-table">
                  <thead>
                    <tr>
                      <th>{t("catalogueAdmin.colPhoto")}</th>
                      <th>{t("catalogueAdmin.colRef")}</th>
                      <th>{t("catalogueAdmin.colLabel")}</th>
                      <th>{t("catalogueAdmin.fieldModel")} / {t("catalogueAdmin.fieldColor")}</th>
                      <th>{t("catalogueAdmin.colCategory")}</th>
                      <th>{t("catalogueAdmin.fieldPriceFR")}</th>
                      <th>{t("catalogueAdmin.colQty")}</th>
                      <th>{t("catalogueAdmin.colStock")}</th>
                      <th>{t("catalogueAdmin.colStatus")}</th>
                      <th>{t("catalogueAdmin.colModified")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ position: "relative", width: 32, height: 32 }}>
                            {p.photoUrl ? (
                              <img
                                src={p.photoUrl}
                                alt={p.label}
                                style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 4,
                                  border: "1px dashed var(--line)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                <ImageUp size={13} />
                              </div>
                            )}
                            {(p.photoUrls?.length || 0) > 1 && (
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: -4,
                                  right: -4,
                                  background: "var(--ink)",
                                  color: "white",
                                  borderRadius: 8,
                                  fontSize: 9,
                                  lineHeight: "14px",
                                  minWidth: 14,
                                  height: 14,
                                  textAlign: "center",
                                  padding: "0 2px",
                                }}
                              >
                                {p.photoUrls.length}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{p.ref}</td>
                        <td>{p.label}</td>
                        <td>{[p.model, p.color].filter(Boolean).join(" / ") || "—"}</td>
                        <td>{t(`category.${p.category}`) || p.category}</td>
                        <td>{p.priceFr != null ? `${p.priceFr} €` : "—"}</td>
                        <td>{p.qty}</td>
                        <td>
                          <span className="typology-badge">{t(`catalogueAdmin.stockStatus.${p.stockStatus}`)}</span>
                        </td>
                        <td>
                          <span className="typology-badge">{t(`catalogueAdmin.productStatus.${p.productStatus}`)}</span>
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontSize: 11.5, color: "var(--ink-soft)" }}>
                          {shortDate(p.lastModified, locale)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="btn outline" onClick={() => openEditProductForm(p)}>
                              <Pencil size={13} /> {t("catalogueAdmin.editProduct")}
                            </button>
                            <button className="btn outline" onClick={() => openPhotoGallery(p)}>
                              <Images size={13} /> {t("catalogueAdmin.managePhotos", { count: p.photoUrls?.length || 0, max: MAX_PRODUCT_PHOTOS })}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredProducts.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {t("catalogueAdmin.paginationCount", { count: filteredProducts.length })}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft size={14} /> {t("catalogueAdmin.paginationPrev")}
                  </button>
                  <span style={{ fontSize: 12 }}>{t("catalogueAdmin.paginationPage", { page: currentPage, pageCount })}</span>
                  <button className="btn outline" disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                    {t("catalogueAdmin.paginationNext")} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {photoGalleryProduct && (
        <div className="modal-overlay" onClick={closePhotoGallery}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{t("catalogueAdmin.photoGalleryTitle")}</h3>
                <p className="page-sub" style={{ margin: "2px 0 0" }}>
                  {photoGalleryProduct.ref} — {photoGalleryProduct.label}
                </p>
              </div>
              <button className="btn outline" onClick={closePhotoGallery} aria-label={t("catalogueAdmin.closeGallery")}>
                <X size={14} />
              </button>
            </div>

            {uploadError && <p className="error-text">{uploadError}</p>}

            {photoGalleryLoading ? (
              <p className="empty-state">{t("catalogueAdmin.loading")}</p>
            ) : (
              <>
                {photoGalleryPhotos.length === 0 && (
                  <p className="empty-state">{t("catalogueAdmin.photoGalleryEmpty")}</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  {photoGalleryPhotos.map((ph, idx) => (
                    <div key={ph.id} style={{ position: "relative" }}>
                      <img
                        src={ph.url}
                        alt={photoGalleryProduct.label}
                        style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                      />
                      {idx === 0 ? (
                        <span
                          className="typology-badge"
                          style={{ position: "absolute", top: 4, left: 4, background: "white" }}
                        >
                          {t("catalogueAdmin.photoCover")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn outline"
                          disabled={uploadingId === photoGalleryProduct.id}
                          onClick={() => handleSetCoverPhoto(ph.id)}
                          style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            padding: "3px 5px",
                            background: "white",
                            fontSize: 10.5,
                          }}
                          title={t("catalogueAdmin.setCoverPhoto")}
                        >
                          {t("catalogueAdmin.setCoverPhoto")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn outline"
                        disabled={uploadingId === photoGalleryProduct.id}
                        onClick={() => handleDeleteGalleryPhoto(ph.id)}
                        style={{
                          position: "absolute",
                          bottom: 4,
                          right: 4,
                          padding: "3px 5px",
                          background: "white",
                        }}
                        aria-label={t("catalogueAdmin.deletePhoto")}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14 }}>
                  {photoGalleryPhotos.length >= MAX_PRODUCT_PHOTOS ? (
                    <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{t("catalogueAdmin.photoGalleryMaxReached")}</p>
                  ) : (
                    <button
                      className="btn primary"
                      type="button"
                      disabled={uploadingId === photoGalleryProduct.id}
                      onClick={openPhotoPicker}
                    >
                      {uploadingId === photoGalleryProduct.id ? t("catalogueAdmin.uploadingPhoto") : t("catalogueAdmin.addPhoto")}
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "6px 0 0" }}>
                    {t("catalogueAdmin.photoGalleryHint", { count: photoGalleryPhotos.length, max: MAX_PRODUCT_PHOTOS })}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
