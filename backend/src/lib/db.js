import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// SSL : jamais nécessaire pour un Postgres local en développement (pas de
// certificat configuré) ; activé, avec un certificat auto-signé toléré, dès
// que le code tourne sur Render (cf. déploiement, `render.yaml`) — évite une
// erreur de connexion "no encryption"/"self signed certificate" selon la
// configuration exacte de l'hébergeur, sans rien changer en local.
// Détection volontairement basée sur `RENDER` (variable posée par Render
// lui-même, disponible au build ET au runtime) plutôt que sur `NODE_ENV` :
// Render ne fixe `NODE_ENV=production` qu'au démarrage du service, jamais
// pendant le build — or c'est justement pendant le build que tournent les
// migrations/le seed (`render.yaml`, formule gratuite sans pre-deploy
// command), qui ont donc besoin du SSL dès cette étape.
const onRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: onRender ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}
