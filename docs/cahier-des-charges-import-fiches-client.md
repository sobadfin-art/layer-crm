# Cahier des charges — Import en masse des fiches client

Ce document décrit le fonctionnement attendu de l'import de fiches client (comptes client/prospect)
en masse, réservé au rôle **Administrateur** (cf. `docs/etat-final-prototype-handoff.md`, section 3 :
« Administrateur : catalogue produits, import en masse (catalogue **et** fiches clients), pas
d'accès aux règles commerciales »). Rédigé sur le modèle de
`docs/cahier-des-charges-import-catalogue.md`, en reprenant la structure exacte de la fiche client
telle qu'elle existe réellement dans l'application (table `accounts`, `backend/src/routes/accounts.js`)
plutôt que d'inventer des champs — voir section 12 pour l'historique des points soumis à validation
avant développement (tous résolus).

---

## 1. Objectif

Permettre à l'administrateur de créer ou mettre à jour en masse des fiches client/prospect à partir
d'un fichier externe (Excel ou CSV), sans ressaisie manuelle, en reprenant l'intégralité des champs
administratifs déjà présents sur la fiche client (identité, adresses, contact, informations fiscales
et bancaires, rattachement commercial) — jamais un sous-ensemble arbitraire.

---

## 2. État actuel — ce qui existe déjà et ce qui manque

- **N'existe pas encore** : aucune route backend d'import en masse pour les comptes (contrairement au
  catalogue produits, dont l'import est déjà complet — `catalog-import.js`). Le mécanisme décrit
  ci-dessous est donc entièrement à construire, en s'inspirant du **pattern** de l'import catalogue
  (mapping → aperçu → résumé → application) mais avec sa propre logique : le code d'import catalogue
  est câblé spécifiquement sur la table `products` et n'est pas réutilisable tel quel.
- **Changement de permission nécessaire — portée confirmée (2026-09-14)** : aujourd'hui, le rôle
  ADMINISTRATEUR n'a accès à aucune route de `accounts.js` (`ACCOUNTS_MODULE_ROLES` = Représentant,
  Master Rep, Front desk, Directeur uniquement). Il faut lui ouvrir l'accès en **lecture/écriture
  complète sur la fiche client, au même niveau que le front desk** — pas limité aux seuls champs
  administratifs listés dans ce document — **à l'exception des commandes et du pipeline commercial**,
  qui restent hors de portée de l'Administrateur (cohérent avec « pas d'accès aux règles
  commerciales », section 3 du handoff). Concrètement : `ACCOUNTS_MODULE_ROLES` doit inclure
  ADMINISTRATEUR, mais les routes/vues liées aux commandes et à l'étape du pipeline (`PATCH .../pipeline`)
  doivent rester filtrées pour ce rôle.
- **Toujours hors périmètre Administrateur** : les règles commerciales (remises, frais de port...)
  restent réservées au directeur — l'import ne doit rien y toucher, et l'écran Administrateur n'y
  donne pas accès non plus.
- **Confirmé (2026-09-14) : le fichier source est toujours l'export natif des fiches client depuis
  Dolibarr** — contrairement au catalogue produits, ce n'est pas un fichier à structure libre. Ses
  colonnes sont connues et stables, d'après un extrait réel fourni :
  `Id, Nom, Nom alternatif, État, Adresse, Code postal, Ville, Pays, Téléphone, Tél portable, Email,
  Numéro TVA, Nom du commercial`. Le mapping (étape 2) reste utile en filet de sécurité si le format
  d'export Dolibarr change un jour, mais n'a plus besoin de deviner une structure inconnue comme pour
  l'import catalogue — voir section 5 pour le détail colonne par colonne.

---

## 3. Formats de fichier acceptés

- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)
- Le format d'export Dolibarr fixe déjà les en-têtes attendus (section 2 et 5) ; le mapping (étape 2)
  sert néanmoins de filet de sécurité pour corriger manuellement une correspondance si un en-tête
  diffère (renommage côté Dolibarr, export partiel, etc.), plutôt que d'imposer une nomenclature
  figée qui bloquerait l'import au moindre écart.

---

## 4. Étape 1 — Représentant propriétaire par défaut (obligatoire avant tout mapping)

