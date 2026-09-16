// Année commerciale Möken : du 1er novembre au 31 octobre — règle confirmée
// par le client (PDF Représentant "Récapitulatif global des corrections V2" :
// "Période commerciale par défaut : du 1er novembre au 31 octobre. Cette
// règle doit être utilisée pour le portefeuille annuel et les indicateurs
// annuels du représentant."), étendue sur confirmation explicite du client
// (2026-09-16) à la lisibilité des indicateurs cumulés (portefeuille annuel
// et commandes fermes/précommandes cumulées vs objectif) des tableaux de bord
// Représentant, Master Rep et Directeur.
//
// Étendue une seconde fois (CORRECTIFS P0 — Profil Représentant, section 3,
// même journée) à Data > Customer Performance (RepData.jsx), qui bascule
// désormais aussi sur l'année commerciale par défaut — cf.
// backend/src/lib/fiscalYear.js (miroir backend de ce fichier) et le
// paramètre ?year= de GET /api/dashboard/customer-performance. Data >
// Bestsellers, lui, reste volontairement en année civile : cette fiche
// corrective ne demande le changement que pour Customer Performance,
// cf. commentaire local dans routes/dashboard.js.
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
