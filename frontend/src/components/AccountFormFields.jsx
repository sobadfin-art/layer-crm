// Champs de fiche compte, partagés entre la création ("Nouveau compte" —
// ClientsList.jsx, et le raccourci "Nouveau prospect / client" en plein
// milieu du parcours de commande — NewOrderQuickAccess.jsx) et l'édition
// (AccountDetail.jsx pourrait migrer dessus plus tard ; non fait ici pour ne
// pas re-risquer un écran déjà testé, cf. commentaire dans AccountDetail.jsx).
//
// Correctif 2026-09-16 (fiche corrective "CORRECTIONS PRIORITAIRES CRM —
// PROFIL REPRÉSENTANT", section 3) : le formulaire de CRÉATION n'exposait
// jusqu'ici que raison sociale/type/pays/typologie — la fiche corrective
// exige explicitement la totalité des champs prévus par la maquette de
// référence (docs/prototype-crm-commercial.jsx, AccountFormFields /
// emptyAccountForm) : adresses de facturation ET de livraison, contact
// complet (nom, indicatifs + téléphone + mobile, email), informations
// légales (SIRET/identifiant fiscal, TVA) et coordonnées bancaires (IBAN,
// BIC, statut du mandat SEPA). Tous ces champs sont déjà acceptés tels
// quels par POST /api/accounts côté serveur (cf. createSchema,
// backend/src/routes/accounts.js) — ceci ne fait qu'exposer ce qui existait
// déjà en base de données.
export const TYPOLOGIES = [
  "OPTICIEN",
  "SURF_SHOP",
  "FASHION_STORE",
  "SKATE_SHOP",
  "SKI_SHOP",
  "CONCEPT_STORE",
  "USHIP",
  "BIKE_STORE",
  "KEY_ACCOUNT",
  "DISTRIBUTOR",
  "AUTRE",
];

const SEPA_STATUSES = ["NON_RENSEIGNE", "EN_ATTENTE", "VALIDE", "REVOQUE"];

// Construit le payload POST /api/accounts à partir de l'état du formulaire.
// Les champs texte optionnels sont envoyés à `null` plutôt que "" : le
// backend les valide avec z.string().optional().nullable() — mais certains
// (email notamment, via z.string().email()) rejettent une chaîne vide avec
// "Invalid email" puisque "" reste une chaîne valide pour .optional(), juste
// pas pour .email(). Convertir "" en null pour TOUS les champs optionnels
// évite ce piège de façon uniforme plutôt que de le corriger champ par champ.
const OPTIONAL_TEXT_FIELDS = [
  "storeName",
  "billingStreet",
  "billingZip",
  "billingCity",
  "shippingStreet",
  "shippingZip",
  "shippingCity",
  "contactName",
  "phoneCountryCode",
  "phone",
  "mobileCountryCode",
  "mobile",
  "email",
  "taxId",
  "vatNumber",
  "iban",
  "bic",
  "deliveryNote",
  "nomCommercial",
];

export function accountPayloadFromForm(form) {
  const payload = {
    type: form.type,
    name: form.name.trim(),
    countryCode: form.countryCode,
    typology: form.typology,
    sepaMandateStatus: form.sepaMandateStatus,
  };
  for (const key of OPTIONAL_TEXT_FIELDS) {
    const value = form[key];
    payload[key] = value && value.trim() ? value.trim() : null;
  }
  return payload;
}

export function emptyAccountForm() {
  return {
    type: "PROSPECT",
    name: "",
    storeName: "",
    countryCode: "",
    typology: "OPTICIEN",
    ownerRepId: "",
    masterRepId: "",
    billingStreet: "",
    billingZip: "",
    billingCity: "",
    shippingStreet: "",
    shippingZip: "",
    shippingCity: "",
    contactName: "",
    phoneCountryCode: "",
    phone: "",
    mobileCountryCode: "",
    mobile: "",
    email: "",
    taxId: "",
    vatNumber: "",
    iban: "",
    bic: "",
    sepaMandateStatus: "NON_RENSEIGNE",
    deliveryNote: "",
    nomCommercial: "",
  };
}

