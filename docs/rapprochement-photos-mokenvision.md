# Rapprochement automatique des photos produit avec mokenvision.com

## 1. Objectif

Éviter la saisie manuelle d'une URL de photo, fiche par fiche (cf. section 9
de `cahier-des-charges-import-catalogue.md`), en rapprochant automatiquement
chaque fiche produit du catalogue CRM avec la photo correspondante publiée
sur le site vitrine mokenvision.com — sans jamais associer une photo
approximative à un produit qui ne s'y trouve pas.

## 2. Ce qui a été fait

1. **Extraction** — la collection "Solaires" (lunettes de soleil) du site
   www.mokenvision.com a été parcourue intégralement (6 pages, 191 fiches
   produit / variantes de couleur, 76 modèles distincts). Pour chaque fiche :
   nom du modèle, URL de la page produit, et **URL directe de l'image**
   (hébergée sur le CDN du site lui-même, ex.
   `https://www.mokenvision.com/5225-home_default/rover.jpg`).
2. **Regroupement** — les 191 entrées ont été regroupées par modèle
   normalisé (insensible casse/accents/espaces) dans
   `backend/scripts/mokenvision-photos/moken_photos_map.json`, avec pour
   chaque modèle la liste de ses variantes couleur (couleur déduite de l'URL
   du site quand disponible, sinon `null`).
3. **Script de rapprochement** —
   `backend/scripts/mokenvision-photos/match-photos-to-catalog.mjs` :
   - lit le catalogue CRM actuel (`GET /api/products`) ;
   - pour chaque fiche **sans photo déjà renseignée**, cherche une
     correspondance exacte sur le champ **Modèle** (normalisé) dans le
     rapprochement ci-dessus ;
   - si plusieurs couleurs existent pour ce modèle, choisit la variante dont
     la couleur correspond au champ Couleur de la fiche (sinon la première
     variante disponible) ;
   - applique la photo trouvée via `PATCH /api/products/:id` (même chemin
     que la mise à jour manuelle d'une fiche — déclenche l'audit
     `PRODUCT_UPDATED`), jamais en écriture SQL directe ;
   - **une fiche qui a déjà une photo n'est jamais écrasée** ;
   - **un modèle absent du fichier de rapprochement n'est jamais associé à
     une photo approximative** — il reste sans photo, à traiter
     manuellement, et remonte dans la liste "non rapprochés" affichée par le
     script.

   Utilisation : `node backend/scripts/mokenvision-photos/match-photos-to-catalog.mjs`
   (ajouter `--dry-run` pour un aperçu sans écriture).

## 3. Résultat sur le catalogue actuel

**0 rapprochement.** Les 3 fiches produit actuellement dans le CRM (Comet,
Nova, Rocket) ne correspondent à **aucun** modèle réel du site
mokenvision.com — vérifié modèle par modèle sur les 76 modèles de la
collection Solaires (Rover, Green Wood, Woody, Zenith, Allround, Ivy, Dane,
Monique, Skyfoil, Walter, etc.). Ce sont des données de démonstration du
prototype, pas des références réelles de la marque. Le rapprochement n'a
donc rien pu appliquer pour l'instant — ce qui est le comportement correct
(mieux vaut zéro rapprochement que trois rapprochements inventés).

Le script est vérifié fonctionnel de bout en bout : testé avec une fiche
produit de modèle "Rover" (créée puis supprimée pour le test), il a
correctement retrouvé et appliqué
`https://www.mokenvision.com/5225-home_default/rover.jpg` comme photo.

**Ce script est donc prêt à être relancé dès que le catalogue réel sera
importé** (cf. `cahier-des-charges-champs-import-catalogue.md`) — il suffira
de le relancer une fois l'import fait, sans autre intervention, pour
photographier automatiquement toutes les fiches dont le modèle correspond à
un produit du site.

## 4. Limites et périmètre couvert

- Seule la collection **"Solaires"** (191 fiches / 76 modèles) a été
  parcourue. Le site propose aussi Optiques, Enfants, Sport, Masques de ski
  et Accessoires — non couverts par ce premier passage. Si le catalogue réel
  importé contient des références issues de ces autres familles, il faudra
  étendre `moken_photos_map.json` de la même façon (même mécanique de
  script, autre(s) page(s) de collection à parcourir).
- Le rapprochement se fait **uniquement sur le champ Modèle** (cf. section 5
  de `cahier-des-charges-champs-import-catalogue.md`) — jamais sur la
  Référence interne, qui n'a pas d'équivalent public sur le site.
- La photo est stockée comme **URL externe** (celle du CDN mokenvision.com
  lui-même), pas comme fichier hébergé par l'application — cohérent avec le
  fonctionnement actuel de la fiche produit (champ `photo_url`, qui accepte
  indifféremment une URL externe http(s) ou un fichier téléversé, cf. section
  5 bis).
- **Ce rapprochement ne peut, par construction, jamais rien trouver pour un
  produit qui n'est pas encore vendu sur mokenvision.com** — il n'existe
  alors aucune page ni aucune image sur le site à rapprocher. Pour ces
  produits, cf. section 5 bis ci-dessous.

## 5 bis. Alternative pour les produits pas encore en ligne

Certains produits du catalogue Moken ne sont pas encore vendus sur
mokenvision.com et le seront plus tard ("certains produits ne sont pas vendu
sur le site internet encore. il le seront plus tard") — le rapprochement
automatique décrit ci-dessus ne peut donc rien leur trouver, puisqu'il n'y a
tout simplement pas encore de photo publiée à rapprocher.

Pour ces produits, l'écran Catalogue produit permet désormais de
**téléverser directement un fichier photo** (JPEG, PNG ou WebP, 8 Mo max)
depuis l'ordinateur, sans passer par une URL — cf.
`cahier-des-charges-champs-import-catalogue.md`, section 5 bis, pour le
détail complet (route `POST /api/products/:id/photo`, stockage interne
servi depuis `/uploads/products/...`).

Le jour où le produit est mis en vente sur le site, la photo téléversée peut
simplement être remplacée par l'URL officielle mokenvision.com (nouveau
téléversement ou relance du script de rapprochement une fois le modèle
présent dans `moken_photos_map.json`) — les deux mécanismes cohabitent sur
le même champ `photo_url` et sont interchangeables à tout moment.

## 6. Historique

- **2026-09-14** — Extraction et script de rapprochement créés à la demande
  du client ("profite-en pour scrapper mokenvision.com et récupérer les
  photos produit"). Exécuté sur le catalogue actuel : 0 rapprochement
  (données de démo), mécanique validée avec un cas de test réel (Rover).
- **2026-09-14** — Ajout de la section 5 bis : alternative par téléversement
  direct de fichier pour les produits pas encore vendus sur le site
  ("prévoit une autre façon pour pouvoir uploader les photos produits que le
  lien Http. certains produits ne sont pas vendu sur le site internet
  encore. il le seront plus tard"), pour compléter le rapprochement
  automatique qui ne peut rien trouver dans ce cas précis.
