-- Comptages avant / après migration (points 1 et 7) — LECTURE SEULE.
-- À exécuter sur la COPIE locale restaurée depuis la sauvegarde, avant puis
-- après `npm run migrate`. Les deux résultats doivent être identiques ligne à
-- ligne (seule la ligne "migrations appliquées" augmente, de 2).
SELECT 'clients/prospects' AS element, count(*) FROM accounts
UNION ALL SELECT 'commandes', count(*) FROM orders
UNION ALL SELECT 'commandes EUR', count(*) FROM orders WHERE currency = 'EUR'
UNION ALL SELECT 'commandes CHF', count(*) FROM orders WHERE currency = 'CHF'
UNION ALL SELECT 'lignes de commande', count(*) FROM order_lines
UNION ALL SELECT 'produits', count(*) FROM products
UNION ALL SELECT 'produits avec photo', count(*) FROM products WHERE photo_url IS NOT NULL
UNION ALL SELECT 'photos produit', count(*) FROM product_photos
UNION ALL SELECT 'produits sans prix Suisse', count(*) FROM products WHERE price_ch IS NULL
UNION ALL SELECT 'utilisateurs', count(*) FROM users
UNION ALL SELECT 'utilisateurs actifs', count(*) FROM users WHERE active
UNION ALL SELECT 'interactions', count(*) FROM interactions
UNION ALL SELECT 'tâches', count(*) FROM tasks WHERE type = 'TACHE'
UNION ALL SELECT 'RDV', count(*) FROM tasks WHERE type = 'RDV'
UNION ALL SELECT 'pièces jointes', count(*) FROM attachments
UNION ALL SELECT 'règles commerciales', count(*) FROM business_rules
UNION ALL SELECT 'objectifs', count(*) FROM objectives
UNION ALL SELECT 'fiches avec IBAN', count(*) FROM accounts WHERE iban IS NOT NULL AND iban <> ''
UNION ALL SELECT 'somme de contrôle IBAN (md5)', ('x' || substr(md5(string_agg(coalesce(iban,'') || '|' || coalesce(bic,''), ',' ORDER BY id)), 1, 8))::bit(32)::int FROM accounts
UNION ALL SELECT 'somme de contrôle montants lignes (md5)', ('x' || substr(md5(string_agg(qty || '|' || unit_price_ht || '|' || coalesce(discount_pct, 0), ',' ORDER BY id)), 1, 8))::bit(32)::int FROM order_lines
UNION ALL SELECT 'migrations appliquées', count(*) FROM schema_migrations;