Contrainte technique incontournable : `owner_rep_id` est un champ **obligatoire** sur la fiche client
(`accounts.owner_rep_id NOT NULL`) — une fiche ne peut jamais exister sans représentant propriétaire,
quel que soit le rôle qui la crée. Avant de lire le contenu du fichier, l'administrateur choisit donc
un **représentant par défaut** dans la liste de l'équipe commerciale (`GET /api/team/members`) :

- **Confirmé (2026-09-14)** : plutôt qu'un rapprochement automatique par nom de famille (ambigu — deux
  représentants peuvent partager un nom), le fichier est **préparé en amont par l'administrateur** en
  remplaçant, dans la colonne « Nom du commercial » de l'export Dolibarr, le nom texte par
  l'**identifiant du représentant tel qu'il existe dans l'application** (ex. remplacer « LE GALL » par
  l'ID du représentant correspondant dans Moken CRM), avant de charger le fichier dans l'import.
- La colonne mappée sur Représentant propriétaire (section 5) est donc lue comme un **identifiant
  direct**, pas comme un nom à faire correspondre par approximation : si l'ID correspond à un
  représentant existant, cette correspondance prévaut pour la ligne, sans ambiguïté possible.
- Si la valeur est absente, vide, ou ne correspond à **aucun** ID de représentant existant, la fiche
  est rattachée au représentant par défaut choisi ici, et la ligne est signalée dans le résumé
  (étape 8) pour vérification manuelle.
- **Confirmé** : cette correspondance Nom ↔ ID est gérée par l'administrateur lui-même, en dehors de
  l'application — pas besoin d'écran ou d'export dédié pour cela côté développement.

**L'import ne peut pas être lancé tant qu'aucun représentant par défaut n'est sélectionné** — même
règle de blocage que le choix de catalogue obligatoire pour l'import produits.

---

## 5. Étape 2 — Mapping des colonnes

Le fichier source étant toujours l'export natif Dolibarr (cf. section 2), le mapping n'est plus une
reconnaissance de motifs sur une structure inconnue comme pour le catalogue : c'est une correspondance
**fixe et connue à l'avance**, calibrée sur l'extrait réel fourni. L'administrateur garde la
possibilité de corriger manuellement chaque correspondance (filet de sécurité si Dolibarr modifie son
format d'export), mais le mapping par défaut n'a plus besoin d'être deviné.

| Colonne Dolibarr (réelle) | Champ cible sur la fiche | Obligatoire | Note |
|---|---|---|---|
| `Id` | Code client Dolibarr (`dolibarr_code_client`) | Oui | Identifiant interne Dolibarr, toujours présent — sert de clé de rapprochement unique, voir section 8. |
| `Nom` | Nom de l'enseigne | Oui | — |
| `Nom alternatif` | **Nom du magasin** (`store_name`) — *nouveau champ à créer sur `accounts`* | Non | **Confirmé** : c'est le nom du magasin, distinct de l'enseigne (ex. ligne 1 : Nom = « Pierre LE GALL », Nom alternatif = « LAYER AGENCY »). Aucun champ équivalent n'existe aujourd'hui sur la fiche — migration à prévoir avant développement de l'import. |
| `État` | Statut du compte (`status`) | Oui | **Confirmé** : `1` = Actif, `0` = Inactif. Mappage direct sur `status` (`ACTIF`/`INACTIF`) — voir section 6. La valeur `ARCHIVE` n'est jamais produite par cet import. |
| `Adresse` | Adresse de facturation **et** de livraison — rue | Non | Une seule adresse dans l'export Dolibarr — **confirmé** : dupliquée sur la facturation ET la livraison (les deux jeux de champs reçoivent la même valeur), modifiable ensuite séparément sur la fiche si besoin. |
| `Code postal` | Adresse de facturation et de livraison — CP | Non | idem |
| `Ville` | Adresse de facturation et de livraison — ville | Non | idem |
| `Pays` | Pays (résolu en code ISO 2 lettres) | Oui | Contient le **nom** du pays en toutes lettres (« France »), pas un code ISO — résolu par correspondance sur `countries.name` (insensible casse/accents). Doit correspondre à l'un des 9 pays seedés (FR, ES, CH, DE, IT, PT, GB, BE, NL), sinon ligne en erreur — voir section 6. |
| `Téléphone` | Téléphone + indicatif pays (`phone_country_code`) | Non | Format local sans indicatif (ex. `0658311963`). **Confirmé** : l'indicatif est dérivé automatiquement du pays résolu (ex. France → +33). |
| `Tél portable` | Mobile + indicatif pays (`mobile_country_code`) | Non | Idem, avec parfois des espaces dans la saisie source (ex. `06 68 31 49 86`) — à normaliser (suppression des espaces) à l'import ; indicatif dérivé du pays comme pour le téléphone. |
| `Email` | Email | Non | Doit être un email valide si renseigné, sinon ligne en erreur. |
| `Numéro TVA` | N° TVA intracommunautaire | Non | — |
| `Nom du commercial` | Représentant propriétaire | Non | **Contient l'ID du représentant** (substitué par l'administrateur avant import, pas le nom Dolibarr tel quel) — voir section 4. Absent/invalide → représentant par défaut, ligne signalée. |

