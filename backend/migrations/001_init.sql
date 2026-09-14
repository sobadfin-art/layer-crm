-- Moken CRM — Lot 1 (fondations)
-- Basé sur : etat-final-prototype-handoff.md, cahier-des-charges-import-catalogue.md,
-- cahier-des-charges-export-dolibarr.md, et la logique du prototype JSX.
-- Ce schéma sera affiné lot par lot (ex: enrichissement des exports Dolibarr au Lot 4).

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- pour gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Utilisateurs, rôles, organisation commerciale
-- ---------------------------------------------------------------------------

CREATE TYPE role AS ENUM ('REPRESENTANT', 'MASTER_REP', 'FRONT_DESK', 'DIRECTEUR', 'ADMINISTRATEUR');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role          role NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE territories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE countries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 (FR, ES, CH...)
  name          TEXT NOT NULL,
  tax_id_label  TEXT NOT NULL,        -- SIRET, NIF/CIF, Steuernummer, Partita IVA, ...
  currency      TEXT NOT NULL DEFAULT 'EUR',
  territory_id  UUID REFERENCES territories(id)
);

-- Fiche master rep (créée avant sales_reps car référencée par celle-ci)
CREATE TABLE master_reps (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id)
);

CREATE TABLE sales_reps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES users(id),
  master_rep_id  UUID REFERENCES master_reps(id),
  territory_ids  UUID[] NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- 2. Clients / prospects (comptes)
-- ---------------------------------------------------------------------------

CREATE TYPE account_type AS ENUM ('CLIENT', 'PROSPECT');

CREATE TYPE typology AS ENUM (
  'OPTICIEN', 'SURF_SHOP', 'FASHION_STORE', 'SKATE_SHOP', 'SKI_SHOP',
  'CONCEPT_STORE', 'USHIP', 'BIKE_STORE', 'KEY_ACCOUNT', 'DISTRIBUTOR', 'AUTRE'
);

CREATE TYPE sector AS ENUM ('OPTICIEN', 'MODE_SURF_SPORT');

CREATE TYPE sepa_mandate_status AS ENUM ('NON_RENSEIGNE', 'EN_ATTENTE', 'VALIDE', 'REVOQUE');

