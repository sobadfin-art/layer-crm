// Reconnaissance automatique des colonnes à l'import fiches client —
// cf. docs/cahier-des-charges-import-fiches-client.md section 5 et
// docs/cahier-des-charges-champs-import.md (inventaire complet des champs
// importables, pour un export Dolibarr enrichi).
//
// Le socle (id, name, countryName...) correspond aux colonnes toujours
// présentes dans l'export Dolibarr standard. Les champs marqués "enrichi"
// ci-dessous ne sont là que si l'export a été spécifiquement configuré pour
// les inclure — s'ils sont absents du fichier, ce n'est jamais bloquant
// (section 6 du cahier des charges) : les valeurs par défaut habituelles
// s'appliquent (Typologie -> Autre, Type -> CLIENT, etc.).
// Insensible à la casse, aux espaces et à la ponctuation (même normalisation
// que l'import catalogue, cf. importMapping.js).

const PATTERNS = {
  id: ["id"],
  name: ["nom"],
  storeName: ["nomalternatif", "nomdumagasin", "nommagasin"],
  status: ["etat", "statut"],
  // Adresse "socle" (toujours présente dans l'export standard) -> dupliquée
  // en facturation ET livraison si les colonnes livraison ci-dessous sont
  // absentes (cf. accountsImport.js).
  billingStreet: ["adresse", "adressefacturation", "billingstreet"],
  billingZip: ["codepostal", "cp", "codepostalfacturation"],
  billingCity: ["ville", "villefacturation", "billingcity"],
  // Livraison — enrichi, seulement si l'export les fournit séparément.
  shippingStreet: ["adresselivraison", "shippingstreet"],
  shippingZip: ["codepostallivraison", "shippingzip"],
  shippingCity: ["villelivraison", "shippingcity"],
  countryName: ["pays"],
  phone: ["telephone", "tel"],
  mobile: ["telportable", "telephoneportable", "mobile", "portable"],
  email: ["email", "mail", "courriel"],
  vatNumber: ["numerotva", "tva", "vatnumber", "numtva"],
  // Contient l'ID du représentant/master rep dans l'app (substitué par
  // l'administrateur avant import, pas le nom Dolibarr tel quel) — cf.
  // section 4 du cahier des charges. Le nom de colonne source reste "Nom du
  // commercial" côté Dolibarr.
  ownerRepId: ["nomducommercial", "commercial", "representant"],
  masterRepId: ["masterrep", "masterrepresentant"], // enrichi
  // Champs enrichis supplémentaires — jamais dans l'export Dolibarr standard
  // à 13 colonnes, mais reconnus si le fichier les fournit.
  type: ["type", "clientprospect"],
  typology: ["typologie", "typology", "typedepointdevente"],
  contactName: ["contact", "interlocuteur", "nomducontact"],
  taxId: ["identifiantfiscal", "siret", "nif", "taxid"],
  iban: ["iban"],
  bic: ["bic", "swift"],
  sepaMandateStatus: ["mandatsepa", "statutmandatsepa", "sepastatus"],
  regimeFiscal: ["regimefiscal", "taxregime"],
};

export const IMPORT_TARGET_FIELDS = Object.keys(PATTERNS);

// Champs réellement obligatoires pour qu'une ligne soit importable (section 5 :
// Id, Nom et Pays sont "Oui" ; tout le reste est "Non", enrichi ou non).
export const REQUIRED_FIELDS = ["id", "name", "countryName"];

function normalizeHeader(header) {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9]/g, ""); // espaces / ponctuation
}

// Retourne { targetField: "en-tête original du fichier" | null, ... }
export function suggestMapping(headers) {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping = {};

  for (const [field, patterns] of Object.entries(PATTERNS)) {
    const normalizedPatterns = patterns.map(normalizeHeader);
    const match = normalizedHeaders.find((h) => normalizedPatterns.includes(h.norm));
    mapping[field] = match ? match.raw : null;
  }

  return mapping;
}
