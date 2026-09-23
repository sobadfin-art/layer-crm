ALTER TABLE accounts ADD COLUMN geocoded_at TIMESTAMPTZ;

COMMENT ON COLUMN accounts.geocoded_at IS 'Date de la dernière tentative de géocodage (succès OU échec). Distinct de latitude/longitude, qui restent NULL en cas d''échec (adresse introuvable ou absente) : sans cette colonne, le rattrapage rétroactif (fetchUngeocodedAccounts, WHERE latitude IS NULL) reboucle indéfiniment sur les fiches sans adresse exploitable, puisqu''elles ne quittent jamais ce critère. Avec geocoded_at, une fiche traitée sort du lot dès la première tentative, que le géocodage ait réussi ou non.';

-- Backfill : les fiches déjà géocodées avec succès avant l'ajout de cette
-- colonne sont marquées comme traitées (on ne va pas les regéocoder).
-- Les fiches sans coordonnées restent geocoded_at = NULL : elles seront
-- prises en compte par le prochain passage du rattrapage rétroactif.
UPDATE accounts SET geocoded_at = now() WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
