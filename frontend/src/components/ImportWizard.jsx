import { useState } from "react";
import { Upload, ArrowRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "../i18n/I18nContext.jsx";

// Assistant d'import générique (aperçu -> mapping -> résumé -> application),
// partagé entre l'import catalogue et l'import fiches client : les deux
// suivent exactement la même mécanique en 4 étapes (cf.
// docs/cahier-des-charges-import-catalogue.md et
// docs/cahier-des-charges-import-fiches-client.md), seuls les champs cibles
// et les appels réseau diffèrent (passés en props par la page appelante).
//
// fieldLabels: { targetFieldKey: "Libellé affiché" }
// requiredFields: [targetFieldKey, ...]
// onPreview(file) -> { headers, suggestedMapping, previewRows, totalRows }
// onSummary(file, mapping) -> résumé (forme libre, affiché via renderSummaryExtra)
// onCommit(file, mapping, mode) -> résultat { created, updated, skipped, errors, total }
// beforeCommit() -> { ok, error } | true — dernière validation avant l'étape 4
//   (ex. représentant par défaut choisi), appelée au passage résumé -> commit.
// renderSummaryExtra(summary) -> JSX optionnel pour des champs propres à l'import
export default function ImportWizard({
  fieldLabels,
  requiredFields = [],
  onPreview,
  onSummary,
  onCommit,
  beforeCommit,
  renderSummaryExtra,
  modeChoiceLabel,
}) {
  const { t } = useI18n();
  const [step, setStep] = useState("upload"); // upload -> mapping -> summary -> done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [summary, setSummary] = useState(null);
  const [mode, setMode] = useState("create_and_update");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setBusy(true);
    try {
      const data = await onPreview(f);
      setPreview(data);
      setMapping(data.suggestedMapping);
      setStep("mapping");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function goToSummary() {
    const missing = requiredFields.filter((f) => !mapping[f]);
    if (missing.length > 0) {
      setError(
        t("importWizard.missingRequired", {
          fields: missing.map((f) => fieldLabels[f]).join(", "),
        })
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await onSummary(file, mapping);
      setSummary(data);
      setStep("summary");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (beforeCommit) {
      const check = beforeCommit();
      if (check !== true && !check.ok) {
        setError(check.error);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      const data = await onCommit(file, mapping, mode);
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setMapping({});
    setSummary(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="panel">
      {error && <p className="error-text">{error}</p>}

      {step === "upload" && (
        <div style={{ textAlign: "center", padding: "24px 10px" }}>
          <Upload size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p className="page-sub" style={{ marginBottom: 12 }}>{t("importWizard.uploadHint")}</p>
          <label className="btn primary" style={{ cursor: "pointer", display: "inline-flex" }}>
            {busy ? t("importWizard.analyzing") : t("importWizard.chooseFile")}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={busy} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {step === "mapping" && preview && (
        <>
          <h3>{t("importWizard.mappingTitle")}</h3>
          <p className="page-sub">{t("importWizard.mappingHint", { total: preview.totalRows })}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 14 }}>
            {Object.keys(fieldLabels).map((field) => (
              <div className="field" key={field}>
                <label>
                  {fieldLabels[field]}
                  {requiredFields.includes(field) ? " *" : ""}
                </label>
                <select
                  value={mapping[field] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                  style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
                >
                  <option value="">{t("importWizard.notMapped")}</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h3>{t("importWizard.previewTitle")}</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {preview.headers.map((h) => (
                      <td key={h} style={{ padding: "4px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={goToSummary} disabled={busy}>
              {busy ? t("importWizard.analyzing") : t("importWizard.next")} <ArrowRight size={14} />
            </button>
            <button className="btn outline" onClick={reset}>
              {t("importWizard.cancel")}
            </button>
          </div>
        </>
      )}

      {step === "summary" && summary && (
        <>
          <h3>{t("importWizard.summaryTitle")}</h3>
          <div className="task-row">
            <span>{t("importWizard.summaryTotal")}</span>
            <span>{summary.total}</span>
          </div>
          <div className="task-row">
            <span>{t("importWizard.summaryNew")}</span>
            <span>{summary.newCount}</span>
          </div>
          <div className="task-row">
            <span>{t("importWizard.summaryUpdate")}</span>
            <span>{summary.updateCount}</span>
          </div>
          <div className="task-row">
            <span>{t("importWizard.summaryErrors")}</span>
            <span style={summary.errorCount > 0 ? { color: "var(--danger)" } : undefined}>{summary.errorCount}</span>
          </div>
          {renderSummaryExtra && renderSummaryExtra(summary)}

          <div className="field" style={{ marginTop: 12 }}>
            <label>{modeChoiceLabel || t("importWizard.modeLabel")}</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="create_and_update">{t("importWizard.modeCreateAndUpdate")}</option>
              <option value="create_only">{t("importWizard.modeCreateOnly")}</option>
              <option value="update_only">{t("importWizard.modeUpdateOnly")}</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={handleCommit} disabled={busy}>
              {busy ? t("importWizard.applying") : t("importWizard.commit")}
            </button>
            <button className="btn outline" onClick={() => setStep("mapping")}>
              {t("importWizard.back")}
            </button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: "16px 10px" }}>
          <CheckCircle2 size={26} style={{ color: "var(--teal)", marginBottom: 8 }} />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t("importWizard.doneTitle")}</p>
          <p className="page-sub">
            {t("importWizard.doneSummary", { created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors })}
          </p>
          <button className="btn primary" onClick={reset}>
            {t("importWizard.newImport")}
          </button>
        </div>
      )}
    </div>
  );
}
