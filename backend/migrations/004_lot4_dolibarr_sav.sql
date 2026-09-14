-- Lot 4 — Front desk et export Dolibarr.
-- cf. cahier-des-charges-export-dolibarr.md : plusieurs identifiants Dolibarr réels
-- (fk_user, code_client, fk_tva, fk_cond_reglement, fk_mode_reglement...) ne sont
-- PAS connus au moment de ce Lot — ce schéma les rend configurables plutôt que codés
-- en dur, pour que vous puissiez les renseigner dès que votre administrateur
-- Dolibarr vous les aura communiqués (section "Ce que je peux faire dès que j'ai ces
-- réponses" du cahier des charges).

ALTER TABLE users ADD COLUMN dolibarr_user_id TEXT;
ALTER TABLE accounts ADD COLUMN dolibarr_code_client TEXT;

-- Table singleton : une seule ligne 'default'. Gérée par le front desk/directeur
-- (rôles qui opèrent l'export au quotidien), à distinguer de business_rules qui
-- porte les règles commerciales (remises, frais de port).
CREATE TABLE dolibarr_settings (
  id                      TEXT PRIMARY KEY DEFAULT 'default',
  product_match_field     TEXT NOT NULL DEFAULT 'ref',            -- 'ref' | 'rowid' (section 2)
  account_match_field     TEXT NOT NULL DEFAULT 'code_client',    -- 'code_client' | 'siret_vat' | 'name' (section 3)
  gift_line_strategy      TEXT NOT NULL DEFAULT 'FULL_DISCOUNT',  -- 'ZERO_PRICE' | 'FULL_DISCOUNT' (section 5)
  default_order_status    TEXT NOT NULL DEFAULT 'BROUILLON',      -- statut Dolibarr à l'import (section 4)
  default_warehouse_id    TEXT,                                   -- fk_entrepot (section 2)
  default_vat_rate_id     TEXT,                                   -- fk_tva (section 5) — PAS un pourcentage, un ID Dolibarr
  default_payment_term_id TEXT,                                   -- fk_cond_reglement (section 6)
  default_payment_mode_id TEXT,                                   -- fk_mode_reglement (section 6)
  csv_delimiter           TEXT NOT NULL DEFAULT ';',
  csv_encoding            TEXT NOT NULL DEFAULT 'UTF-8',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO dolibarr_settings (id) VALUES ('default');

CREATE TABLE sav_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES accounts(id),
  order_id       UUID REFERENCES orders(id),
  subject        TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'OUVERT', -- OUVERT | EN_COURS | RESOLU | FERME
  created_by_id  UUID NOT NULL REFERENCES users(id),
  assigned_to_id UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX idx_sav_tickets_account ON sav_tickets(account_id);
CREATE INDEX idx_sav_tickets_status ON sav_tickets(status);

CREATE TABLE sav_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES sav_tickets(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  note       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
