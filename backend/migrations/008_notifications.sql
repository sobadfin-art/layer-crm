-- Lot 6 : notifications temps réel.
-- Une notification est toujours rattachée à un utilisateur précis (jamais
-- diffusée "à tout le monde" sans destinataire explicite) ; plusieurs lignes
-- sont créées si plusieurs utilisateurs doivent être notifiés du même
-- événement (ex : un directeur ET le front desk pour une commande envoyée).
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  entity     TEXT,
  entity_id  TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
