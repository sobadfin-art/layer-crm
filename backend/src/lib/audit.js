// Journal d'audit / historique des modifications (Lot 6).
//
// La table audit_logs existe depuis le tout début (migration 001) mais n'était
// utilisée que ponctuellement (envoi front desk, export Dolibarr, confirmation
// de livraison — cf. src/routes/orders.js et src/routes/dolibarr.js). Ce
// module centralise l'écriture pour pouvoir la brancher facilement sur
// davantage d'actions métier, avec une convention de nommage cohérente :
//   action = "<ENTITE>_<VERBE>" en MAJUSCULES (ex: ACCOUNT_CREATED, ACCOUNT_STATUS_CHANGED)
//   entity = nom de table au singulier ou pluriel selon l'existant (on garde
//            la convention déjà en place : "orders", pas "order")
//
// Ne jette jamais d'exception qui casserait la requête métier en cours : un
// souci d'écriture d'audit ne doit pas empêcher l'action réelle de réussir
// (le try/catch est volontaire — cf. règle générale du projet : ne jamais
// laisser une fonctionnalité annexe bloquer le flux principal).
import { query } from "./db.js";

export async function logAudit({ userId, action, entity, entityId, details }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId ?? null, action, entity, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // On log en console pour ne rien perdre silencieusement, mais on ne
    // propage pas : l'audit est un journal, pas une contrainte transactionnelle.
    console.error("Échec d'écriture audit_logs (non bloquant) :", err.message);
  }
}
