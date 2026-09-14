// Portée des données de pilotage par rôle — section 3 handoff :
// Représentant -> "Data (Bestsellers + Customer Performance)" sur ses propres
// comptes/commandes ; Directeur -> "accès complet à Data (Bestsellers/
// Analytics/Extraction)". Le Master Rep n'est pas mentionné explicitement pour
// Data, mais logiquement il doit au moins voir ce que voient ses reps affectés
// (hypothèse, à confirmer). Front desk et Administrateur sont hors périmètre
// documenté pour Data.
import { ROLES } from "./roles.js";
import { getManagedRepUserIds } from "./managedReps.js";

// Retourne la liste des rep_id à inclure dans une requête de reporting, ou
// `null` si aucun filtre ne doit être appliqué (accès total, directeur).
export async function repScopeForDashboard(user) {
  if (user.role === ROLES.DIRECTEUR) return null;
  if (user.role === ROLES.REPRESENTANT) return [user.id];
  if (user.role === ROLES.MASTER_REP) {
    const managed = await getManagedRepUserIds(user.id);
    return [user.id, ...managed];
  }
  return []; // rôle non autorisé — le routeur bloque déjà via requireRole
}
