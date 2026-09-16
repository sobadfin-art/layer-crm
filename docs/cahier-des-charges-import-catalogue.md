# Cahier des charges — Import en masse du catalogue produits

Ce document décrit précisément le fonctionnement de l'import de référence en masse, tel qu'implémenté dans le prototype, pour servir de base au développement réel (Lot 3 du plan de développement).

---

## 1. Objectif

Permettre à l'administrateur de créer ou mettre à jour un catalogue entier de références produit à partir d'un fichier externe (Excel ou CSV), sans ressaisie manuelle, en rattachant les références importées à un catalogue précis (ex. "2026 SUNGLASSES", "Optic 2026").

---

## 2. Formats de fichier acceptés

- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)
- Le nom des colonnes du fichier source est libre — c'est le mapping (étape 4) qui fait la correspondance, pas une nomenclature imposée à l'utilisateur.
- **Un onglet par catalogue** (correctif 2026-09-16, sur exemple fourni par le client) : un fichier Excel peut contenir plusieurs onglets, chacun représentant un catalogue différent (ex. "SUN 26", "SUN 27", "OPTICS 26"). L'assistant lit toujours un seul onglet à la fois — celui qui correspond au catalogue choisi à l'étape 1 — et propose un sélecteur d'onglet dès que le fichier en contient plusieurs (cf. section 4 bis). Un CSV n'a jamais qu'un seul onglet par nature.
- La ligne d'en-têtes n'est plus obligatoirement la toute première ligne du fichier : une ou plusieurs lignes vides au-dessus des en-têtes (ligne de titre, ligne blanche...) sont désormais ignorées automatiquement — motif réel rencontré dans le fichier fourni par le client, où chaque onglet commence par une ligne vide avant les en-têtes.

---

## 3. Étape 1 — Rattachement à un catalogue (obligatoire, avant tout mapping)

Avant de lire le contenu du fichier, l'administrateur choisit :
- **Catalogue existant** : sélection dans la liste des catalogues déjà présents.
- **Nouveau catalogue** : saisie libre d'un nom (ex. "Hiver 2027").

Toutes les références du fichier importé sont rattachées à ce catalogue unique. **L'import ne peut pas être lancé tant qu'aucun catalogue n'est choisi ou créé.**

---

## 3 bis. Sélection de l'onglet (fichier "1 onglet par catalogue")

