import { useCallback, useMemo, useRef, useState } from "react";
import { UploadCloud, Trash2, Search, CheckCircle2, XCircle, Loader2, RotateCcw, X } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Écran Administrateur — Import photos en masse (2026-09-17, demande client
// suite à l'incident de stockage des photos produit, cf. changelog racine
// "Photos produit cassées le lendemain de leur import" et le CSV
// `photos-produit-cassees-a-reimporter-2026-09-17.csv` fourni séparément) :
// jusqu'ici une photo ne pouvait être ajoutée qu'une par une, depuis la fiche
// produit ("Gérer les photos"). Cet écran permet de déposer plusieurs
// fichiers d'un coup, de les rapprocher automatiquement d'une référence par
// leur nom de fichier (cf. POST /api/products/photos/match, rapprochement
// strict sur `ref`/`dolibarr_ref`, jamais approximatif), d'assigner
// manuellement ceux qui ne matchent pas, puis de les envoyer un par un via le
// même endpoint déjà éprouvé (POST /api/products/:id/photos) que la fiche
// produit — aucune nouvelle logique d'upload/stockage R2 introduite ici,
// uniquement une couche de rapprochement + d'envoi en série au-dessus de
// l'existant.
const MAX_PRODUCT_PHOTOS = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // aligné sur la limite serveur (multer, routes/products.js)
const ALLOWED_MIME = { "image/jpeg": true, "image/png": true, "image/webp": true };
const UPLOAD_CONCURRENCY = 3;

let nextRowId = 1;

export default function ImportPhotosBulk() {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [matching, setMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    async (fileList) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;
      const newRows = incoming.map((file) => {
        const sizeError = !ALLOWED_MIME[file.type]
          ? t("importPhotos.errorType")
          : file.size > MAX_FILE_SIZE
          ? t("importPhotos.errorSize")
          : null;
        return {
          id: nextRowId++,
          file,
          filename: file.name,
          previewUrl: URL.createObjectURL(file),
          matchStatus: sizeError ? "error" : "checking",
          matchError: sizeError,
          productId: null,
          ref: null,
          label: null,
          existingPhotoCount: null,
          manualQuery: "",
          manualResults: [],
          manualSearching: false,
          include: !sizeError,
          uploadStatus: "idle",
          uploadError: null,
        };
      });
      setRows((prev) => [...prev, ...newRows]);

      const toMatch = newRows.filter((r) => !r.matchError);
      if (toMatch.length === 0) return;
      setMatching(true);
      try {
        const { results } = await api.post("/products/photos/match", {
          filenames: toMatch.map((r) => r.filename),
        });
        setRows((prev) =>
          prev.map((row) => {
            const idx = toMatch.findIndex((r) => r.id === row.id);
            if (idx === -1) return row;
            const m = results[idx];
            if (!m) return row;
            return {
              ...row,
              matchStatus: m.productId ? "matched" : "unmatched",
              productId: m.productId,
              ref: m.ref,
              label: m.label,
              existingPhotoCount: m.existingPhotoCount ?? 0,
            };
          })
        );
      } catch (err) {
        setRows((prev) =>
          prev.map((row) =>
            toMatch.some((r) => r.id === row.id)
              ? { ...row, matchStatus: "unmatched", matchError: err.message }
              : row
          )
        );
      } finally {
        setMatching(false);
      }
    },
    [t]
  );

  const removeRow = useCallback((rowId) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === rowId);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== rowId);
    });
  }, []);

  const clearAll = useCallback(() => {
    setRows((prev) => {
      prev.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      return [];
    });
  }, []);

  const toggleInclude = useCallback((rowId) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, include: !r.include } : r)));
  }, []);

  const setManualQuery = useCallback((rowId, value) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, manualQuery: value } : r)));
  }, []);

  const runManualSearch = useCallback(async (rowId) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, manualSearching: true } : r)));
    const row = await new Promise((resolve) => {
      setRows((prev) => {
        resolve(prev.find((r) => r.id === rowId));
        return prev;
      });
    });
    const q = (row?.manualQuery || "").trim();
    if (!q) {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, manualResults: [], manualSearching: false } : r)));
      return;
    }
    try {
      const results = await api.get(`/products?search=${encodeURIComponent(q)}`);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, manualResults: results.slice(0, 8), manualSearching: false } : r))
      );
    } catch {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, manualResults: [], manualSearching: false } : r)));
    }
  }, []);

  const selectManualMatch = useCallback((rowId, product) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              matchStatus: "matched",
              matchError: null,
              productId: product.id,
              ref: product.ref,
              label: product.label,
              existingPhotoCount: (product.photoUrls || []).length,
              manualResults: [],
              manualQuery: "",
              include: true,
            }
          : r
      )
    );
  }, []);

  const clearMatch = useCallback((rowId) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, matchStatus: "unmatched", productId: null, ref: null, label: null, existingPhotoCount: null }
          : r
      )
    );
  }, []);

  // Total prévu par produit parmi les lignes actuellement cochées et
  // matchées — purement informatif (avertissement), la limite de 5 est de
  // toute façon appliquée par le serveur (POST /:id/photos existant) qui
  // reste la seule source de vérité ; un dépassement ici se traduira par une
  // erreur claire sur la ligne concernée plutôt qu'un blocage silencieux.
  const allocationByProduct = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.include && r.matchStatus === "matched" && r.productId && r.uploadStatus !== "done") {
        map.set(r.productId, (map.get(r.productId) || 0) + 1);
      }
    }
    return map;
  }, [rows]);

  const readyCount = rows.filter((r) => r.include && r.matchStatus === "matched" && r.uploadStatus !== "done").length;
  const unmatchedCount = rows.filter((r) => r.matchStatus === "unmatched").length;
  const errorCount = rows.filter((r) => r.matchStatus === "error" || r.uploadStatus === "error").length;
  const doneCount = rows.filter((r) => r.uploadStatus === "done").length;

  const startImport = useCallback(async () => {
    setImporting(true);
    const toUpload = rows.filter((r) => r.include && r.matchStatus === "matched" && r.uploadStatus !== "done");
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const row = toUpload[cursor++];
        if (!row) return;
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, uploadStatus: "uploading", uploadError: null } : r)));
        try {
          const form = new FormData();
          form.append("photo", row.file, row.filename);
          await api.post(`/products/${row.productId}/photos`, form);
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, uploadStatus: "done" } : r)));
        } catch (err) {
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, uploadStatus: "error", uploadError: err.message } : r))
          );
        }
      }
    };
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
    setImporting(false);
  }, [rows]);

  return (
    <>
      <h1 className="page-title">{t("importPhotos.title")}</h1>
      <p className="page-sub">{t("importPhotos.subtitle")}</p>

      <div className="panel">
        <div
          className={`import-photos-dropzone${dragOver ? " drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <UploadCloud size={28} />
          <p style={{ margin: "8px 0 2px", fontWeight: 600 }}>{t("importPhotos.dropTitle")}</p>
          <p className="page-sub" style={{ margin: 0 }}>
            {t("importPhotos.dropHint")}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 14, fontSize: 12.5 }}>
            <span>{t("importPhotos.summary", { total: rows.length, ready: readyCount, unmatched: unmatchedCount, errors: errorCount, done: doneCount })}</span>
            {matching && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink-soft)" }}>
                <Loader2 size={13} className="spin" /> {t("importPhotos.matching")}
              </span>
            )}
            <button className="btn outline" onClick={clearAll} disabled={importing}>
              <Trash2 size={13} /> {t("importPhotos.clearAll")}
            </button>
            <button className="btn primary" onClick={startImport} disabled={importing || readyCount === 0}>
              {importing ? <Loader2 size={14} className="spin" /> : null}
              {importing ? t("importPhotos.importing") : t("importPhotos.importButton", { count: readyCount })}
            </button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="panel table-scroll">
          <table className="lines-table">
            <thead>
              <tr>
                <th></th>
                <th>{t("importPhotos.colFile")}</th>
                <th>{t("importPhotos.colProduct")}</th>
                <th>{t("importPhotos.colStatus")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const projected = row.productId ? (row.existingPhotoCount || 0) + (allocationByProduct.get(row.productId) || 0) : 0;
                const overLimit = row.matchStatus === "matched" && projected > MAX_PRODUCT_PHOTOS;
                return (
                  <tr key={row.id}>
                    <td>
                      <img
                        src={row.previewUrl}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
                      />
                    </td>
                    <td style={{ whiteSpace: "normal", maxWidth: 220, wordBreak: "break-all" }}>{row.filename}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {row.matchStatus === "matched" && (
                        <div>
                          <div>
                            <strong>{row.ref}</strong> — {row.label}
                          </div>
                          <div style={{ fontSize: 11, color: overLimit ? "var(--danger)" : "var(--ink-soft)" }}>
                            {t("importPhotos.projectedCount", { count: projected, max: MAX_PRODUCT_PHOTOS })}
                            {overLimit ? ` — ${t("importPhotos.overLimitWarning")}` : ""}
                          </div>
                          <button className="btn-link" onClick={() => clearMatch(row.id)}>
                            {t("importPhotos.changeMatch")}
                          </button>
                        </div>
                      )}
                      {(row.matchStatus === "unmatched" || row.matchStatus === "checking") && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
                          {row.matchStatus === "checking" ? (
                            <span className="page-sub" style={{ margin: 0 }}>
                              {t("importPhotos.checking")}
                            </span>
                          ) : (
                            <>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input
                                  placeholder={t("importPhotos.searchPlaceholder")}
                                  value={row.manualQuery}
                                  onChange={(e) => setManualQuery(row.id, e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && runManualSearch(row.id)}
                                  style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12.5 }}
                                />
                                <button className="btn outline" onClick={() => runManualSearch(row.id)} disabled={row.manualSearching}>
                                  {row.manualSearching ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                                </button>
                              </div>
                              {row.manualResults.length > 0 && (
                                <div style={{ border: "1px solid var(--line)", borderRadius: 5, overflow: "hidden" }}>
                                  {row.manualResults.map((p) => (
                                    <div
                                      key={p.id}
                                      onClick={() => selectManualMatch(row.id, p)}
                                      style={{ padding: "5px 8px", cursor: "pointer", borderBottom: "1px solid var(--line)", fontSize: 12 }}
                                    >
                                      <strong>{p.ref}</strong> — {p.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {row.matchError && <span className="error-text">{row.matchError}</span>}
                            </>
                          )}
                        </div>
                      )}
                      {row.matchStatus === "error" && <span className="error-text">{row.matchError}</span>}
                    </td>
                    <td>
                      {row.uploadStatus === "idle" && row.matchStatus === "matched" && (
                        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <input type="checkbox" checked={row.include} onChange={() => toggleInclude(row.id)} />
                          {t("importPhotos.include")}
                        </label>
                      )}
                      {row.uploadStatus === "uploading" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink-soft)" }}>
                          <Loader2 size={13} className="spin" /> {t("importPhotos.uploading")}
                        </span>
                      )}
                      {row.uploadStatus === "done" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={14} /> {t("importPhotos.done")}
                        </span>
                      )}
                      {row.uploadStatus === "error" && (
                        <div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)" }}>
                            <XCircle size={14} /> {row.uploadError}
                          </span>
                          <button className="btn-link" onClick={() => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, uploadStatus: "idle" } : r)))}>
                            <RotateCcw size={11} /> {t("importPhotos.retry")}
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn outline" onClick={() => removeRow(row.id)} disabled={row.uploadStatus === "uploading"}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
