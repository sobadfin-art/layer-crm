// Référentiel fusionné des types d'interaction / de rendez-vous.
//
// Deux PDF de recette (2026-09-15) demandent chacun un minimum différent
// pour le même sélecteur ("Ajouter une interaction" sur la fiche client) :
//  - PDF Directeur commercial, section 3 : "rendez-vous planifié, rendez-vous
//    téléphonique, rendez-vous de courtoisie".
//  - PDF Représentant, section 4 : "la maquette montre par exemple « Visite »
//    ; la demande de recette impose au minimum : Appel, Email, SAV et Autre.
//    Le référentiel final peut intégrer les deux ensembles si nécessaire."
// Décision retenue (confirmée) : fusionner les deux listes plutôt que
// trancher pour l'une au détriment de l'autre — aucune des deux demandes
// n'est perdue. Réutilisé à la fois pour interactions.type (log d'échange) et
// tasks.rdv_subtype (sous-type au moment de planifier un RDV dans l'agenda).
export const INTERACTION_TYPES = [
  "VISITE",
  "APPEL",
  "EMAIL",
  "RDV_COURTOISIE",
  "SAV",
  "AUTRE",
];
