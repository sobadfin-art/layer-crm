// Les 11 typologies officielles et le secteur qu'elles impliquent
// (cf. etat-final-prototype-handoff.md section 4 : "secteur dérivé (Opticien / Mode-Surf-Sport)").
// Le secteur n'est jamais saisi manuellement : il est toujours recalculé côté serveur
// à partir de la typologie, pour éviter toute incohérence.
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

export function sectorForTypology(typology) {
  return typology === "OPTICIEN" ? "OPTICIEN" : "MODE_SURF_SPORT";
}

// Libellés métier (section 4 du handoff) -> valeur enum, pour résoudre une
// colonne "Typologie" dans un fichier d'import enrichi (cf.
// docs/cahier-des-charges-champs-import.md). Ne rejette jamais une valeur
// inconnue : renvoie "AUTRE" si aucune correspondance, jamais deviné au hasard
// (même logique que resolveCategory pour le catalogue).
const LABEL_TO_TYPOLOGY = {
  opticien: "OPTICIEN",
  "surf shop": "SURF_SHOP",
  surfshop: "SURF_SHOP",
  "fashion store": "FASHION_STORE",
  fashionstore: "FASHION_STORE",
  "skate shop": "SKATE_SHOP",
  skateshop: "SKATE_SHOP",
  "ski shop": "SKI_SHOP",
  skishop: "SKI_SHOP",
  "concept store": "CONCEPT_STORE",
  conceptstore: "CONCEPT_STORE",
  uship: "USHIP",
  "bike store": "BIKE_STORE",
  bikestore: "BIKE_STORE",
  "key account": "KEY_ACCOUNT",
  keyaccount: "KEY_ACCOUNT",
  distributor: "DISTRIBUTOR",
  distributeur: "DISTRIBUTOR",
  autre: "AUTRE",
  other: "AUTRE",
};

function normalizeLabel(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function resolveTypology(rawValue) {
  if (!rawValue) return "AUTRE";
  if (TYPOLOGIES.includes(String(rawValue).toUpperCase())) return String(rawValue).toUpperCase();
  return LABEL_TO_TYPOLOGY[normalizeLabel(rawValue)] || "AUTRE";
}