**Champs de la fiche `accounts` qui n'apparaissent jamais dans l'export Dolibarr standard** :
Typologie (toujours importée en « Autre », voir section 6), Master Rep, Contact (nom), Identifiant
fiscal (SIRET/NIF/etc., distinct du n° TVA), IBAN, BIC, Statut mandat SEPA, Régime fiscal (dérivé du
pays si absent). Ces champs ne sont **jamais** importés par ce mécanisme et restent à renseigner
manuellement sur la fiche après import — exactement comme les photos produit pour le catalogue. Le
type de fiche (Client/Prospect) n'apparaît pas non plus dans le fichier mais n'a pas besoin d'être
dérivé : voir section 6, toutes les fiches importées sont des `CLIENT`.

---

## 6. Enums et valeurs dérivées — comportement en cas de valeur inconnue ou absente

- **Typologie — toujours absente de l'export Dolibarr standard** : la colonne n'existe pas dans le
  fichier réel fourni. Conséquence directe : **toute fiche importée par ce mécanisme arrivera avec la
  typologie « Autre »**, systématiquement (le champ typologie étant obligatoire en base, ce fallback
  existant s'applique à 100 % des lignes, pas seulement aux cas exceptionnels — contrairement au
  catalogue produits, « Autre » est une valeur officielle de la liste des 11, pas une catégorie
  technique ajoutée pour l'occasion). L'administrateur doit s'attendre à devoir reclasser les fiches
  une par une ensuite si une typologie précise importe pour le pilotage commercial.
- **Type (Client / Prospect) — confirmé** : cet import ne crée jamais de prospect. Toute fiche importée
  par ce mécanisme est créée en **`CLIENT`**, sans exception. La colonne Type n'existe pas dans le
  fichier et n'a pas besoin d'y être : ce n'est pas une valeur dérivée conditionnelle, c'est une
  constante pour tout cet import.
- **`État` — confirmé, mappé sur le statut du compte** : `1` = Actif, `0` = Inactif. C'est le champ
  `status` de la fiche (`ACTIF`/`INACTIF`) qui est directement piloté par cette colonne, aussi bien à
  la création qu'à la mise à jour d'une fiche existante — contrairement à ce qui était supposé dans la
  version précédente de ce document, ce champ **est** importable pour ce mécanisme spécifique. La
  valeur `ARCHIVE` (3ᵉ état du cycle de vie) n'est jamais produite par l'import : elle reste réservée à
  une action manuelle sur la fiche. *Note technique pour le développement* : la route existante
  `PATCH /api/accounts/:id/status` applique un cycle de transition contrôlé
  (`ACTIF → INACTIF → ARCHIVE`) ; l'import, lui, écrit directement la valeur `status` à la création et
  à la mise à jour, donc en dehors de cette route et de sa logique de transition — à vérifier que ce
  contournement est acceptable pour ce cas d'usage précis.
- **`Nom alternatif` — confirmé, c'est le nom du magasin** : stocké dans un nouveau champ `store_name`
  à ajouter à la fiche `accounts` — voir section 5. Il n'existe pas encore, cette migration est un
  prérequis au développement du mécanisme d'import.
- **Secteur** : jamais importé directement — toujours recalculé automatiquement à partir de la
  typologie (Opticien → secteur Opticien ; toutes les autres typologies → secteur Mode-Surf-Sport),
  exactement comme à la création manuelle d'une fiche. Avec la typologie systématiquement « Autre »
  (cf. ci-dessus), le secteur dérivé sera lui aussi systématiquement Mode-Surf-Sport pour ces imports,
  à corriger fiche par fiche si besoin après reclassement de la typologie.
- **Pays** : le fichier Dolibarr contient un **nom de pays en toutes lettres** (« France »), pas un
  code ISO — résolution proposée par correspondance sur `countries.name` (insensible à la casse et aux
  accents). Contrairement à la typologie, il n'existe **aucune valeur de repli** pour un pays inconnu
  (le pays est une clé étrangère obligatoire vers une liste fermée de 9 pays). Une ligne dont le nom de
  pays ne correspond à aucun pays connu est en **erreur** et n'est pas importée (comptabilisée dans le
  résumé, étape 8).
