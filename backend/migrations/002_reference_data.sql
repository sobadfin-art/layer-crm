-- Données de référence (pays) — nécessaires aux fiches client (Lot 2).
-- Libellés d'identifiant fiscal cf. etat-final-prototype-handoff.md section 4.
INSERT INTO countries (code, name, tax_id_label, currency) VALUES
  ('FR', 'France',      'SIRET',                    'EUR'),
  ('ES', 'Espagne',     'NIF/CIF',                  'EUR'),
  ('CH', 'Suisse',      'IDE',                      'CHF'),
  ('DE', 'Allemagne',   'Steuernummer',              'EUR'),
  ('IT', 'Italie',      'Partita IVA',              'EUR'),
  ('PT', 'Portugal',    'NIF/NIPC',                 'EUR'),
  ('GB', 'Royaume-Uni', 'Company Number',           'GBP'),
  ('BE', 'Belgique',    'N° d''entreprise BCE',     'EUR'),
  ('NL', 'Pays-Bas',    'KVK/BTW',                  'EUR')
ON CONFLICT (code) DO NOTHING;
