// Cloisonnement des données par rôle — cf. etat-final-prototype-handoff.md section 3.
//
// Règle confirmée (2026-09-14, cf. docs/cahier-des-charges-import-fiches-client.md
// section 2) : ADMINISTRATEUR a accès en lecture/écriture complète aux fiches
// comptes, au même niveau que FRONT_DESK (toutes les fiches, pas de filtre par
// représentant), à l'exception explicite des commandes (module orders.js,
// jamais ouvert à ce rôle) et du pipeline commercial (bloqué explicitement sur
// la route PATCH /api/accounts/:id/pipeline malgré son accès au reste du module).
//
// Règle confirmée (définitive, plus une hypothèse) : seuls FRONT_DESK et DIRECTEUR
// peuvent réassigner ownerRep/masterRep sur un compte existant. Un Master Rep ne
// peut jamais réaffecter un compte client existant à un autre représentant — cette
// action lui est strictement interdite, quelle que soit son équipe.
//
// Règle confirmée par le client (plus une hypothèse) : un Master Rep peut créer un
// compte soit pour un représentant qu'il désigne parmi son équipe (owner_rep_id =
// ce rep, master_rep_id = lui), soit sans en désigner un, auquel cas il en devient
// lui-même propriétaire (owner_rep_id = lui, master_rep_id = null). Un compte créé
// par un Master Rep a donc toujours un owner_rep_id renseigné, jamais orphelin.
// Sa visibilité doit donc couvrir les deux cas : les comptes où il est master_rep_id
// (ceux de son équipe) ET ceux dont il est directement owner_rep_id (les siens).
import { ROLES } from "./roles.js";

// Retourne { where: "...", params: [...] } à injecter dans une requête sur `accounts`.
// `paramOffset` permet de placer ces paramètres après d'autres déjà utilisés dans la requête.
export function accountsScopeClause(user, paramOffset = 0) {
  if (user.role === ROLES.REPRESENTANT) {
    return { where: `owner_rep_id = $${paramOffset + 1}`, params: [user.id] };
  }
  if (user.role === ROLES.MASTER_REP) {
    return {
      where: `(master_rep_id = $${paramOffset + 1} OR owner_rep_id = $${paramOffset + 1})`,
      params: [user.id],
    };
  }
  // FRONT_DESK, DIRECTEUR, ADMINISTRATEUR : accès à tous les comptes, pas de filtre.
  return { where: "TRUE", params: [] };
}

export function canViewAllAccounts(role) {
  return role === ROLES.FRONT_DESK || role === ROLES.DIRECTEUR || role === ROLES.ADMINISTRATEUR;
}

export function canAccessAccountsModule(role) {
  return (
    role === ROLES.REPRESENTANT ||
    role === ROLES.MASTER_REP ||
    role === ROLES.FRONT_DESK ||
    role === ROLES.DIRECTEUR ||
    role === ROLES.ADMINISTRATEUR
  );
}

// Un compte donné (déjà chargé en DB) est-il visible par cet utilisateur ?
export function canAccessAccount(user, account) {
  if (canViewAllAccounts(user.role)) return true;
  if (user.role === ROLES.REPRESENTANT) return account.owner_rep_id === user.id;
  if (user.role === ROLES.MASTER_REP) {
    return account.master_rep_id === user.id || account.owner_rep_id === user.id;
  }
  return false;
}

// Front desk, directeur et administrateur peuvent réaffecter ownerRep/masterRep
// (cf. commentaire en tête de fichier — accès administrateur au même niveau que
// front desk sur la fiche elle-même).
export function canReassignAccount(role) {
  return role === ROLES.FRONT_DESK || role === ROLES.DIRECTEUR || role === ROLES.ADMINISTRATEUR;
}

// Statut du compte (section confirmée) : ACTIF <-> INACTIF est une bascule
// opérationnelle courante, ouverte à tout rôle ayant accès au compte (comme le
// pipeline). L'archivage (INACTIF -> ARCHIVE) est une action administrative
// terminale, réservée à front desk/directeur — hypothèse par cohérence avec le
// reste des actions de cycle de vie du compte, à confirmer si besoin.
export function canArchiveAccount(role) {
  return role === ROLES.FRONT_DESK || role === ROLES.DIRECTEUR || role === ROLES.ADMINISTRATEUR;
}
