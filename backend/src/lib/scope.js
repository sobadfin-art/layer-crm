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
import { query } from "./db.js";

// Sous-requête vivante : équipe ACTUELLE d'un Master Rep (par son user_id),
// jamais le champ dénormalisé accounts.master_rep_id — cf. correctif ci-dessous.
const MANAGED_REPS_SUBQUERY = `
  SELECT sr.user_id FROM sales_reps sr
  JOIN master_reps mr ON sr.master_rep_id = mr.id
  WHERE mr.user_id = $PLACEHOLDER
`;

// Retourne { where: "...", params: [...] } à injecter dans une requête sur `accounts`.
// `paramOffset` permet de placer ces paramètres après d'autres déjà utilisés dans la requête.
//
// Correctif (fiche corrective Master Rep V4, section "Clients & prospects" :
// "comptes de l'équipe pas correctement affichés") : le scope Master Rep
// s'appuyait sur accounts.master_rep_id, un champ dénormalisé qui (1) n'est
// JAMAIS renseigné quand un représentant crée lui-même son compte (branche
// REPRESENTANT de POST /accounts, cf. routes/accounts.js — seul owner_rep_id
// y est positionné) et (2) n'est jamais mis à jour rétroactivement quand un
// représentant change de Master Rep (PATCH /team/members/:userId ne touche
// que sales_reps.master_rep_id, jamais les comptes déjà créés). Résultat : la
// quasi-totalité des comptes créés par les représentants eux-mêmes — le cas
// normal — restaient invisibles pour leur Master Rep. Le scope repose donc
// maintenant sur une jointure vivante contre sales_reps/master_reps (l'équipe
// RÉELLE au moment de la requête), jamais sur la colonne dénormalisée.
export function accountsScopeClause(user, paramOffset = 0) {
  if (user.role === ROLES.REPRESENTANT) {
    return { where: `owner_rep_id = $${paramOffset + 1}`, params: [user.id] };
  }
  if (user.role === ROLES.MASTER_REP) {
    const p = paramOffset + 1;
    return {
      where: `(owner_rep_id = $${p} OR owner_rep_id IN (${MANAGED_REPS_SUBQUERY.replace("$PLACEHOLDER", `$${p}`)}))`,
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
// Async depuis le correctif Master Rep V4 (cf. accountsScopeClause
// ci-dessus) : le cas MASTER_REP doit vérifier l'équipe RÉELLE actuelle
// (sales_reps/master_reps), jamais le champ dénormalisé
// account.master_rep_id, pour rester cohérent avec les listes.
export async function canAccessAccount(user, account) {
  if (canViewAllAccounts(user.role)) return true;
  if (user.role === ROLES.REPRESENTANT) return account.owner_rep_id === user.id;
  if (user.role === ROLES.MASTER_REP) {
    if (account.owner_rep_id === user.id) return true;
    const { rows } = await query(MANAGED_REPS_SUBQUERY.replace("$PLACEHOLDER", "$1"), [user.id]);
    return rows.some((r) => r.user_id === account.owner_rep_id);
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
