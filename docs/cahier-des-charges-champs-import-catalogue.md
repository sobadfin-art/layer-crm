# Cahier des charges — Inventaire complet des champs importables (catalogue produits)

Ce document liste, champ par champ, tout ce que l'import du catalogue produits
(cf. `cahier-des-charges-import-catalogue.md` pour la mécanique de l'assistant
en 4 étapes) sait reconnaître et enregistrer — pour servir de cible à la
configuration d'un export Dolibarr enrichi. Il ne remplace pas ce premier
document (mécanique, sécurités, journalisation) : il en est le complément
"référence des champs".

**Principe général** : le nom des colonnes du fichier est libre — c'est la
reconnaissance de motifs (insensible à la casse, aux espaces et aux accents)
qui fait correspondre chaque colonne à un champ cible, avec correction
manuelle possible à l'étape 2 de l'assistant. Un champ absent du fichier
n'est **jamais bloquant** : soit il reste vide, soit une valeur par défaut
documentée ci-dessous s'applique — jamais aucune valeur n'est devinée ou
inventée.

Deux niveaux de champs :

- **Socle** : présents dans le fichier standard actuel (9 colonnes).
- **Enrichi** : reconnus si le fichier les fournit, absents du fichier
  standard actuel. C'est sur ces champs qu'un export enrichi peut être
  construit pour renseigner un maximum d'informations en une seule fois.

---

## 1. Champs socle

