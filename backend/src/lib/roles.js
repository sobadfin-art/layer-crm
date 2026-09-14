// Rôles de l'application — cf. etat-final-prototype-handoff.md section 3.
export const ROLES = Object.freeze({
  REPRESENTANT: "REPRESENTANT",
  MASTER_REP: "MASTER_REP",
  FRONT_DESK: "FRONT_DESK",
  DIRECTEUR: "DIRECTEUR",
  ADMINISTRATEUR: "ADMINISTRATEUR",
});

export const ALL_ROLES = Object.values(ROLES);

// Résumé des accès (section 3 du document handoff), pour référence et pour
// guider le middleware de cloisonnement des routes construites au Lot 2+ :
//
// REPRESENTANT    → ses clients uniquement (accounts.owner_rep_id = user.id),
//                    prise de commande, agenda, tâches, Data (lecture limitée)
// MASTER_REP      → comptes des reps qui lui sont affectés (sales_reps.master_rep_id),
//                    objectifs en lecture seule, ne fixe jamais d'objectif
// FRONT_DESK      → toutes les fiches clients/commandes, export Dolibarr, SAV
// DIRECTEUR       → vue globale, fixe les objectifs, gère l'équipe,
//                    a aussi un accès direct à la vue Front desk
// ADMINISTRATEUR  → catalogue produits (CRUD), imports en masse,
//                    PAS d'accès aux règles commerciales
