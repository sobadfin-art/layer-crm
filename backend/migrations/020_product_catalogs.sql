-- Correctif 2026-09-16 (fiche corrective "CORRECTIFS CRM — PROFIL ADMINISTRATEUR",
-- point 8) : un produit doit pouvoir appartenir SIMULTANÉMENT à plusieurs
-- catalogues ("les catalogues ne doivent pas être mutuellement exclusifs").
-- Jusqu'ici `products.catalog_id` ne portait qu'un seul catalogue à la fois.
--
-- `products.catalog_id` est laissée en place telle quelle (aucune donnée
-- perdue, migration non destructive) mais n'est plus lue ni écrite par
-- l'application après ce correctif — remplacée comme source de vérité par
-- cette table de jointure, backfillée ci-dessous à partir des données
-- existantes pour qu'aucun rattachement déjà en place ne soit perdu.

CREATE TABLE product_catalogs (
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  catalog_id  UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, catalog_id)
);

CREATE INDEX idx_product_catalogs_catalog ON product_catalogs(catalog_id);
CREATE INDEX idx_product_catalogs_product ON product_catalogs(product_id);

INSERT INTO product_catalogs (product_id, catalog_id)
SELECT id, catalog_id FROM products WHERE catalog_id IS NOT NULL
ON CONFLICT DO NOTHING;