- **Indicatifs téléphoniques (`phone_country_code` / `mobile_country_code`) — confirmé** : absents de
  l'export Dolibarr (numéros saisis au format local, sans indicatif) — ils sont dérivés automatiquement
  du pays résolu (ex. France → +33) et renseignés à l'import plutôt que laissés vides.
- **Régime fiscal** : si absent du fichier ou de la colonne mappée, dérivé automatiquement du pays
  (France → régime standard ; Espagne/Allemagne/Italie/Portugal/Belgique/Pays-Bas → intracommunautaire
  HT ; Suisse/Royaume-Uni → export hors UE HT), exactement comme à la création manuelle. Le régime
  « Recargo de Equivalencia » n'est **jamais** attribué automatiquement, à l'import comme en création
  manuelle — uniquement modifiable ensuite au cas par cas sur la fiche.
- **Statut du mandat SEPA** : si absent, `NON_RENSEIGNE` (comportement par défaut existant).
- **Étape du pipeline** : toujours initialisée à **« Nouveau »** à la création, quelle que soit la
  ligne du fichier — comme à la création manuelle. Non importable.

---

## 7. Étape 3 — Aperçu

Affichage des 10 premières lignes du fichier (colonnes brutes), pour vérification visuelle avant tout
traitement — identique au mécanisme de l'import catalogue.

---

## 8. Étape 4 — Résumé et mode d'import

Avant validation définitive, le système calcule et affiche :

- Nombre total de lignes détectées.
- Nombre de **nouvelles fiches** (aucune correspondance trouvée).
- Nombre de **fiches à mettre à jour** (correspondance trouvée — voir clé de rapprochement ci-dessous).
- Nombre d'**erreurs** (nom absent, type invalide, typologie absente *sans* pouvoir de repli — en
  réalité couvert par le fallback « Autre », donc essentiellement : pays manquant ou inconnu, email
  syntaxiquement invalide si renseigné).

**Clé de rapprochement** (pour distinguer création de mise à jour) : **la colonne `Id` de l'export
Dolibarr, mappée sur `dolibarr_code_client`** (section 5). Confirmé : l'import provenant toujours
directement de la fiche client Dolibarr, cette colonne est systématiquement présente et suffit à elle
seule — pas de clé de repli (nom + pays) nécessaire, contrairement à ce qui était proposé
précédemment dans ce document.

**Confirmé** : la base `accounts` est vide aujourd'hui — aucune fiche n'existe encore dans le CRM. Le
premier import sera donc une création intégrale de la base clients à partir de Dolibarr, sans risque de
doublon lié à des fiches déjà créées manuellement en parallèle. Les imports suivants (mises à jour
incrémentales depuis Dolibarr) s'appuieront sur `dolibarr_code_client`, renseigné dès la création.

Comme pour le catalogue, l'administrateur choisit ensuite le mode d'application : créer les nouvelles
fiches **et** mettre à jour les existantes (par défaut), créer uniquement les nouvelles, ou mettre à
jour uniquement les existantes.

---

## 9. Comportement à l'import

- Si la fiche existe déjà (correspondance trouvée) → mise à jour des champs mappés uniquement ; les
  champs non mappés dans le fichier (ex. historique d'interactions, commandes, pièces jointes) ne sont
  jamais touchés.
- Si la fiche n'existe pas → création avec, pour les champs non couverts par le fichier, les mêmes
  valeurs par défaut qu'une création manuelle (étape de pipeline « Nouveau », secteur dérivé de la
  typologie, régime fiscal dérivé du pays si non fourni, statut mandat SEPA `NON_RENSEIGNE` si non
  fourni) — **à l'exception du statut du compte**, qui n'est pas mis à « Actif » par défaut pour cet
  import mais directement piloté par la colonne `État` du fichier (Actif/Inactif — voir section 6).
