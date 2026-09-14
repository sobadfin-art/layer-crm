import { query } from "./db.js";

// Charge les règles commerciales actives avec leurs représentants ciblés
// (scope REPRESENTANT) agrégés en repIds — un seul endroit pour cette
// jointure (migration 013), utilisé à la fois par le calcul de commande
// (routes/orders.js -> lib/pricing.js) et par l'API de lecture
// (routes/business-rules.js), pour ne jamais les faire diverger.
//
// json_agg (plutôt qu'array_agg) est utilisé ici parce que node-postgres
// parse json/jsonb de façon fiable en tableau JS, alors qu'array_agg sur un
// type custom (comme product_category[] pour `categories`) revient en texte
// brut non parsé côté driver (ex: "{PREMIUM,CLASSIC}" plutôt que
// ["PREMIUM","CLASSIC"]) — jusqu'ici sans conséquence visible car
// lib/pricing.js ne fait qu'un `.includes(category)` dessus (un match par
// sous-chaîne fonctionne par coïncidence puisqu'aucune valeur de l'enum
// product_category n'est sous-chaîne d'une autre), mais ça casse tout code
// qui a besoin d'un vrai tableau (ex: `.join()`, `.length`, `.map()` côté
// écran Config du directeur, routes/business-rules.js). Corrigé ici une fois
// pour toutes via `to_jsonb(br.categories)`, qui écrase la colonne brute avec
// une version correctement parsée en tableau JS — pricing.js n'est pas cassé
// par ce changement (un `.includes()` exact sur un vrai tableau est même plus
// correct qu'un match par sous-chaîne).
export async function loadActiveBusinessRules() {
  const { rows } = await query(
    `SELECT br.*, to_jsonb(br.categories) AS categories,
            COALESCE(
              (SELECT json_agg(brr.rep_id) FROM business_rule_reps brr WHERE brr.business_rule_id = br.id),
              '[]'::json
            ) AS rep_ids
     FROM business_rules br
     WHERE br.active = TRUE
     ORDER BY br.created_at DESC`
  );
  return rows;
}

// Variante "toutes les règles" (actives ET inactives) — nécessaire à l'écran
// Config du directeur : les règles ne sont JAMAIS supprimées, seulement
// désactivées (cf. conventions du projet, "jamais de suppression"), donc
// l'écran qui les gère doit pouvoir les lister toutes pour permettre une
// réactivation, pas seulement les actives (celles utilisées par le calcul de
// commande, loadActiveBusinessRules ci-dessus, inchangée). Réservé au
// directeur côté route (cf. business-rules.js), jamais utilisée par le calcul
// de prix.
export async function loadAllBusinessRules() {
  const { rows } = await query(
    `SELECT br.*, to_jsonb(br.categories) AS categories,
            COALESCE(
              (SELECT json_agg(brr.rep_id) FROM business_rule_reps brr WHERE brr.business_rule_id = br.id),
              '[]'::json
            ) AS rep_ids
     FROM business_rules br
     ORDER BY br.active DESC, br.created_at DESC`
  );
  return rows;
}
