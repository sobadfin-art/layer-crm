import jwt from "jsonwebtoken";
import { query } from "../lib/db.js";

// Vérifie le JWT (cookie httpOnly "token" ou header "Authorization: Bearer ...")
// PUIS revérifie en base que l'utilisateur existe toujours et est actif.
//
// Pourquoi la revérification en base à chaque requête (et pas seulement au
// moment du login) : un JWT signé reste valide jusqu'à son expiration (8h par
// défaut) même si le compte est désactivé entre-temps par un DIRECTEUR. Sans
// cette vérification, un utilisateur désactivé garderait un accès complet
// jusqu'à expiration de son token. On accepte le coût d'une requête SQL
// supplémentaire par appel authentifié pour que la désactivation soit
// immédiate — cohérent avec le reste du projet qui n'a pas de cache applicatif.
//
// On lit aussi must_change_password ici : si vrai, on bloque toutes les
// routes protégées SAUF celles sous /api/auth/* (qui incluent justement
// /api/auth/me, /api/auth/password et /api/auth/logout — nécessaires pour que
// l'utilisateur puisse changer son mot de passe puis se déconnecter). Ceci est
// appliqué côté serveur et non seulement côté frontend : "le frontend ne doit
// jamais être considéré comme une barrière de sécurité" (consigne explicite).
export async function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Authentification requise." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }

  const { rows } = await query(
    `SELECT id, email, role, active, must_change_password FROM users WHERE id = $1`,
    [payload.sub]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
  if (!user.active) {
    return res.status(403).json({ error: "Ce compte a été désactivé.", code: "ACCOUNT_DEACTIVATED" });
  }

  req.user = {
    id: user.id,
    role: user.role,
    email: user.email,
    mustChangePassword: user.must_change_password,
  };

  if (user.must_change_password && !req.originalUrl.startsWith("/api/auth/")) {
    return res.status(403).json({
      error: "Vous devez changer votre mot de passe avant de continuer.",
      code: "MUST_CHANGE_PASSWORD",
    });
  }

  next();
}

// Cloisonnement par rôle — usage: requireRole("DIRECTEUR", "ADMINISTRATEUR")
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentification requise." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé pour ce rôle." });
    }
    next();
  };
}