export default function AccountFormFields({
  form,
  setField,
  countries,
  showOwnerPicker,
  reps,
  masterReps,
  t,
}) {
  const taxIdLabel = countries.find((c) => c.code === form.countryCode)?.taxIdLabel || t("account.taxIdGeneric");

  return (
    <>
      <div className="field">
        <label>{t("clients.newAccountName")}</label>
        <input value={form.name} onChange={(e) => setField("name", e.target.value)} />
      </div>
      <div className="field">
        <label>{t("account.nomCommercial")}</label>
        <input
          placeholder={t("account.nomCommercialPlaceholder")}
          value={form.nomCommercial}
          onChange={(e) => setField("nomCommercial", e.target.value)}
        />
      </div>
      <div className="field">
        <label>{t("account.storeName")}</label>
        <input value={form.storeName} onChange={(e) => setField("storeName", e.target.value)} />
      </div>

      <div className="cat-tabs" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`cat-tab ${form.type === "PROSPECT" ? "active" : ""}`}
          onClick={() => setField("type", "PROSPECT")}
        >
          {t("account.prospect")}
        </button>
        <button
          type="button"
          className={`cat-tab ${form.type === "CLIENT" ? "active" : ""}`}
          onClick={() => setField("type", "CLIENT")}
        >
          {t("account.client")}
        </button>
      </div>

      {showOwnerPicker && (
        <div className="form-row">
          <div className="field">
            <label>{t("clients.newAccountOwnerRep")}</label>
            <select value={form.ownerRepId} onChange={(e) => setField("ownerRepId", e.target.value)}>
              <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.firstName} {r.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("clients.newAccountMasterRep")}</label>
            <select value={form.masterRepId} onChange={(e) => setField("masterRepId", e.target.value)}>
              <option value="">{t("teamManagement.noMasterRep")}</option>
              {masterReps.map((mr) => (
                <option key={mr.id} value={mr.id}>
                  {mr.firstName} {mr.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label>{t("clients.newAccountCountry")}</label>
          <select value={form.countryCode} onChange={(e) => setField("countryCode", e.target.value)}>
            <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("clients.newAccountTypology")}</label>
          <select value={form.typology} onChange={(e) => setField("typology", e.target.value)}>
            {TYPOLOGIES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`typology.${ty}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="cc-section-label">
        {t("account.billingAddress")}
        {t("account.billingAddressRequiredSuffix")}
      </p>
      <div className="field">
        <input
          placeholder={t("clients.addressStreet")}
          value={form.billingStreet}
          onChange={(e) => setField("billingStreet", e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="field">
          <input
            placeholder={t("clients.addressZip")}
            value={form.billingZip}
            onChange={(e) => setField("billingZip", e.target.value)}
          />
        </div>
        <div className="field">
          <input
            placeholder={t("clients.addressCity")}
            value={form.billingCity}
            onChange={(e) => setField("billingCity", e.target.value)}
          />
        </div>
      </div>

      <p className="cc-section-label">{t("account.shippingAddress")}</p>
      <div className="field">
        <input
          placeholder={t("clients.addressStreet")}
          value={form.shippingStreet}
          onChange={(e) => setField("shippingStreet", e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="field">
          <input
            placeholder={t("clients.addressZip")}
            value={form.shippingZip}
            onChange={(e) => setField("shippingZip", e.target.value)}
          />
        </div>
        <div className="field">
          <input
            placeholder={t("clients.addressCity")}
            value={form.shippingCity}
            onChange={(e) => setField("shippingCity", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>{t("account.deliveryNote")}</label>
        <textarea
          placeholder={t("account.deliveryNotePlaceholder")}
          value={form.deliveryNote}
          onChange={(e) => setField("deliveryNote", e.target.value)}
        />
      </div>

      <div className="field">
        <label>{t("account.contact")}</label>
        <input value={form.contactName} onChange={(e) => setField("contactName", e.target.value)} />
      </div>

      <div className="form-row">
        <div className="field" style={{ maxWidth: 90 }}>
          <label>{t("clients.dialCode")}</label>
          <input
            placeholder="+33"
            value={form.phoneCountryCode}
            onChange={(e) => setField("phoneCountryCode", e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t("account.phone")}</label>
          <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="field" style={{ maxWidth: 90 }}>
          <label>{t("clients.dialCode")}</label>
          <input
            placeholder="+33"
            value={form.mobileCountryCode}
            onChange={(e) => setField("mobileCountryCode", e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t("account.mobile")}</label>
          <input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>{t("account.email")}</label>
        <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
      </div>

      <p className="cc-section-label">{t("clients.legalInfoTitle")}</p>
      <div className="form-row">
        <div className="field">
          <label>
            {taxIdLabel}
            {t("account.taxIdRequiredSuffix")}
          </label>
          <input value={form.taxId} onChange={(e) => setField("taxId", e.target.value)} />
        </div>
        <div className="field">
          <label>{t("account.vat")}</label>
          <input value={form.vatNumber} onChange={(e) => setField("vatNumber", e.target.value)} />
        </div>
      </div>

      <p className="cc-section-label">{t("clients.bankInfoTitle")}</p>
      <div className="form-row">
        <div className="field">
          <label>{t("account.iban")}</label>
          <input placeholder="FR76 ...." value={form.iban} onChange={(e) => setField("iban", e.target.value)} />
        </div>
        <div className="field">
          <label>{t("account.bic")}</label>
          <input placeholder="ex : BNPAFRPP" value={form.bic} onChange={(e) => setField("bic", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{t("account.sepaStatusLabel")}</label>
        <select value={form.sepaMandateStatus} onChange={(e) => setField("sepaMandateStatus", e.target.value)}>
          {SEPA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`sepaStatus.${s}`)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
