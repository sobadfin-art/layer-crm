// Runner de migrations SQL simple (pas d'ORM — voir README backend pour le choix).
// Applique dans l'ordre chaque fichier .sql de /migrations non encore appliqué,
// et garde la trace dans la table schema_migrations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../lib/db.js";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../migrations");

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ranAny = false;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`→ Applying migration ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`  ✓ ${file} applied`);
        ranAny = true;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ ${file} failed:`, err.message);
        throw err;
      }
    }

    if (!ranAny) console.log("Aucune nouvelle migration à appliquer.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