Dès qu'un fichier importé contient plusieurs onglets, un sélecteur apparaît à l'étape 2 (mapping), au-dessus de la correspondance des colonnes, pour choisir lequel lire — l'onglet correspondant au catalogue choisi à l'étape 1. Changer d'onglet ré-analyse le fichier sur cet onglet : en-têtes, correspondance suggérée et aperçu des 10 premières lignes sont systématiquement propres à l'onglet sélectionné, jamais mélangés avec un autre. Un fichier à plusieurs onglets destiné à plusieurs catalogues (ex. "SUN 26" et "SUN 27") nécessite donc **un import par catalogue** : on répète l'assistant complet (étapes 1 à 5) une fois par onglet, en changeant à chaque fois le catalogue choisi à l'étape 1 et l'onglet sélectionné à l'étape 2 — jamais un import unique qui répartirait automatiquement les onglets entre plusieurs catalogues (le rattachement au catalogue reste un choix explicite de l'administrateur, cf. section 3).

---

## 4. Étape 2 — Mapping des colonnes

Le système propose un mapping automatique basé sur la reconnaissance de motifs dans les en-têtes du fichier (insensible à la casse, aux espaces et à la ponctuation) :

| Champ cible | Motifs reconnus automatiquement |
|---|---|
| Référence (obligatoire) | ref, sku, reference, référence |
| Modèle | model, modelname, modele, modèle |
| Couleur | color, colors, couleur |
| Catégorie | category, categorie, catégorie |
| Prix France | frprice, pricefr, prixfrance, francePrice |
| Prix Export | exportprice, priceexport, prixexport |
| Prix Suisse | swissprice, chprice, prixsuisse |
| Prix conseillé (RRP) | rrp, prixconseille, recommendedretailprice |
| Quantité en stock | stock, qty, quantite, quantité |
| ID Dolibarr | id dolibarr, dolibarr id, code dolibarr, dolibarr ref, ref dolibarr, dolibarr code, id produit dolibarr |

L'administrateur peut **corriger manuellement** chaque correspondance via un menu déroulant listant les colonnes réellement présentes dans le fichier. **Le champ Référence est le seul obligatoire** — sans lui, l'import ne peut pas être validé (c'est la clé d'identification unique d'une référence). L'ID Dolibarr reste facultatif au mapping (une ligne sans ID Dolibarr s'importe normalement), mais dès qu'il est renseigné il déclenche la vérification de cohérence décrite en section 7 bis.

---

## 5. Étape 3 — Aperçu

Affichage des 10 premières lignes du fichier (colonnes brutes), pour vérification visuelle avant tout traitement.

---

## 6. Étape 4 — Résumé et mode d'import

Avant validation définitive, le système calcule et affiche :
- Nombre total de lignes détectées
- Nombre de **nouvelles références** (référence absente du catalogue actuel)
- Nombre de **références à mettre à jour** (référence déjà existante, identifiée par correspondance exacte sur le champ Référence)
- Nombre d'**erreurs** (ligne sans référence renseignée, ou rejetée par la règle de cohérence Référence <-> ID Dolibarr, section 7 bis)
- **Détail ligne par ligne des erreurs** (correctif 2026-09-16, fiche corrective "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", point 13) : numéro de ligne dans le fichier, référence concernée (si connue) et motif exact du rejet — affiché aussi bien avant validation (étape 4) qu'après application réelle (étape 5), jamais seulement un compte global. Limité aux 50 premières lignes rejetées sur un très gros fichier fautif (le compte total, lui, reste toujours exact).

L'administrateur choisit ensuite le mode d'application :
- Créer les nouvelles références **et** mettre à jour les existantes (par défaut)
- Créer uniquement les nouvelles références
- Mettre à jour uniquement les références existantes

---

## 7. Comportement à l'import

Pour chaque ligne valide :
- Si la référence existe déjà (correspondance exacte) → mise à jour des champs mappés uniquement (les champs non mappés, ex. photo, ne sont pas écrasés).
- Si la référence n'existe pas → création d'une nouvelle fiche produit avec :
  - Statut produit par défaut : **Nouveau**
  - Statut de stock par défaut : **En stock**
  - Photo : vide (à ajouter manuellement ensuite, cf. section 9)
  - Libellé généré automatiquement à partir du modèle + couleur si ces champs sont mappés

**Sécurité de l'import** :
- Aucune référence absente du fichier n'est supprimée automatiquement.
- Aucune donnée n'est écrasée silencieusement sans que le résumé (étape 4) l'ait annoncé.
- Chaque import réussi est journalisé dans l'historique du catalogue (date, nombre de créations, nombre de mises à jour).

---

## 7 bis. Règle de cohérence Référence <-> ID Dolibarr (correctif 2026-09-16)

Ajoutée à la demande explicite du client : *"rajouter le code produit ID Dolibarr pour s'assurer des bonnes connexions"*, avec la règle suivante formulée par le client et appliquée ici telle quelle :

> Si un produit se retrouve dans plusieurs catalogues, la référence ne peut pas être doublée — un seul ID Dolibarr est possible pour cette référence. Un catalogue peut en revanche parfaitement avoir des références qui existent déjà dans un autre catalogue — ce n'est jamais un problème en soi.

Concrètement, dès qu'une ligne renseigne un ID Dolibarr, deux vérifications s'appliquent — dans les deux sens, et tous catalogues confondus (base entière, pas seulement le catalogue en cours d'import) :

1. **Une référence ne peut avoir qu'un seul ID Dolibarr.** Si la même référence apparaît avec un ID Dolibarr différent — dans le fichier importé (par exemple entre deux onglets traités l'un après l'autre) ou par rapport à ce qui est déjà enregistré pour cette référence — la ligne est rejetée avec un message explicite, jamais importée avec un ID Dolibarr douteux.
2. **Un ID Dolibarr ne peut être rattaché qu'à une seule référence.** Si le même ID Dolibarr est associé à deux références différentes — dans le fichier ou par rapport à l'existant — les lignes concernées sont rejetées, pour la même raison.

Ce qui est **explicitement toléré, et ne déclenche donc aucune de ces deux vérifications** : une référence déjà présente dans un autre catalogue, tant que son ID Dolibarr reste le même. Importer une référence déjà rattachée à un autre catalogue **l'ajoute** au catalogue choisi à l'étape 1, en plus de ses catalogues existants (rattachement multi-catalogue, cf. section 11 bis — correctif 2026-09-16 "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", point 8, qui remplace la réattribution exclusive décrite jusqu'ici dans une version antérieure de cette section) — ce n'est jamais un conflit à signaler.

Les lignes rejetées par cette règle comptent dans les **erreurs** du résumé (étape 4, section 6), au même titre qu'une ligne sans référence — jamais un rejet de l'import entier : les autres lignes valides du fichier s'importent normalement.

---

## 8. Gestion des catégories

Les catégories doivent correspondre à la liste officielle administrable (actuellement : Premium, Classic, Optics, Access, Display, Merch, Goggles). Si une valeur de catégorie du fichier ne correspond à aucune catégorie connue, la référence est importée avec la catégorie **"Non classé"**, à corriger manuellement ensuite — jamais rejetée ni classée au hasard dans une catégorie existante.

---

## 9. Ce qui n'est PAS couvert par l'import de fichier

- **Les photos produit** ne peuvent pas être importées en masse par ce mécanisme (un fichier Excel/CSV ne transporte pas d'images). Une photo se règle une par une, sur la fiche produit, après import — soit via une URL, soit par téléversement direct d'un fichier JPEG/PNG/WebP depuis l'écran Catalogue produit (ajouté pour les produits pas encore vendus sur mokenvision.com, qui n'ont donc pas encore d'URL publique — cf. `cahier-des-charges-champs-import-catalogue.md`, section 5 bis).
- Pour un vrai import de photos **en masse** en production, il faudra un mécanisme séparé (ex. dossier ZIP nommé par référence, ou lien vers une bibliothèque d'images) — non disponible dans le prototype actuel, le téléversement direct existant se fait référence par référence.

---

## 10. Modèle de fichier

**Implémenté le 2026-09-16** (cette section décrivait jusqu'ici une fonctionnalité prévue mais non développée — c'est désormais fait). Un bouton **"Télécharger un modèle"**, sur l'écran d'upload de l'assistant d'import, télécharge un fichier Excel vierge (`modele-import-catalogue.xlsx`) listant les colonnes attendues : Référence, Modèle, Couleur, Catégorie, Prix France, Prix Export, Prix Suisse, Prix conseillé (RRP), Quantité en stock, **ID Dolibarr**. Conformément à la règle "1 onglet par catalogue" (section 2), ce modèle contient **un onglet par catalogue déjà existant** dans l'application (même nom que le catalogue, uniquement les en-têtes, aucune ligne de données) ; s'il n'existe encore aucun catalogue, le modèle contient un unique onglet générique "Catalogue". L'administrateur choisit ensuite, pour chaque onglet à remplir, le catalogue correspondant à l'étape 1 lors de l'import (section 3).

---

## 11. Suppression d'un catalogue

Réservée à l'administrateur. Supprimer un catalogue ne supprime jamais les références qui lui sont rattachées : seule cette affiliation précise disparaît. Depuis le rattachement multi-catalogue (section 11 bis), une référence présente dans plusieurs catalogues reste normalement visible dans les autres ; seule une référence qui n'appartenait **qu'à** ce catalogue repasse en statut **"Sans catalogue"** et reste visible pour être rattachée à un autre.

---

## 11 bis. Rattachement multi-catalogue (correctif 2026-09-16)

Ajouté à la demande explicite du client, fiche corrective "CORRECTIFS CRM — PROFIL ADMINISTRATEUR", points 8/9 : *"Un produit peut appartenir à plusieurs catalogues... Les catalogues ne doivent pas être mutuellement exclusifs."*

Une référence peut désormais être rattachée **simultanément** à plusieurs catalogues (ex. une monture présente à la fois dans "2026 SUNGLASSES" et "OPTIC 2026") :

- **Fiche produit (Admin produits)** : le champ "Catalogue(s)" se présente en bulles de sélection cliquables (une par catalogue existant, cf. section 7 pour le même principe appliqué au sélecteur d'écran) — plusieurs peuvent être actives à la fois pour une même référence, aucune n'est exclusive des autres.
- **Import en masse** : importer une référence déjà connue dans un catalogue **ajoute** le catalogue choisi à l'étape 1 à ses affiliations existantes, il ne les remplace jamais (cf. section 7 bis). Réimporter une même référence dans plusieurs catalogues, onglet par onglet (section 3 bis), construit donc progressivement son rattachement multi-catalogue.
- **Prise de commande (Représentant)** : une référence apparaît dans chaque catalogue auquel elle est rattachée — la sélection d'un catalogue au moment de la commande reste un filtre de navigation (un seul à la fois, ou "Tous"), pas une exclusion des autres affiliations de la référence.
- **Suppression d'un catalogue** : cf. section 11, ne retire que cette affiliation précise.

Grounded dans le code : table de jointure `product_catalogs` (migration `020_product_catalogs.sql`), qui remplace l'ancienne colonne `products.catalog_id` (un seul catalogue à la fois, conservée en base mais plus lue ni écrite) comme source de vérité — `routes/products.js` (`catalogIds`/`catalogNames` sur chaque référence, filtre `?catalogId=` désormais "appartient à au moins un des catalogues demandés"), `lib/catalogImport.js` (ajout plutôt que remplacement à l'import), `routes/catalogs.js` (comptage de références et suppression via la table de jointure).

---

## 12. Historique

- **2026-09-16 (fiche corrective "CORRECTIFS CRM — PROFIL ADMINISTRATEUR")** — Rattachement multi-catalogue (section 11 bis) : une référence peut désormais appartenir à plusieurs catalogues à la fois ; importer une référence déjà connue dans un nouveau catalogue l'y **ajoute** au lieu de l'y réattribuer exclusivement (section 7 bis mise à jour en conséquence, tout comme la section 11 sur la suppression d'un catalogue). Détail ligne par ligne des erreurs d'import (numéro de ligne, référence, motif — section 6), jusqu'ici seul le compte global remontait. Bug serveur corrigé : la modification du statut de stock (Rupture/Réassort prévu) via la fiche produit provoquait une erreur 500 systématique (mauvaise conversion des noms de colonnes `priceFR`/`priceCH`, sans lien avec le statut lui-même — touchait en réalité toute modification via ce formulaire). Colonne "ID Dolibarr" désormais éditable aussi depuis la création/modification manuelle d'une référence, pas seulement à l'import. Grounded dans le code : migration `020_product_catalogs.sql`, `routes/products.js` (`catalogIds`, correctif `columnFor`), `lib/catalogImport.js`/`lib/accountsImport.js` (`extractErrorDetails`), `routes/catalogs.js`, `CatalogueAdmin.jsx`/`CatalogueConsult.jsx` (bulles de catalogue) — vérifié par script API (20/20) et Playwright (multi-catalogue, détail des erreurs, cohérence Admin/Représentant).
- **2026-09-16** — Ajout de la règle de cohérence Référence <-> ID Dolibarr (section 7 bis), de la reconnaissance de la colonne "ID Dolibarr" (section 4), du support des fichiers "1 onglet par catalogue" avec sélecteur d'onglet (sections 2 et 3 bis) et de la reconnaissance d'une ligne d'en-têtes précédée de lignes vides (section 2) — à la demande du client, sur la base d'un exemple réel fourni (fichier à 3 onglets SUN 26 / SUN 27 / OPTICS 26 avec colonne ID Dolibarr). Modèle de fichier téléchargeable (section 10) implémenté à cette occasion, avec un onglet par catalogue existant. Grounded dans le code réellement implémenté et testé : `lib/fileParsing.js` (détection de la ligne d'en-têtes, sélection d'onglet), `lib/catalogImport.js` (`validateDolibarrIds`), `lib/importMapping.js`, `lib/importTemplates.js`, `routes/catalogs.js` (`GET /import-template`) — vérifié de bout en bout avec le fichier réel fourni par le client (import des 3 onglets dans des catalogues séparés, détection effective d'un conflit d'ID Dolibarr réel présent dans ce fichier entre deux variantes de casse d'une même référence).
