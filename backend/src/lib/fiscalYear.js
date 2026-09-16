// Année commerciale Möken : du 1er novembre au 31 octobre.
//
// Miroir backend de frontend/src/lib/fiscalYear.js (les deux bases de code ne
// partagent pas de bundle commun, donc pas d'import direct possible — cette
// copie reproduit exactement la même règle de calcul pour rester cohérente
// avec l'étiquette "Année commerciale {range}" déjà affichée côté client sur
// Dashboard/MasterRepDashboard/DirecteurDashboard).
//
// Ajoutée pour CORRECTIFS P0 — Profil Représentant, section 3 (Customer
// Performance) : "Période par défaut : année commerciale (1er novembre → 31
// octobre), PAS l'année civile." Seul /api/dashboard/customer-performance
// utilise ce module pour l'instant — /api/dashboard/bestsellers reste
// volontairement en année civile (non demandé par cette fiche corrective,
// cf. commentaire local dans routes/dashboard.js et dans
// frontend/src/lib/fiscalYear.js).
//
// `startYear` désigne l'année de début de la période commerciale : l'année
// commerciale "2025" court du 01/11/2025 au 31/10/2026 (libellé "2025–2026",
// cohérent avec fiscalYearLabel() côté frontend).
export function fiscalYearBounds(startYear) {
  const start = new Date(Date.UTC(startYear, 10, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(startYear + 1, 9, 31, 23, 59, 59, 999));
  return { start, end };
}

// Année de début de l'année commerciale EN COURS à la date donnée (par
// défaut : maintenant). Le serveur PostgreSQL de cet environnement tourne en
// Etc/UTC (cf. commentaire existant sur /api/dashboard/rdv) — on calcule donc
// ce "aujourd'hui" en UTC pour rester cohérent avec le reste du backend,
// plutôt qu'en fuseau local du process Node.
export function currentFiscalYearStart(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = janvier ... 10 = novembre, 11 = décembre
  return month >= 10 ? year : year - 1;
}
