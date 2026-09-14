import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Search, ImageUp } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
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

export default function CatalogueAdmin() {
  const { t } = useI18n();
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

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

  useEffect(() => {
    if (!selectedCatalogId) {
      setProducts([]);
      return;
    }
    api.get(`/products?catalogId=${selectedCatalogId}`).then(setProducts).catch(() => setProducts([]));
  }, [selectedCatalogId]);

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

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.ref, p.label, p.model, p.color].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

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
              api.get(`/products?catalogId=${selectedCatalogId}`).then(setProducts).catch(() => {});
              return result;
            }}
          />

          <div className="panel">
            <h3>{t("catalogueAdmin.productsTitle")}</h3>
            <div className="search-bar">
              <Search size={15} color="#8892a0" />
              <input placeholder={t("catalogueAdmin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>{t("catalogueAdmin.colPhoto")}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>{t("catalogueAdmin.colRef")}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>{t("catalogueAdmin.colLabel")}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>{t("catalogueAdmin.colCategory")}</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>{t("catalogueAdmin.colQty")}</th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice(0, 100).map((p) => (
                    <tr key={p.id}>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)" }}>
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={p.label}
                            style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 4,
                              border: "1px dashed var(--line)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--ink-soft)",
                            }}
                          >
                            <ImageUp size={14} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)" }}>{p.ref}</td>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)" }}>{p.label}</td>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)" }}>{t(`category.${p.category}`) || p.category}</td>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)", textAlign: "right" }}>{p.qty}</td>
                      <td style={{ padding: "4px 8px", borderTop: "1px solid var(--line)" }}>
                        <button
                          className="btn outline"
                          disabled={uploadingId === p.id}
                          onClick={() => openPhotoPicker(p.id)}
                        >
                          {uploadingId === p.id
                            ? t("catalogueAdmin.uploadingPhoto")
                            : p.photoUrl
                              ? t("catalogueAdmin.replacePhoto")
                              : t("catalogueAdmin.uploadPhoto")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
