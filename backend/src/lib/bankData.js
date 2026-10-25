// Point 1 (2026-10-25) — coordonnées bancaires d'une fiche client.
//
// 1. Chiffrement au repos des nouveaux champs `bank_name` (agence) et
//    `account_holder` (titulaire) : AES-256-GCM, clé dérivée (SHA-256) de la
//    variable d'environnement BANK_DATA_ENCRYPTION_KEY. Valeur stockée :
//    "enc:v1:" + base64(iv[12] | tag[16] | texte chiffré). Sans clé
//    configurée, aucune nouvelle valeur n'est jamais écrite en clair : la
//    saisie est refusée (BankKeyMissingError) et la lecture renvoie null.
//    IBAN et BIC existants restent tels qu'ils sont en base (décision client :
//    pas de réécriture des données existantes).
//
// 2. Masquage par rôle : IBAN, BIC, agence et titulaire ne sont renvoyés en
//    clair qu'aux rôles BANK_ROLES. Représentant et Master Rep peuvent les
//    SAISIR, mais ne reçoivent ensuite qu'un indicateur "renseigné"
//    (hasIban, hasBic, hasBankName, hasAccountHolder) — jamais la valeur.
import crypto from "node:crypto";
import { ROLES } from "./roles.js";

export const BANK_ROLES = [ROLES.ADMINISTRATEUR, ROLES.FRONT_DESK, ROLES.DIRECTEUR];
export const ENCRYPTED_BANK_FIELDS = ["bank_name", "account_holder"];
const PREFIX = "enc:v1:";

export class BankKeyMissingError extends Error {
  constructor() {
    super(
      "Clé de chiffrement des coordonnées bancaires non configurée (BANK_DATA_ENCRYPTION_KEY) : le nom d'agence et le titulaire ne peuvent pas être enregistrés."
    );
    this.code = "BANK_KEY_MISSING";
  }
}

function key() {
  const secret = process.env.BANK_DATA_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

export function canSeeBankData(role) {
  return BANK_ROLES.includes(role);
}

export function encryptBankValue(plain) {
  if (plain === null || plain === undefined || plain === "") return null;
  const k = key();
  if (!k) throw new BankKeyMissingError();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

// null si vide, si la clé manque ou si le contenu est illisible (clé
// différente, valeur altérée) — jamais d'exception à la lecture : une fiche
// doit toujours rester consultable.
export function decryptBankValue(stored) {
  if (!stored) return null;
  if (!String(stored).startsWith(PREFIX)) return null;
  const k = key();
  if (!k) return null;
  try {
    const raw = Buffer.from(String(stored).slice(PREFIX.length), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const filled = (v) => v !== null && v !== undefined && String(v).trim() !== "";

// "Titulaire à compléter" : IBAN présent sans titulaire. Les fiches
// existantes concernées ne sont jamais bloquées, seulement signalées.
export function holderMissing(row) {
  return filled(row.iban) && !filled(row.account_holder);
}

// Ligne SQL `accounts` -> ligne sûre pour la réponse API, selon le rôle.
// À appliquer à TOUTE réponse contenant une fiche client.
export function presentAccountRow(row, role) {
  if (!row) return row;
  const out = { ...row };
  const flags = {
    has_iban: filled(row.iban),
    has_bic: filled(row.bic),
    has_bank_name: filled(row.bank_name),
    has_account_holder: filled(row.account_holder),
  };
  if (canSeeBankData(role)) {
    out.bank_name = decryptBankValue(row.bank_name);
    out.account_holder = decryptBankValue(row.account_holder);
    out.bank_data_unreadable =
      (flags.has_bank_name && out.bank_name === null) || (flags.has_account_holder && out.account_holder === null);
    out.holder_missing = holderMissing(row);
  } else {
    out.iban = null;
    out.bic = null;
    out.bank_name = null;
    out.account_holder = null;
    out.bank_data_masked = true;
  }
  return { ...out, ...flags };
}
