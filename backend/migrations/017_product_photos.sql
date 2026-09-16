-- Galerie photo produit (jusqu'à 5 photos par référence) — fiche corrective
-- V2 Administrateur, section 5 "Gestion des photos" : "Le champ image unique
-- ne suffit pas : prévoir jusqu'à 5 photos par produit. Les photos
-- téléversées dans Admin produits doivent être rattachées à la référence
-- correspondante. Ces photos doivent pouvoir être réutilisées dans le
-- Catalogue produits pour un affichage de type galerie/slider."
--
-- products.photo_url (colonne existante) est conservée telle quelle comme
-- "photo de couverture" — c'est elle que lisent tous les écrans qui
-- n'affichent qu'une seule vignette (Catalogue.jsx pour la prise de
-- commande, NewOrder.jsx, la colonne photo de CatalogueAdmin.jsx, le script
-- de rapprochement mokenvision). Elle reste synchronisée par l'application
-- (routes/products.js) sur l'URL de la photo en position 0 de la galerie,
-- jamais en écriture directe ici : aucun trigger SQL, pour garder toute la
-- logique métier au même endroit que les autres écritures produit.
CREATE TABLE product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, position)
);

CREATE INDEX idx_product_photos_product_id ON product_photos(product_id);

-- Reprise des photos de couverture déjà en place (photo_url renseigné) en
-- position 0 de la nouvelle table, pour que la galerie parte de l'existant
-- plutôt que de recommencer à zéro.
INSERT INTO product_photos (product_id, url, position)
SELECT id, photo_url, 0 FROM products WHERE photo_url IS NOT NULL;
