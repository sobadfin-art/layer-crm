// Vérification côté client — confort uniquement (retour immédiat avant
// l'aller-retour réseau). La vraie validation, faisant foi, reste côté
// backend (lib/passwordPolicy.js) : "le frontend ne doit jamais être
// considéré comme une barrière de sécurité". On ne duplique ici que la règle
// de longueur minimale, la plus utile en feedback immédiat.
export function validatePasswordClientSide(password) {
  if (!password) return { ok: false, error: "Le mot de passe ne peut pas être vide." };
  if (password.length < 10) {
    return { ok: false, error: "Le mot de passe doit contenir au moins 10 caractères." };
  }
  return { ok: true };
}
