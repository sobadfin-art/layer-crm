// Année commerciale Möken : du 1er novembre au 31 octobre — règle confirmée
// par le client (PDF Représentant "Récapitulatif global des corrections V2" :
// "Période commerciale par défaut : du 1er novembre au 31 octobre. Cette
// règle doit être utilisée pour le portefeuille annuel et les indicateurs
// annuels du représentant."), étendue sur confirmation explicite du client
// (2026-09-16) à la lisibilité des indicateurs cumulés (portefeuille annuel
// et commandes fermes/précommandes cumulées vs objectif) des tableaux de bord
// Représentant, Master Rep et Directeur — les trois seuls écrans concernés.
// Rien d'autre dans l'app ne bascule sur cette période (Data/RepData.jsx,
// l'historique de la fiche compte, les extractions Directeur... restent en
// année civile, cf. commentaires locaux à ces écrans).
export function fiscalYearBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = janvier ... 10 = novembre, 11 = décembre
  const startYear = month >= 10 ? year : year - 1;
  const start = new Date(startYear, 10, 1, 0, 0, 0, 0);
  const end = new Date(startYear + 1, 9, 31, 23, 59, 59, 999);
  return { start, end, startYear, endYear: startYear + 1 };
}

// Étiquette lisible de l'année commerciale en cours, ex. "2025–2026" —
// utilisée en complément des libellés existants, jamais pour remplacer une
// date précise.
export function fiscalYearLabel(date = new Date()) {
  const { startYear, endYear } = fiscalYearBounds(date);
  return `${startYear}–${endYear}`;
}
