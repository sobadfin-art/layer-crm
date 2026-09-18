import nodemailer from "nodemailer";
import "dotenv/config";

// Envoi d'emails transactionnels — mécanisme générique (SMTP via nodemailer),
// suit le même principe que lib/objectStorage.js : variables d'environnement
// requises jamais en dur dans le code, détection de configuration manquante
// exposée aux appelants (isMailerConfigured/missingMailerEnvVars) plutôt
// qu'une erreur SDK peu lisible au premier envoi, et un comportement
// "non-bloquant" laissé au choix de l'appelant (cf. sendFrontOfficeOrderAlert
// plus bas, qui journalise un avertissement et abandonne silencieusement
// plutôt que de faire échouer l'action métier qui déclenche l'email).
//
// Variables d'environnement requises pour le transport SMTP :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
const REQUIRED_ENV_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

export function isMailerConfigured() {
  return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
}

export function missingMailerEnvVars() {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    // Port 465 = SMTPS implicite ; tout autre port (587, 25...) démarre en
    // clair puis passe en STARTTLS — convention nodemailer standard.
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transport;
}

export async function sendMail({ to, subject, text }) {
  if (!isMailerConfigured()) {
    throw new Error(`Envoi d'email non configuré — variables manquantes : ${missingMailerEnvVars().join(", ")}`);
  }
  const transport = getTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });
}

// ---------------------------------------------------------------------------
// Alerte "commande envoyée au front office" — fiche "UPDATE CRM — CORRECTIONS
// À IMPLÉMENTER", évolution 4. Déclenchée uniquement par l'événement métier
// réel (POST /api/orders/:id/send-to-front-desk réussi, cf. orders.js) —
// jamais à la création d'un brouillon, jamais à l'ouverture d'une commande,
// jamais si l'envoi échoue.
//
// Destinataire volontairement CONFIGURABLE, jamais en dur : variable d'env
// FRONT_OFFICE_ORDER_ALERT_EMAIL (valeur attendue en production, à définir
// par l'utilisateur dans Render — jamais committée dans le dépôt).
//
// Idempotence : orders.js appelle cette fonction seulement APRÈS avoir fait
// passer la commande de BROUILLON à ENVOYEE_FRONT_DESK ; toute tentative
// ultérieure (double-clic, retry technique) échoue déjà plus haut avec 409
// "Commande déjà au statut ENVOYEE_FRONT_DESK" avant même d'atteindre cet
// appel — l'architecture existante garantit donc à elle seule qu'un seul
// email est envoyé par commande, sans mécanisme supplémentaire à construire.
//
// Non-bloquant par conception : un problème d'envoi (SMTP non configuré,
// panne du serveur mail...) ne doit jamais faire échouer l'envoi au front
// desk lui-même, déjà confirmé en base à ce stade — seulement journalisé.
export async function sendFrontOfficeOrderAlert({ order, account, repUser }) {
  const recipient = process.env.FRONT_OFFICE_ORDER_ALERT_EMAIL;
  if (!recipient) {
    console.warn(
      "[mailer] FRONT_OFFICE_ORDER_ALERT_EMAIL non configurée — alerte commande non envoyée."
    );
    return;
  }
  if (!isMailerConfigured()) {
    console.warn(
      `[mailer] Envoi d'email non configuré (${missingMailerEnvVars().join(", ")}) — alerte commande non envoyée.`
    );
    return;
  }

  // Aucun numéro de commande lisible n'existe dans le modèle actuel (seul un
  // UUID orders.id) — conformément à la consigne "ne jamais inventer de
  // donnée", on utilise cet identifiant tel quel comme référence plutôt que
  // de fabriquer un numéro séquentiel qui n'existerait nulle part ailleurs.
  const repName = repUser ? `${repUser.first_name || ""} ${repUser.last_name || ""}`.trim() : null;
  const deliveryDate = order.desired_delivery_date
    ? new Date(order.desired_delivery_date).toLocaleDateString("fr-FR")
    : "Non renseignée";
  const sentAt = new Date(order.updated_at || Date.now()).toLocaleString("fr-FR");

  const lines = [
    `Référence commande : ${order.id}`,
    `Client : ${account?.name || "Inconnu"}`,
    `Représentant : ${repName || "Inconnu"}`,
    `Date de livraison souhaitée : ${deliveryDate}`,
    `Envoyée au front office le : ${sentAt}`,
  ];

  try {
    await sendMail({
      to: recipient,
      subject: "Nouvelle commande envoyée vers le front office.",
      text: lines.join("\n"),
    });
  } catch (err) {
    console.warn("[mailer] Échec de l'envoi de l'alerte commande front office :", err.message);
  }
}