| Champ cible | Colonne(s) reconnue(s) (motifs) | Obligatoire | Format / valeurs acceptées | Comportement si absent ou non reconnu |
|---|---|---|---|---|
| Référence | `Ref`, `SKU`, `Reference`, `Référence` | **Oui** | Texte libre, unique (clé d'identification de la ligne) | Ligne rejetée ("Référence manquante") — c'est le seul champ obligatoire, et la clé de rapprochement unique |
| Modèle | `Model`, `Model Name`, `Modele`, `Modèle` | Non | Texte libre | Laissé vide. À la création, sert (avec Couleur) à générer automatiquement le libellé affiché si ni l'un ni l'autre n'est fourni, le libellé retombe sur la référence elle-même |
| Couleur | `Color`, `Colors`, `Couleur` | Non | Texte libre | Laissé vide. Voir génération du libellé ci-dessus |
| Catégorie | `Category`, `Categorie`, `Catégorie` | Non | Un des 8 libellés officiels (voir section 3) | **Non classé** par défaut si absente ou non reconnue — jamais classée au hasard dans une catégorie existante |
| Prix France | `FR Price`, `Price FR`, `Prix France`, `France Price` | Non | Nombre (`,` ou `.` comme séparateur décimal) | Laissé vide |
| Prix Export | `Export Price`, `Price Export`, `Prix Export` | Non | Nombre | Laissé vide |
| Prix Suisse | `Swiss Price`, `CH Price`, `Prix Suisse` | Non | Nombre | Laissé vide |
| Prix conseillé (RRP) | `RRP`, `Prix conseillé`, `Recommended Retail Price` | Non | Nombre | Laissé vide |
| Quantité en stock | `Stock`, `Qty`, `Quantite`, `Quantité` | Non | Nombre entier | **0** par défaut à la création si absente |
| ID Dolibarr | `ID Dolibarr`, `Code Dolibarr`, `Dolibarr Ref`, `Ref Dolibarr`, `Dolibarr Code`, `Dolibarr Id`, `Id Produit Dolibarr` | Non | Texte libre (accepte un identifiant numérique, ex. `931`) | Laissé vide si absent. **Depuis le 2026-09-16, ce champ n'est plus une simple correspondance de secours** : dès qu'il est renseigné, il déclenche une vérification de cohérence à l'import (section 1 bis) — une référence ne peut avoir qu'un seul ID Dolibarr, et réciproquement. Il reste néanmoins **toujours la Référence**, jamais l'ID Dolibarr, qui sert de clé de rapprochement principale pour créer/mettre à jour une fiche (cf. `cahier-des-charges-import-catalogue.md` section 4) |

---

## 1 bis. Cohérence Référence <-> ID Dolibarr (correctif 2026-09-16)

Règle demandée explicitement par le client (*"s'assurer des bonnes connexions"*), appliquée dans les deux sens et tous catalogues confondus :

- **une référence ne peut avoir qu'un seul ID Dolibarr** — jamais deux ID différents pour la même référence, que ce soit dans le même fichier (ex. deux onglets/catalogues qui se contredisent) ou par rapport à ce qui est déjà enregistré en base ;
- **un ID Dolibarr ne peut être rattaché qu'à une seule référence** — jamais deux références différentes partageant le même ID.

À l'inverse, et c'est **explicitement autorisé** : la même référence peut parfaitement apparaître dans plusieurs catalogues différents (le client : *"un catalogue peut avoir des références qui existent sur plusieurs catalogues"*) — ce n'est un problème que si son ID Dolibarr change d'un catalogue à l'autre. Le détail complet (algorithme, exemples, ce qui est rejeté vs toléré) est documenté dans `cahier-des-charges-import-catalogue.md`, section 7 bis — cette section-ci ne fait que positionner le champ ID Dolibarr par rapport aux autres champs du socle.

---

## 2. Champs enrichis

Aucun de ces champs n'existe dans le fichier standard actuel à 9 colonnes.
Ils ne sont utiles que si l'export est spécifiquement configuré pour les
fournir.

| Champ cible | Colonne(s) reconnue(s) (motifs) | Format / valeurs acceptées | Comportement si absent ou non reconnu |
|---|---|---|---|
| Collection | `Collection`, `Collection Name`, `Gamme` | Texte libre | Laissé vide |
| Statut stock | `Stock Status`, `Statut stock`, `État stock` | `En stock`, `Rupture` (ou "Out of stock"), `Réassort prévu` (insensible casse/accents) | **En stock** par défaut si absent ou non reconnu (valeur par défaut habituelle à la création) |
| Statut produit | `Product Status`, `Statut produit`, `État produit`, `Lifecycle` | `Nouveau` (ou "New"), `Actif` (ou "Active"), `Discontinué` (ou "Discontinued", "Arrêté") | **Nouveau** par défaut si absent ou non reconnu (valeur par défaut habituelle à la création) |
| Date de réassort | `Restock Date`, `Date réassort`, `Date de réassort`, `Date retour` | Date ISO (`AAAA-MM-JJ`) ou format français (`JJ/MM/AAAA`) | Laissée vide si absente **ou si le format n'est pas reconnu** — jamais de date devinée à partir d'un format ambigu |
| Quantité attendue | `Expected Qty`, `Quantité attendue`, `Qty attendue`, `Quantité réassort`, `Stock attendu` | Nombre entier | Laissée vide |

### Photo produit — toujours hors périmètre de l'import fichier

La photo produit n'est **jamais** lue depuis une colonne du fichier d'import
(un CSV/Excel ne transporte pas d'image) — cette règle du cahier des charges
initial (section 9) reste inchangée même avec un export enrichi. Elle se
règle sur la fiche produit, de trois façons possibles :

1. manuellement, en renseignant une URL http(s) (photo déjà hébergée
   ailleurs) ;
2. pour le catalogue Moken déjà en ligne, via le rapprochement automatique
   avec les photos du site mokenvision.com (cf. section 5 ci-dessous) ;
3. par **téléversement direct d'un fichier** (JPEG, PNG ou WebP, 8 Mo max)
   depuis l'écran Catalogue produit — cf. section 5 bis ci-dessous, pensé
   spécifiquement pour les produits pas encore vendus sur mokenvision.com et
   qui n'ont donc pas encore d'URL publique.

---

## 3. Catégories officielles (valeur du champ "Catégorie")

| Libellé attendu dans le fichier | Valeur enregistrée |
|---|---|
| Premium | `PREMIUM` |
| Classic / Classique | `CLASSIC` |
| Optics / Optique | `OPTICS` |
| Access / Accessoires | `ACCESS` |
| Display / Displays | `DISPLAY` |
| Merch / Merchandising | `MERCH` |
| Goggles | `GOGGLES` |
| Kids | `KIDS` |
| *(toute autre valeur, ou absente)* | `NON_CLASSE` |

Reconnaissance insensible à la casse, aux espaces et aux accents.

---

## 4. Rattachement au catalogue

Rappel (inchangé, cf. section 3 de `cahier-des-charges-import-catalogue.md`) :
le catalogue de rattachement (existant ou nouveau) se choisit **avant**
la lecture du fichier — ce n'est pas une colonne du fichier, quel que soit le
niveau d'enrichissement de l'export.

---

## 5. Photos produit — rapprochement automatique mokenvision.com

Complément à la section "Photo produit" ci-dessus : dans le cadre du
rapprochement effectué avec les photos publiées sur mokenvision.com (voir
`docs/rapprochement-photos-mokenvision.md`), c'est le **modèle** (et si
nécessaire la **couleur**) qui sert de clé de correspondance entre une fiche
produit du catalogue et une photo trouvée sur le site — jamais la Référence
interne, qui n'a pas d'équivalent public sur le site vitrine. Un produit dont
le modèle ne correspond à aucune page du site reste sans photo, à traiter
manuellement (jamais de photo approximative associée automatiquement).

---

## 5 bis. Téléversement direct d'une photo produit (sans URL)

Ajouté en complément du rapprochement mokenvision.com, pour couvrir le cas
des produits qui ne sont pas (encore) vendus sur le site internet et n'ont
donc pas d'URL publique disponible ("certains produits ne sont pas vendu sur
le site internet encore. il le seront plus tard").

- Sur l'écran Catalogue produit, chaque référence dispose d'un bouton
  **Téléverser** (ou **Remplacer** si une photo existe déjà) à côté de sa
  miniature.
- Formats acceptés : JPEG, PNG, WebP. Taille maximale : 8 Mo. Tout autre
  format est refusé avec un message d'erreur explicite, aucun fichier n'est
  écrit sur le serveur dans ce cas.
- Le fichier est stocké par le CRM lui-même (pas besoin d'hébergement
  externe) et servi depuis une URL interne (`/uploads/products/...`) qui est
  enregistrée sur la fiche produit exactement comme le serait une URL
  http(s) classique — les deux mécanismes sont interchangeables sur le même
  champ.
- **Quand le produit devient disponible sur mokenvision.com plus tard**, la
  photo téléversée peut simplement être remplacée par l'URL officielle du
  site (nouveau téléversement, ou saisie manuelle de l'URL) — aucune
  migration particulière n'est nécessaire, jamais de perte de la photo
  précédente tant qu'elle n'est pas explicitement remplacée.
- Comme pour tout remplacement de fichier dans ce CRM, l'ancien fichier n'est
  jamais supprimé du serveur au moment du remplacement (principe "jamais de
  suppression") — seule la fiche produit pointe désormais vers le nouveau.

---

## 6. Historique

- **2026-09-14** — Première version, à la demande du client pour cadrer la
  configuration d'un export enrichi ("Idem pour le catalogue produit").
  Grounded dans le code réellement implémenté et testé
  (`importMapping.js`, `catalogImport.js`) — chaque comportement décrit
  ci-dessus a été vérifié par un import de bout en bout (fichier socle à 9
  colonnes + fichier enrichi couvrant l'intégralité des champs listés
  ci-dessus, création, mise à jour et ré-import idempotent).
- **2026-09-14** — Ajout de la section 5 bis (téléversement direct de photo
  produit sans URL), suite à la demande du client ("prévoit une autre façon
  pour pouvoir uploader les photos produits que le lien Http"). Grounded dans
  le code réellement implémenté et testé de bout en bout : route
  `POST /api/products/:id/photo` (`backend/src/routes/products.js`), test
  API exhaustif (upload valide, format refusé, service statique du fichier,
  URL http(s) classique toujours acceptée en parallèle, chemin arbitraire
  refusé, id inexistant → 404 sans fichier orphelin) et vérification à
  travers l'interface réelle (clic sur le bouton, sélection de fichier,
  miniature affichée après envoi).
- **2026-09-16** — Élévation du champ Code Dolibarr en "ID Dolibarr" (section
  1) avec nouvelle règle de cohérence Référence <-> ID Dolibarr (section 1
  bis), à la demande du client, sur la base d'un exemple réel fourni (fichier
  à 3 onglets SUN 26 / SUN 27 / OPTICS 26). Voir `cahier-des-charges-import-
  catalogue.md` section 7 bis pour le détail complet de la règle, et sa
  section 12 pour la liste des fichiers de code concernés et la vérification
  effectuée.