CREATE TABLE accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                account_type NOT NULL,
  name                TEXT NOT NULL,
  country_id          UUID NOT NULL REFERENCES countries(id),
  typology            typology NOT NULL,
  sector              sector NOT NULL,

  billing_street      TEXT,
  billing_zip         TEXT,
  billing_city        TEXT,
  shipping_street     TEXT,
  shipping_zip        TEXT,
  shipping_city       TEXT,

  contact_name        TEXT,
  phone               TEXT,
  phone_country_code  TEXT,
  mobile              TEXT,
  mobile_country_code TEXT,
  email               TEXT,

  tax_id              TEXT,
  vat_number          TEXT,
  iban                TEXT,
  bic                 TEXT,
  sepa_mandate_status sepa_mandate_status NOT NULL DEFAULT 'NON_RENSEIGNE',

  pipeline_stage      TEXT,
  won_date            TIMESTAMPTZ,
  lost_date           TIMESTAMPTZ,

  owner_rep_id        UUID NOT NULL REFERENCES users(id),
  master_rep_id       UUID REFERENCES users(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_owner_rep ON accounts(owner_rep_id);
CREATE INDEX idx_accounts_master_rep ON accounts(master_rep_id);
CREATE INDEX idx_accounts_type ON accounts(type);

CREATE TABLE attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  mime_type  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  note       TEXT NOT NULL,
  via_voice  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  due_date      TIMESTAMPTZ,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  assignee_id   UUID NOT NULL REFERENCES users(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  account_id    UUID REFERENCES accounts(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Catalogue produits
-- ---------------------------------------------------------------------------

CREATE TYPE product_category AS ENUM (
  'PREMIUM', 'CLASSIC', 'OPTICS', 'ACCESS', 'DISPLAY', 'MERCH', 'GOGGLES', 'KIDS', 'NON_CLASSE'
);

CREATE TYPE stock_status AS ENUM ('EN_STOCK', 'RUPTURE', 'REASSORT_PREVU');

CREATE TYPE product_status AS ENUM ('NOUVEAU', 'ACTIF', 'DISCONTINUE');

CREATE TABLE catalogs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref             TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  model           TEXT,
  color           TEXT,
  category        product_category NOT NULL DEFAULT 'NON_CLASSE',
  collection      TEXT,
  catalog_id      UUID REFERENCES catalogs(id),
  photo_url       TEXT,

  price_fr        NUMERIC(10, 2),
  price_export    NUMERIC(10, 2),
  price_ch        NUMERIC(10, 2),
  rrp             NUMERIC(10, 2),

  qty             INTEGER NOT NULL DEFAULT 0,
  stock_status    stock_status NOT NULL DEFAULT 'EN_STOCK',
  product_status  product_status NOT NULL DEFAULT 'NOUVEAU',
  restock_date    TIMESTAMPTZ,
  expected_qty    INTEGER,

  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by_id  UUID REFERENCES users(id)
);

CREATE INDEX idx_products_catalog ON products(catalog_id);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE catalog_import_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id     UUID NOT NULL REFERENCES catalogs(id),
  created_count  INTEGER NOT NULL,
  updated_count  INTEGER NOT NULL,
  error_count    INTEGER NOT NULL,
  imported_by_id UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Commandes
-- ---------------------------------------------------------------------------

CREATE TYPE order_status AS ENUM ('BROUILLON', 'ENVOYEE_FRONT_DESK', 'VALIDEE', 'EXPORTEE_DOLIBARR', 'ANNULEE');

CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id),
  rep_id                UUID NOT NULL REFERENCES users(id),
  status                order_status NOT NULL DEFAULT 'BROUILLON',
  is_precommande        BOOLEAN NOT NULL DEFAULT FALSE,
  desired_delivery_date TIMESTAMPTZ,
  note                  TEXT,
  shipping_fee_ht       NUMERIC(10, 2) NOT NULL DEFAULT 9.60,
  shipping_offered      BOOLEAN NOT NULL DEFAULT FALSE,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  dolibarr_ref_client   TEXT,
  exported_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_account ON orders(account_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 INTEGER NOT NULL,
  unit_price_ht       NUMERIC(10, 2) NOT NULL,
  discount_pct        NUMERIC(5, 2),
  is_gift             BOOLEAN NOT NULL DEFAULT FALSE,
  is_reliquat         BOOLEAN NOT NULL DEFAULT FALSE,
  reliquat_ship_date  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 5. Objectifs
-- ---------------------------------------------------------------------------

CREATE TYPE objective_type AS ENUM ('CHIFFRE_AFFAIRES', 'PRECOMMANDE');

CREATE TABLE objectives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id        UUID NOT NULL REFERENCES users(id),
  type          objective_type NOT NULL,
  sectors       sector[] NOT NULL DEFAULT '{}',
  categories    product_category[] NOT NULL DEFAULT '{}',
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. Règles commerciales
-- ---------------------------------------------------------------------------

CREATE TYPE business_rule_type AS ENUM (
  'REMISE_CATEGORIE', 'REMISE_COMBO', 'FRAIS_DE_PORT', 'CONDITIONS_PAIEMENT', 'TAXE', 'EXPORT_DOLIBARR'
);

CREATE TYPE rule_scope AS ENUM ('GLOBAL', 'PAYS', 'REPRESENTANT');

CREATE TABLE business_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                     business_rule_type NOT NULL,
  scope                    rule_scope NOT NULL DEFAULT 'GLOBAL',
  country_id               UUID REFERENCES countries(id),
  rep_id                   UUID REFERENCES users(id),
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  categories               product_category[] NOT NULL DEFAULT '{}',
  rate_pct                 NUMERIC(5, 2),
  flat_amount              NUMERIC(10, 2),
  threshold                NUMERIC(10, 2),
  -- Champs Dolibarr (cf. cahier des charges export) — à compléter au Lot 4
  dolibarr_payment_term_id TEXT,
  dolibarr_payment_mode_id TEXT,
  dolibarr_vat_rate_id     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. Audit
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
