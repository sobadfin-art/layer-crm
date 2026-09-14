// Procédure de création du tout premier compte DIRECTEUR.
//
// Pourquoi un script CLI et pas une route HTTP :
//   - "jamais exposé publiquement après le premier usage" est garanti par
//     construction si ce n'est jamais une route HTTP — pas de risque d'oubli
//     de désactivation d'un endpoint après usage, pas de surface d'attaque
//     réseau du tout.
//   - Il ne peut être exécuté que par quelqu'un ayant déjà un accès shell au
//     serveur (donc déjà un niveau de confiance élevé), ce qui correspond à
//     l'usage réel : le tout premier DIRECTEUR est créé une fois, au moment du
//     déploiement, par l'équipe technique.
//
// Se refuse à s'exécuter si un DIRECTEUR actif existe déjà (protection contre
// une deuxième exécution accidentelle). Pour créer un DIRECTEUR supplémentaire
// après le tout premier, voir la procédure documentée dans le README
// (§ Authentification et gestion des utilisateurs) : un DIRECTEUR existant
// utilise la route dédiée de changement de rôle (jamais ce script).
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcrypt";
import { pool, query } from "../lib/db.js";
import { ROLES } from "../lib/roles.js";
import { validatePassword } from "../lib/passwordPolicy.js";
import { logAudit } from "../lib/audit.js";

async function main() {
  const { rows: existing } = await query(
    `SELECT id FROM users WHERE role = 'DIRECTEUR' AND active = TRUE LIMIT 1`
  );
  if (existing.length > 0) {
    console.error(
      "✗ Un compte DIRECTEUR actif existe déjà. Ce script ne peut être exécuté qu'une seule " +
        "fois, pour créer le tout premier DIRECTEUR. Pour créer un DIRECTEUR supplémentaire, " +
        "voir la procédure dans le README (un DIRECTEUR existant utilise la route dédiée de " +
        "changement de rôle)."
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log("=== Création du premier compte DIRECTEUR ===\n");
    const firstName = (await rl.question("Prénom : ")).trim();
    const lastName = (await rl.question("Nom : ")).trim();
    const email = (await rl.question("Email : ")).trim().toLowerCase();

    if (!firstName || !lastName) {
      console.error("✗ Prénom et nom sont obligatoires.");
      process.exit(1);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("✗ Email invalide.");
      process.exit(1);
    }

    // Mot de passe saisi manuellement — jamais généré/imposé par le script,
    // pour ne jamais créer "automatiquement un compte avec des identifiants
    // connus" (consigne explicite).
    let password = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      password = await rl.question("Mot de passe (min. 10 caractères) : ");
      const check = validatePassword(password, email);
      if (check.ok) break;
      console.error(`✗ ${check.error}`);
      password = "";
    }
    if (!password) {
      console.error("✗ Trop de tentatives, abandon.");
      process.exit(1);
    }
    const confirm = await rl.question("Confirmer le mot de passe : ");
    if (confirm !== password) {
      console.error("✗ Les deux saisies ne correspondent pas, abandon.");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)
       RETURNING id, email`,
      [email, passwordHash, firstName, lastName, ROLES.DIRECTEUR]
    );
    const created = rows[0];
    await logAudit({
      userId: created.id,
      action: "DIRECTEUR_BOOTSTRAPPED",
      entity: "users",
      entityId: created.id,
      details: { via: "bootstrap-directeur.js" },
    });

    console.log(`\n✓ Compte DIRECTEUR créé : ${created.email}`);
    console.log("  Vous pouvez maintenant vous connecter sur l'application avec cet e-mail et ce mot de passe.");
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
