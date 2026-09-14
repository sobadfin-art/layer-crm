import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import ImportWizard from "../components/ImportWizard.jsx";

// Écran Administrateur — import en masse des fiches client depuis l'export
// Dolibarr, cf. docs/cahier-des-charges-import-fiches-client.md et
// docs/cahier-des-charges-champs-import-fiches-client.md (inventaire complet,
// socle + enrichi). Le socle (Id, Nom, État, Adresse, Pays, Téléphone,
// Email, Numéro TVA, Nom du commercial...) correspond à l'export Dolibarr
// standard, déjà reconnu automatiquement. Les champs enrichis ci-dessous ne
// sont utiles que si l'export a été configuré pour les fournir — laissés à
// "non mappé" sinon, sans bloquer l'import.
const FIELD_LABELS = {
  id: "Id (clé de rapprochement Dolibarr)",
  name: "Nom de l'enseigne",
  storeName: "Nom du magasin",
  status: "État (1 = Actif, 0 = Inactif)",
  billingStreet: "Adresse (facturation)",
  billingZip: "Code postal (facturation)",
  billingCity: "Ville (facturation)",
  countryName: "Pays",
  phone: "Téléphone",
  mobile: "Tél portable",
  email: "Email",
  vatNumber: "Numéro TVA",
  ownerRepId: "Nom du commercial (ID représentant dans l'app)",
  // --- Enrichi ---
  type: "Type (Client / Prospect)",
  typology: "Typologie",
  contactName: "Contact",
  taxId: "Identifiant fiscal (SIRET...)",
  shippingStreet: "Adresse (livraison, si distincte)",
  shippingZip: "Code postal (livraison, si distinct)",
  shippingCity: "Ville (livraison, si distincte)",
  iban: "IBAN",
  bic: "BIC",
  sepaMandateStatus: "Statut mandat SEPA",
  regimeFiscal: "Régime fiscal",
  masterRepId: "Master Rep (ID dans l'app, si distinct du commercial)",
};
const REQUIRED_FIELDS = ["id", "name", "countryName"];

export default function AccountsImportAdmin() {
  const { t } = useI18n();
  const [reps, setReps] = useState([]);
  const [defaultRepId, setDefaultRepId] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/accounts-import/reps")
      .then(setReps)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h1 className="page-title">{t("accountsImportAdmin.title")}</h1>
      <p className="page-sub">{t("accountsImportAdmin.subtitle")}</p>

      {error && <p className="error-text">{error}</p>}

      <div className="panel">
        <h3>{t("accountsImportAdmin.defaultRepTitle")}</h3>
        <p className="page-sub">{t("accountsImportAdmin.defaultRepHint")}</p>
        <div className="field">
          <label>{t("accountsImportAdmin.defaultRepLabel")}</label>
          <select
            value={defaultRepId}
            onChange={(e) => setDefaultRepId(e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, maxWidth: 360 }}
          >
            <option value="">{t("accountsImportAdmin.defaultRepChoose")}</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName} {r.lastName} ({t(`role.${r.role}`)})
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
          {t("accountsImportAdmin.repIdHint")}
        </p>
      </div>

      {!defaultRepId && <p className="empty-state">{t("accountsImportAdmin.chooseRepFirst")}</p>}

      {defaultRepId && (
        <ImportWizard
          fieldLabels={FIELD_LABELS}
          requiredFields={REQUIRED_FIELDS}
          modeChoiceLabel={t("accountsImportAdmin.modeLabel")}
          renderSummaryExtra={(summary) =>
            summary.repFallbackCount > 0 && (
              <div className="task-row">
                <span>{t("accountsImportAdmin.summaryRepFallback")}</span>
                <span>{summary.repFallbackCount}</span>
              </div>
            )
          }
          beforeCommit={() =>
            defaultRepId ? true : { ok: false, error: t("accountsImportAdmin.chooseRepFirst") }
          }
          onPreview={async (file) => {
            const form = new FormData();
            form.append("file", file);
            return api.post("/accounts-import/preview", form);
          }}
          onSummary={async (file, mapping) => {
            const form = new FormData();
            form.append("file", file);
            form.append("mapping", JSON.stringify(mapping));
            return api.post("/accounts-import/summary", form);
          }}
          onCommit={async (file, mapping, mode) => {
            const form = new FormData();
            form.append("file", file);
            form.append("mapping", JSON.stringify(mapping));
            form.append("mode", mode);
            form.append("defaultRepId", defaultRepId);
            return api.post("/accounts-import/commit", form);
          }}
        />
      )}
    </>
  );
}
