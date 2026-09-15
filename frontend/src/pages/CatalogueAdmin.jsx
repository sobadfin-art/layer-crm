import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Search, ImageUp, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { shortDate } from "../lib/format.js";
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
  dolibarrRef: "Code Dolibarr (correspondance retour client)",
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

  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

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

  function openPhotoPicker(productId) {
    uploadTargetRef.current = productId;
    fileInputRef.current?.click();
  }

  async function handlePhotoFileChange(e) {
    const file = e.target.files?.[0];
    const productId = uploadTargetRef.current;
    e.target.value = ""; // permet de re-choisir le même fichier ensuite
    if (!file || !productId) return;

    setUploadError(null);
    setUploadingId(productId);
    try {
      const form = new FormData();
      form.append("photo", file);
      const updated = await api.post(`/products/${productId}/photo`, form);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    } catch (err) {
      setUploadError(err.message || t("catalogueAdmin.uploadPhotoError"));
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
            onPreview={async (file) => {
              const form = new FormData();
              form.append("file", file);
              return api.post(`/catalogs/${selectedCatalogId}/import/preview`, form);
            }}
            onSummary={async (file, mapping) => {
              const form = new FormData();
              form.append("file", file);
              form.append("mapping", JSON.stringify(mapping));
              return api.post(`/catalogs/${selectedCatalogId}/import/summary`, form);
            }}
            onCommit={async (file, mapping, mode) => {
              const form = new FormData();
              form.append("file", file);
              form.append("mapping", JSON.stringify(mapping));
              form.append("mode", mode);
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
            {uploadError && <p className="error-text">{uploadError}</p>}
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
                            <button className="btn outline" disabled={uploadingId === p.id} onClick={() => openPhotoPicker(p.id)}>
                              {uploadingId === p.id
                                ? t("catalogueAdmin.uploadingPhoto")
                                : p.photoUrl
                                  ? t("catalogueAdmin.replacePhoto")
                                  : t("catalogueAdmin.uploadPhoto")}
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
    </>
  );
}
