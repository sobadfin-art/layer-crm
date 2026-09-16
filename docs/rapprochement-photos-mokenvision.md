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

- Collections **"Solaires"** (191 fiches / 76 modèles), **"Enfants"** (21
  fiches / 6 modèles, intégralement parcourue) et **"Masques de ski"** (8
  fiches / 2 modèles ONE et TWO, intégralement parcourue) couvertes. La
  collection **"Accessoires"** est couverte à 17 fiches sur 19 (2 fiches —
  une variante de housse Hawkins et le "Magic Mountain Mask" — restent à
  ajouter, cf. section 7). Les collections **Optiques** (141 fiches / 5
  pages) et **Sport** (73 fiches / 3 pages) restent non couvertes — leurs
  listes de produits ont été récupérées (noms de modèle + URL de fiche) mais
  pas encore les photos elles-mêmes (cf. section 7, interrompu par une
  limite d'usage). Si le catalogue réel importé contient des références
  issues de ces familles non encore couvertes, il faudra terminer
  l'extraction de la même façon (même mécanique, une fiche produit
  mokenvision.com à la fois : la page de listing ne suffit pas, ses
  vignettes sont chargées en différé et n'exposent pas l'URL réelle de la
  photo avant l'exécution du JavaScript de la page).
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
- **2026-09-15** — Extension de `moken_photos_map.json` aux collections
  Enfants (intégrale) et Masques de ski (intégrale), + 17/19 fiches
  Accessoires — cf. section 7. Catalogue réel désormais importé (348
  fiches) : relance du script en `--dry-run` après cette extension →
  **121 rapprochements trouvés** en `--dry-run`, confirmant que le
  mécanisme fonctionne sur données réelles, pas seulement en test. Le
  scraping des deux collections restantes (Optiques, Sport) ayant été
  interrompu par une limite d'usage externe (cf. section 7) sans visibilité
  sur son délai de levée, le rapprochement a été **appliqué pour de vrai**
  (sans `--dry-run`) sur ce qui était disponible plutôt que d'attendre
  indéfiniment : **121 photos effectivement écrites** sur les fiches
  produit (0 erreur), portant le catalogue à 122 fiches avec photo (1
  préexistante via téléversement direct, cf. section 5 bis). Les 226 fiches
  restantes (dont la totalité d'Optiques et Sport, non encore scrapées)
  n'ont pas été touchées — jamais de photo approximative associée à une
  fiche sans correspondance sûre. Relancer le même script (sans
  `--dry-run`) une fois Optiques/Sport ajoutés à `moken_photos_map.json`
  complétera automatiquement le reste, sans écraser les 121 déjà posées
  (le script ignore toute fiche ayant déjà `photo_url`).

## 7. Extension 2026-09-15 — état d'avancement et suite à donner

Cette extraction a été interrompue par une limite d'usage mensuelle de
l'outil de récupération web (message : "You've hit your org's monthly spend
limit"), pas par un choix ni par un problème technique du côté du site
mokenvision.com. Ce qui suit récapitule précisément ce qui a été fait et ce
qu'il reste à faire pour reprendre exactement où ça s'est arrêté.

**Fait (intégré à `moken_photos_map.json`) :**
- Collection Enfants — 21/21 fiches, 6 modèles (Mini Rockett, Cheeky,
  Roundy, Nzoo II, Mini Rob, Piou II).
- Collection Masques de ski — 8/8 fiches, 2 modèles (ONE, TWO).
- Collection Accessoires — 17/19 fiches, 13 modèles (Corduroy Pouch, Cords,
  Cords Clip, Lens Cleaner Kit, Hawkins Covers, Brendan Baseball, Ted
  Trucker, Rob Runners, Finn Flat Peak). Il manque 2 fiches : une variante
  bleue de housse Hawkins
  (`https://www.mokenvision.com/en/sunglasses-collection/779-1266-hawkins-covers-1000006573149.html`)
  et le "Magic Mountain Mask"
  (`https://www.mokenvision.com/en/hawkins/873-1396-hawkins-covers-3760314197809.html`).

**Pas encore fait (listing récupéré, photos pas encore extraites) :**
- Collection Optiques (`https://www.mokenvision.com/en/109-eyeglasses`,
  141 fiches, 5 pages `?page=2` à `?page=5`) — env. 52 modèles distincts
  recensés depuis les 5 pages de listing (Nika, Sally, Mandy, Giulia,
  Bryson, Luz, Maria, Mary, Sasha, Gary, Jack, Crossroads, Elena, Marius,
  Oscar, Kent, Sawdust, Still, Duke, Jeanne, Rust, Leaf, Boucau, Laas,
  Nina, Fine, Ella, Aaron, Chirac, Otis, Léon, Carissa, John, Monika,
  Jessy, Lucy, Josephine II, Laura, Jade, George, Matt, Layne, Daria,
  Dylan, Tom, Kyle, Ava, Helen, Jana, Mily, Tessa, Valerie).
- Collection Sport (`https://www.mokenvision.com/en/225-sport`, 73 fiches,
  3 pages) — env. 24 modèles distincts recensés (Strato, Kurtiss, Hawkins,
  Hawkins Vintage, Hawkins SMK, Walter, Lina, The Rockett, Muddy, Santo,
  Rover, Rover II, Skyfoil, COSMOS, Kutbak, Bruce, The Helias Pro Model,
  Moana, Olina, Keli, Magic Mountain Mask — ONE/TWO déjà couverts via
  Masques de ski).

**Pourquoi une simple page de listing ne suffit pas** — contrairement à ce
qu'on pourrait espérer, l'URL réelle de la vignette produit sur une page de
catégorie est chargée en différé par JavaScript (lazy loading) ; la page
telle que récupérée expose seulement une image de remplacement
(`en-default-home_default.jpg`), jamais la vraie photo. Il faut donc
ouvrir **chaque fiche produit individuellement** pour en extraire l'image
de couverture réelle (`https://www.mokenvision.com/NNNN-superlarge_default/
slug.jpg`, à convertir en `NNNN-home_default/slug.jpg` pour rester cohérent
avec le reste du fichier de rapprochement) — c'est ce qui a été fait fiche
par fiche pour Enfants/Masques de ski/Accessoires, et qu'il reste à faire
pour Optiques et Sport (environ 76 fiches représentatives si on ne prend
qu'une couleur par modèle, ou jusqu'à 214 fiches pour une couverture
complète par variante de couleur comme pour Solaires).

**Pour reprendre :** relancer l'extraction fiche par fiche sur les URLs de
listing déjà recensées ci-dessus (pas besoin de re-parcourir les pages de
catégorie), ajouter les entrées au même format dans
`moken_photos_map.json` (voir les entrées déjà ajoutées le 2026-09-15 comme
modèle), puis relancer
`node backend/scripts/mokenvision-photos/match-photos-to-catalog.mjs
--dry-run` pour vérifier l'impact avant d'appliquer l'écriture réelle
(tâche séparée, cf. le plan de correction Administrateur).
