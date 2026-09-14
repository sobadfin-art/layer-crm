// Crée un utilisateur de démo par rôle (mot de passe : "moken1234" pour tous).
//
// NE JAMAIS UTILISER LES COMPTES SEED EN PRODUCTION. Ce script reste
// uniquement destiné au développement / à la démonstration — la création des
// comptes de production passe exclusivement par la procédure de bootstrap du
// premier DIRECTEUR (scripts/bootstrap-directeur.js) puis par les écrans
// d'administration des utilisateurs (routes/admin-users.js, routes/team.js).
//
// Garde-fou : ce script refuse de s'exécuter si NODE_ENV=production, sauf à
// passer explicitement ALLOW_SEED=true — protection volontaire contre un
// lancement accidentel de `npm run seed` sur une base de production, qui
// injecterait des comptes à mot de passe connu et public (documenté dans le
// README, cf. section "Ne jamais utiliser les comptes seed en production.").
import bcrypt from "bcrypt";
import "dotenv/config";
import { pool, query } from "../lib/db.js";
import { ROLES } from "../lib/roles.js";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  console.error(
    "✗ Refus de lancer seed.js : NODE_ENV=production. Les comptes de démonstration ne " +
      "doivent jamais être créés en production (mot de passe identique et connu pour tous). " +
      "Si vous savez vraiment ce que vous faites (ex: environnement de recette dédié), relancez " +
      "avec ALLOW_SEED=true."
  );
  process.exit(1);
}

const DEMO_PASSWORD = "moken1234";

const DEMO_USERS = [
  { email: "rep@moken.demo", firstName: "Alex", lastName: "Rep", role: ROLES.REPRESENTANT },
  { email: "rep2@moken.demo", firstName: "Jo", lastName: "Rep2", role: ROLES.REPRESENTANT },
  { email: "masterrep@moken.demo", firstName: "Sam", lastName: "MasterRep", role: ROLES.MASTER_REP },
  { email: "frontdesk@moken.demo", firstName: "Camille", lastName: "FrontDesk", role: ROLES.FRONT_DESK },
  { email: "directeur@moken.demo", firstName: "Dominique", lastName: "Directeur", role: ROLES.DIRECTEUR },
  { email: "admin@moken.demo", firstName: "Robin", lastName: "Admin", role: ROLES.ADMINISTRATEUR },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const ids = {};

  for (const u of DEMO_USERS) {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [u.email, passwordHash, u.firstName, u.lastName, u.role]
    );
    ids[u.email] = rows[0].id;
    console.log(`✓ ${u.role.padEnd(15)} ${u.email}`);
  }

  // rep@moken.demo est affecté à masterrep@moken.demo ; rep2@moken.demo reste
  // sans master rep, pour vérifier l'isolation entre représentants (Lot 2).
  const { rows: mrRows } = await query(
    `INSERT INTO master_reps (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id`,
    [ids["masterrep@moken.demo"]]
  );
  const masterRepRowId = mrRows[0].id;

  await query(
    `INSERT INTO sales_reps (user_id, master_rep_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET master_rep_id = EXCLUDED.master_rep_id`,
    [ids["rep@moken.demo"], masterRepRowId]
  );
  await query(
    `INSERT INTO sales_reps (user_id, master_rep_id) VALUES ($1, NULL)
     ON CONFLICT (user_id) DO NOTHING`,
    [ids["rep2@moken.demo"]]
  );

  console.log(`\nMot de passe pour tous les comptes de démo : ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
