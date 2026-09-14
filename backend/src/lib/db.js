import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// SSL : jamais nécessaire pour un Postgres local en développement (pas de
// certificat configuré) ; activé, avec un certificat auto-signé toléré, dès
// que NODE_ENV=production (cf. déploiement Render, `render.yaml`) — évite
// une erreur de connexion "no encryption"/"self signed certificate" selon
// la configuration exacte de l'hébergeur, sans rien changer en local.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}
