import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validatePassword } from "../lib/passwordPolicy.js";
import { logAudit } from "../lib/audit.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000,
};

// Limitation du débit sur le login : solution standard (express-rate-limit)
// plutôt qu'un système maison — consigne explicite. Fenêtre glissante de 15
// minutes, 10 tentatives par IP, message générique (ne confirme ni n'infirme
// l'existence de l'email), et on ne compte que les échecs (skipSuccessfulRequests)
// pour ne jamais bloquer un utilisateur légitime qui vient de réussir.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Trop de tentatives. Merci de réessayer plus tard." },
});

// Même logique pour la demande de réinitialisation de mot de passe — fenêtre
// plus large mais toujours bornée, pour éviter qu'on énumère les emails valides
// ou qu'on spamme de jetons de réinitialisation.
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes. Merci de réessayer plus tard." },
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email ou mot de passe invalide." });
  }
  const { email, password } = parsed.data;

  const { rows } = await query(
    `SELECT id, email, password_hash, first_name, last_name, role, active, must_change_password
     FROM users WHERE email = $1`,
    [email]
  );
  const user = rows[0];

  // Message volontairement générique pour ne pas révéler si l'email existe.
  const invalidCreds = () => res.status(401).json({ error: "Identifiants incorrects." });

  if (!user || !user.active) return invalidCreds();

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return invalidCreds();

  const token = signToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  // Le token n'est plus renvoyé dans le corps JSON (cf. migration "cookie only" :
  // on ne duplique plus le JWT entre cookie httpOnly et localStorage). Le
  // frontend web s'appuie désormais exclusivement sur le cookie httpOnly,
  // envoyé automatiquement par le navigateur sur chaque requête (credentials:
  // "include") ainsi que sur la connexion websocket. Le header
  // "Authorization: Bearer ..." reste accepté côté API pour la flexibilité
  // (tests, futurs clients non-navigateur) mais n'est plus utilisé par le web.
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
  });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, first_name, last_name, role, active, must_change_password FROM users WHERE id = $1`,
    [req.user.id]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    active: user.active,
    mustChangePassword: user.must_change_password,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

// Changement de mot de passe par l'utilisateur lui-même (connecté). Utilisé à
// la fois pour un changement volontaire et pour le changement forcé de
// première connexion (must_change_password) — dans les deux cas le mot de
// passe courant doit être fourni et vérifié.
authRouter.patch("/password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const { currentPassword, newPassword } = parsed.data;

  const { rows } = await query(`SELECT id, email, password_hash FROM users WHERE id = $1`, [
    req.user.id,
  ]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Mot de passe actuel incorrect." });

  const check = validatePassword(newPassword, user.email);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const newHash = await bcrypt.hash(newPassword, 10);
  await query(
    `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2`,
    [newHash, user.id]
  );
  await logAudit({ userId: req.user.id, action: "PASSWORD_CHANGED", entity: "users", entityId: user.id });

  res.json({ ok: true });
});

const resetRequestSchema = z.object({ email: z.string().email() });

// Étape 1 du "mot de passe oublié" : génère un jeton court, à usage unique, et
// ne stocke que son hash en base (comme un mot de passe). Réponse volontairement
// identique que l'email existe ou non, pour ne jamais révéler l'existence d'un
// compte.
//
// IMPORTANT — limitation assumée et documentée (README) : il n'existe à ce jour
// aucun système d'envoi d'email dans le projet. On construit ici la structure
// backend complète (jeton, expiration, usage unique) sans fabriquer un faux
// mécanisme d'envoi. En développement, le jeton est journalisé côté serveur
// (console) pour permettre de tester le flux de bout en bout ; en production,
// ce log doit être retiré et remplacé par un vrai envoi d'email (SMTP/API
// transactionnelle) — c'est la seule pièce qui reste à brancher.
authRouter.post("/password-reset/request", passwordResetRateLimit, async (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email invalide." });
  const { email } = parsed.data;

  const generic = () =>
    res.json({ ok: true, message: "Si ce compte existe, un lien de réinitialisation a été généré." });

  const { rows } = await query(`SELECT id, active FROM users WHERE email = $1`, [email]);
  const user = rows[0];
  if (!user || !user.active) return generic();

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );
  await logAudit({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", entity: "users", entityId: user.id });

  // Pas de vrai envoi d'email disponible dans ce projet (cf. commentaire ci-dessus) :
  // on journalise le jeton en développement uniquement, pour pouvoir tester.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[password-reset] Jeton brut pour ${email} (dev uniquement) : ${rawToken}`);
  }

  return generic();
});

const resetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

authRouter.post("/password-reset/confirm", passwordResetRateLimit, async (req, res) => {
  const parsed = resetConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide." });
  const { token, newPassword } = parsed.data;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await query(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
     FROM password_reset_tokens prt JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1`,
    [tokenHash]
  );
  const record = rows[0];
  const invalidToken = () => res.status(400).json({ error: "Jeton invalide ou expiré." });

  if (!record) return invalidToken();
  if (record.used_at) return invalidToken();
  if (new Date(record.expires_at) < new Date()) return invalidToken();

  const check = validatePassword(newPassword, record.email);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const newHash = await bcrypt.hash(newPassword, 10);
  await query(
    `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2`,
    [newHash, record.user_id]
  );
  await query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [record.id]);
  await logAudit({
    userId: record.user_id,
    action: "PASSWORD_RESET_CONFIRMED",
    entity: "users",
    entityId: record.user_id,
  });

  res.json({ ok: true });
});
