import { query } from "./db.js";

// Représentants affectés à un Master Rep donné (par son user_id).
export async function getManagedRepUserIds(masterRepUserId) {
  const { rows } = await query(
    `SELECT sr.user_id
     FROM sales_reps sr
     JOIN master_reps mr ON sr.master_rep_id = mr.id
     WHERE mr.user_id = $1`,
    [masterRepUserId]
  );
  return rows.map((r) => r.user_id);
}
