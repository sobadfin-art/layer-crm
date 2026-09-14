-- Durcissement authentification / gestion des utilisateurs (chantier sécurité).
--
-- must_change_password : un compte créé par un administrateur (DIRECTEUR) démarre
-- avec un mot de passe temporaire et ce drapeau à TRUE. Le frontend doit forcer
-- l'écran de changement de mot de passe tant qu'il vaut TRUE ; l'API le repasse
-- à FALSE une fois le changement effectué (cf. PATCH /api/auth/password).
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- password_reset_tokens : jetons de réinitialisation "mot de passe oublié".
-- On ne stocke jamais le jeton en clair, seulement son hash (sha256) — comme un
-- mot de passe, le jeton brut n'est communiqué qu'une fois, au moment de la
-- demande, et ne doit pas être reconstituable depuis la base en cas de fuite.
-- Jeton à usage unique (used_at) et à durée de vie courte (expires_at).
CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
