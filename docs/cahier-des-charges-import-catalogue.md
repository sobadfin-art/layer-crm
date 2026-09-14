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

---

## 3. Étape 1 — Rattachement à un catalogue (obligatoire, avant tout mapping)

Avant de lire le contenu du fichier, l'administrateur choisit :
- **Catalogue existant** : sélection dans la liste des catalogues déjà présents.
- **Nouveau catalogue** : saisie libre d'un nom (ex. "Hiver 2027").

Toutes les références du fichier importé sont rattachées à ce catalogue unique. **L'import ne peut pas être lancé tant qu'aucun catalogue n'est choisi ou créé.**

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

L'administrateur peut **corriger manuellement** chaque correspondance via un menu déroulant listant les colonnes réellement présentes dans le fichier. **Le champ Référence est le seul obligatoire** — sans lui, l'import ne peut pas être validé (c'est la clé d'identification unique d'une référence).

---

## 5. Étape 3 — Aperçu

Affichage des 10 premières lignes du fichier (colonnes brutes), pour vérification visuelle avant tout traitement.

---

## 6. Étape 4 — Résumé et mode d'import

Avant validation définitive, le système calcule et affiche :
- Nombre total de lignes détectées
- Nombre de **nouvelles références** (référence absente du catalogue actuel)
- Nombre de **références à mettre à jour** (référence déjà existante, identifiée par correspondance exacte sur le champ Référence)
- Nombre d'**erreurs** (ligne sans référence renseignée)

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

## 8. Gestion des catégories

Les catégories doivent correspondre à la liste officielle administrable (actuellement : Premium, Classic, Optics, Access, Display, Merch, Goggles). Si une valeur de catégorie du fichier ne correspond à aucune catégorie connue, la référence est importée avec la catégorie **"Non classé"**, à corriger manuellement ensuite — jamais rejetée ni classée au hasard dans une catégorie existante.

---

## 9. Ce qui n'est PAS couvert par l'import de fichier

- **Les photos produit** ne peuvent pas être importées en masse par ce mécanisme (un fichier Excel/CSV ne transporte pas d'images). Une photo se règle une par une, sur la fiche produit, après import — soit via une URL, soit par téléversement direct d'un fichier JPEG/PNG/WebP depuis l'écran Catalogue produit (ajouté pour les produits pas encore vendus sur mokenvision.com, qui n'ont donc pas encore d'URL publique — cf. `cahier-des-charges-champs-import-catalogue.md`, section 5 bis).
- Pour un vrai import de photos **en masse** en production, il faudra un mécanisme séparé (ex. dossier ZIP nommé par référence, ou lien vers une bibliothèque d'images) — non disponible dans le prototype actuel, le téléversement direct existant se fait référence par référence.

---

## 10. Modèle de fichier

Le système doit permettre de télécharger un modèle Excel vierge listant les colonnes attendues (Référence, Modèle, Couleur, Catégorie, Prix France, Prix Export, Prix Suisse, RRP, Stock), pour que les imports suivants arrivent déjà au bon format et nécessitent moins de remappage manuel. *(Fonctionnalité prévue mais pas encore développée dans le prototype actuel — à ajouter en développement réel.)*

---

## 11. Suppression d'un catalogue

Réservée à l'administrateur. Supprimer un catalogue ne supprime jamais les références qui lui sont rattachées : elles repassent automatiquement en statut **"Sans catalogue"** et restent visibles pour être réaffectées à un autre catalogue.
