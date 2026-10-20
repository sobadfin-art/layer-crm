// Brouillons de commande (point 8, 2026-10-20 — "un représentant qui quitte
// l'écran, fait un refresh ou reçoit un appel pendant la saisie perd tout") :
// sauvegarde PUREMENT LOCALE à l'appareil (localStorage), jamais envoyée au
// serveur. Un brouillon n'est donc jamais une vraie commande : il n'existe
// pas en base, n'apparaît ni dans l'export Dolibarr ni dans les statistiques.
//
// Clé propre à chaque utilisateur (`…:<userId>`) : sur un appareil partagé,
// un autre compte connecté ne voit jamais les brouillons du précédent.
//
// Plusieurs brouillons simultanés possibles (y compris pour un même compte
// client) : chaque session de saisie a son propre identifiant, pour qu'ouvrir
// une nouvelle commande n'écrase jamais un brouillon existant non repris.
const STORAGE_PREFIX = "moken_order_drafts_v1:";
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

function readAll(userId) {
  if (!userId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // localStorage indisponible (navigation privée, etc.) ou contenu illisible
    // — repli silencieux, l'écran de commande fonctionne comme avant.
    return {};
  }
}

function writeAll(userId, drafts) {
  if (!userId) return;
  try {
    if (Object.keys(drafts).length === 0) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify(drafts));
  } catch {
    // Quota plein / stockage bloqué : pas de brouillon, mais jamais d'erreur
    // bloquante pour la prise de commande elle-même.
  }
}

export function newDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Brouillons de l'utilisateur, du plus récent au plus ancien. Purge au
// passage ceux non modifiés depuis 14 jours (nettoyage automatique demandé
// "au prochain chargement de l'écran").
export function listDrafts(userId) {
  const drafts = readAll(userId);
  const now = Date.now();
  let purged = false;
  for (const [draftId, d] of Object.entries(drafts)) {
    if (!d || !d.accountId || !(now - (d.updatedAt || 0) < DRAFT_MAX_AGE_MS)) {
      delete drafts[draftId];
      purged = true;
    }
  }
  if (purged) writeAll(userId, drafts);
  return Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDraft(userId, draftId) {
  if (!draftId) return null;
  return readAll(userId)[draftId] || null;
}

export function saveDraft(userId, draft) {
  const drafts = readAll(userId);
  drafts[draft.draftId] = { ...draft, updatedAt: Date.now() };
  writeAll(userId, drafts);
}

export function deleteDraft(userId, draftId) {
  const drafts = readAll(userId);
  if (!drafts[draftId]) return;
  delete drafts[draftId];
  writeAll(userId, drafts);
}

export function draftLineCount(draft) {
  return (draft?.cart || []).reduce((s, [, entry]) => s + (Number(entry?.qty) || 0), 0);
}
