// Politique de mot de passe (chantier sécurité auth).
//
// Choix délibéré, sur demande explicite du client : pas de complexité imposée
// (majuscule + symbole + chiffre obligatoires) — cette approche pousse les gens
// vers des mots de passe faibles-mais-conformes ("Password1!") plutôt que vers
// de vraies phrases de passe longues, qui sont à la fois plus sûres et plus
// faciles à retenir. On se contente donc d'une longueur minimale généreuse et
// de quelques vérifications de bon sens.
const MIN_LENGTH = 10;

// Liste volontairement courte : on ne réimplémente pas un dictionnaire de mots
// de passe compromis ici (cf. consigne "pas de système maison complexe") —
// juste un filet de sécurité contre les cas les plus évidents.
const WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "azertyuiop",
  "qwertyuiop",
  "1234567890",
  "0123456789",
  "motdepasse",
  "motdepasse1",
  "moken1234", // mot de passe de démo — jamais accepté comme mot de passe "réel"
  "changeme",
  "changeit",
  "letmein123",
]);

// Retourne { ok: true } ou { ok: false, error: "message utilisateur" }.
export function validatePassword(password, email) {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Le mot de passe ne peut pas être vide." };
  }
  if (password.length < MIN_LENGTH) {
    return {
      ok: false,
      error: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`,
    };
  }
  if (email && password.toLowerCase() === String(email).toLowerCase()) {
    return { ok: false, error: "Le mot de passe ne peut pas être identique à l'adresse e-mail." };
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: "Ce mot de passe est trop simple, merci d'en choisir un autre." };
  }
  return { ok: true };
}