- **Sécurité de l'import** (mêmes garanties que l'import catalogue) : aucune fiche absente du fichier
  n'est désactivée ou modifiée automatiquement ; aucune donnée n'est écrasée silencieusement sans que
  le résumé (étape 8) l'ait annoncée ; chaque import réussi est journalisé (date, auteur, nombre de
  créations, nombre de mises à jour, nombre d'erreurs) — sur le modèle de `catalog_import_logs`, à
  répliquer pour les fiches client.

---

## 10. Ce qui n'est PAS couvert par l'import de fichier

- **Les pièces jointes** (photos, PDF) : la table `attachments` existe déjà en base (liée à
  `accounts`) mais n'est reliée à aucune route API pour l'instant — ni en lecture, ni en écriture,
  import compris. Même traitement que les photos produit dans l'import catalogue : à régler
  individuellement sur la fiche une fois ce mécanisme construit, hors périmètre de cet import.
- **L'historique d'interactions et les commandes** : ce sont des données qui se construisent par
  l'usage de l'application, jamais par import initial d'une fiche.
- **Les règles commerciales** : aucun champ de remise, de condition de paiement ou de taxe n'est
  rattachable à une fiche client par ce mécanisme — elles restent gérées exclusivement par le
  directeur, par portée (Globale/Pays/Représentant), jamais fiche par fiche.

---

## 11. Modèle de fichier

**Décision revue et implémentée le 2026-09-16** — cette section envisageait initialement de retirer
purement et simplement cette fonctionnalité, faute d'utilité perçue (le fichier source étant
normalement un export direct depuis Dolibarr, dont le format est déjà fixé par Dolibarr lui-même,
contrairement au catalogue produits rempli à la main). Le client a depuis demandé explicitement ce
bouton également pour les fiches client ("un autre bouton doit être prévu pour récupérer le modèle
import pour les fiches clients"). Un bouton **"Télécharger un modèle"**, sur l'écran d'upload de
l'assistant d'import, télécharge donc désormais un fichier Excel vierge
(`modele-import-fiches-client.xlsx`, un seul onglet "Fiches clients") listant les colonnes du socle
au vocabulaire Dolibarr standard (section 5) : Id, Nom, Nom alternatif, État, Adresse, Code postal,
Ville, Pays, Téléphone, Tél portable, Email, Numéro TVA, Nom du commercial — utile comme aide-mémoire
ou pour une saisie manuelle ponctuelle même quand l'essentiel des imports reste un export Dolibarr
tel quel.

---

## 12. Points confirmés (historique des arbitrages)

Sur le modèle de la section 8 de `docs/etat-final-prototype-handoff.md` (« Ce qui reste explicitement
à compléter ») — conservé ici comme historique des points qui ont été soumis à validation avant
développement, plutôt que tranchés unilatéralement dans ce document.

**Tous les points sont désormais résolus, grâce à vos messages du 14/09** :

- Clé de rapprochement : `Id` → `dolibarr_code_client`, sans clé de repli (section 8).
- Base `accounts` vide aujourd'hui : le premier import est une création intégrale (section 8).
- `État` : `1` = Actif, `0` = Inactif, mappé sur `status` (section 6).
- `Nom alternatif` = nom du magasin, nouveau champ `store_name` à créer (section 5 et 6).
- Adresse unique de l'export dupliquée sur facturation **et** livraison (section 5).
- Indicatifs téléphoniques dérivés automatiquement du pays résolu (section 6).
- Type de fiche toujours `CLIENT`, jamais `PROSPECT`, pour cet import (section 6).
- Représentant : rapprochement par ID, saisi par substitution manuelle dans le fichier par
  l'administrateur (pas de rapprochement par nom, pas d'écran dédié à construire — cette
  correspondance reste gérée par l'administrateur en dehors de l'application) (section 4).
- BICHOLAT est un vrai représentant, pas un exemple fictif.
- Accès Administrateur aux fiches après import : **lecture/écriture complète, au même niveau que le
  front desk, à l'exception des commandes et du pipeline commercial** qui restent hors de portée
  (section 2).

**Ce cahier des charges est maintenant complet et prêt pour le développement.**
