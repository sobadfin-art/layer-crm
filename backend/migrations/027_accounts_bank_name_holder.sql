-- Point 1 (2026-10-25) — fiche client : nom de l'agence bancaire et titulaire
-- du compte (obligatoire pour les prélèvements SEPA dès qu'un IBAN est
-- renseigné). Migration STRICTEMENT ADDITIVE : deux colonnes nullables, vides
-- sur toutes les fiches existantes — aucune ligne lue ni réécrite.
--
-- Contenu CHIFFRÉ au repos (AES-256-GCM, cf. backend/src/lib/bankData.js,
-- clé dans la variable d'environnement BANK_DATA_ENCRYPTION_KEY) : la base
-- ne contient jamais la valeur en clair. Le serveur ne la renvoie en clair
-- qu'aux rôles ADMINISTRATEUR, FRONT_DESK et DIRECTEUR.
ALTER TABLE accounts ADD COLUMN bank_name TEXT;
ALTER TABLE accounts ADD COLUMN account_holder TEXT;

COMMENT ON COLUMN accounts.bank_name IS
  'Nom de l''agence bancaire — CHIFFRÉ (format enc:v1:...), jamais en clair. Cf. lib/bankData.js.';
COMMENT ON COLUMN accounts.account_holder IS
  'Titulaire du compte (personne ou société), requis pour un IBAN saisi ou modifié — CHIFFRÉ (format enc:v1:...). Cf. lib/bankData.js.';
