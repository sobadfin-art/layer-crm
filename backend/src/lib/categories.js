// Catégories officielles — cf. etat-final-prototype-handoff.md section 1
// ("Kids" est une vraie catégorie, pas un statut temporaire ; "Non classé" est
// réservé aux imports dont la catégorie ne correspond à rien de connu).
export const CATEGORIES = [
  "PREMIUM",
  "CLASSIC",
  "OPTICS",
  "ACCESS",
  "DISPLAY",
  "MERCH",
  "GOGGLES",
  "KIDS",
];

const LABEL_TO_ENUM = {
  premium: "PREMIUM",
  classic: "CLASSIC",
  classique: "CLASSIC",
  optics: "OPTICS",
  optique: "OPTICS",
  access: "ACCESS",
  accessoires: "ACCESS",
  display: "DISPLAY",
  displays: "DISPLAY",
  merch: "MERCH",
  merchandising: "MERCH",
  goggles: "GOGGLES",
  kids: "KIDS",
};

function normalize(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // enlève les accents
}

// Ne rejette jamais une valeur inconnue et ne la classe jamais au hasard :
// renvoie "NON_CLASSE" si aucune correspondance (section 8 du cahier des charges).
export function resolveCategory(rawValue) {
  if (!rawValue) return "NON_CLASSE";
  const key = normalize(rawValue);
  return LABEL_TO_ENUM[key] || "NON_CLASSE";
}
