# Cahier des charges — Inventaire complet des champs importables (fiches client)

Ce document liste, champ par champ, tout ce que l'import de fiches client (cf.
`cahier-des-charges-import-fiches-client.md` pour la mécanique de l'assistant
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

- **Socle** : présents dans l'export Dolibarr standard actuel (13 colonnes).
- **Enrichi** : reconnus si le fichier les fournit, absents de l'export
  standard actuel. C'est sur ces champs qu'un export enrichi peut être
  construit pour renseigner un maximum d'informations en une seule fois.

---

## 1. Champs socle

| Champ cible | Colonne(s) reconnue(s) (motifs) | Obligatoire | Format / valeurs acceptées | Comportement si absent ou non reconnu |
|---|---|---|---|---|
| Id | `Id` | **Oui** | Texte libre, unique par fiche côté Dolibarr | Ligne rejetée (erreur "Id manquant") — c'est la clé de rapprochement unique (`dolibarr_code_client`), aucun repli possible |
| Nom | `Nom` | **Oui** | Texte libre | Ligne rejetée (erreur "Nom manquant") |
| Pays | `Pays` | **Oui** | Nom du pays en toutes lettres, en français, correspondant exactement à un pays du référentiel (voir liste section 4) | Ligne rejetée ("Pays manquant" ou "Pays inconnu : ...") — aucun pays deviné |
| Nom alternatif | `Nom alternatif`, `Nom du magasin`, `Nom magasin` | Non | Texte libre | Champ `store_name` laissé vide |
| État | `État`, `Statut` | Non | `1` = Actif, `0` = Inactif (toute autre valeur, ou absence, est traitée comme Actif) | Statut **Actif** par défaut à la création ; si mappé mais valeur ni `1` ni `0`, également Actif — jamais rejeté pour ce seul motif |
| Adresse (facturation) | `Adresse`, `Adresse facturation` | Non | Texte libre | Laissé vide. **Si aucune colonne "livraison" dédiée n'est fournie** (voir section 2), cette adresse est automatiquement dupliquée en adresse de livraison |
| Code postal (facturation) | `Code postal`, `CP`, `Code postal facturation` | Non | Texte libre | Idem adresse |
| Ville (facturation) | `Ville`, `Ville facturation` | Non | Texte libre | Idem adresse |
| Téléphone | `Téléphone`, `Tel` | Non | Numéro, espaces retirés automatiquement | Laissé vide. L'indicatif pays (`+33`, `+34`...) est **toujours dérivé automatiquement** du pays résolu de la ligne — jamais lu dans une colonne du fichier |
| Tél. portable | `Tél portable`, `Téléphone portable`, `Mobile`, `Portable` | Non | Numéro, espaces retirés automatiquement | Laissé vide. Indicatif dérivé automatiquement comme ci-dessus |
| Email | `Email`, `Mail`, `Courriel` | Non | Doit être une adresse email syntaxiquement valide si la cellule n'est pas vide | **Ligne rejetée** si la colonne est mappée et la valeur non vide mais invalide (erreur "Email invalide : ...") — c'est le seul champ enrichi/optionnel dont une valeur incorrecte bloque la ligne |
| Numéro TVA | `Numéro TVA`, `TVA`, `Num TVA` | Non | Texte libre | Laissé vide |
| Nom du commercial (ID représentant) | `Nom du commercial`, `Commercial`, `Représentant` | Non | **UUID de l'utilisateur dans l'app** (Représentant ou Master Rep) — pas le nom Dolibarr tel quel. Substitution à faire par l'administrateur avant import (remplacer le nom du commercial Dolibarr par l'ID du représentant correspondant dans l'app) | Si absent, ou si l'ID ne correspond à aucun Représentant/Master Rep actif : repli automatique sur le **représentant par défaut** choisi en début d'import (jamais bloquant, jamais rejeté) |

---

## 2. Champs enrichis

Aucun de ces champs n'existe dans l'export Dolibarr standard actuel. Ils ne
sont utiles que si l'export est spécifiquement configuré pour les fournir.

| Champ cible | Colonne(s) reconnue(s) (motifs) | Format / valeurs acceptées | Comportement si absent ou non reconnu |
|---|---|---|---|
| Type | `Type`, `Client/Prospect` | `Client` ou `Prospect` (insensible casse/accents) | **CLIENT** par défaut — y compris si la colonne est mappée mais la valeur ne vaut ni "Client" ni "Prospect" |
| Typologie | `Typologie`, `Type de point de vente` | Un des 11 libellés officiels (voir section 3) | **Autre** par défaut si absente ou non reconnue. Le **secteur** (Opticien / Mode-Surf-Sport) n'est **jamais** à fournir : il est toujours recalculé automatiquement à partir de la typologie |
| Adresse (livraison) | `Adresse livraison` | Texte libre | Voir règle de duplication en section 2bis ci-dessous |
| Code postal (livraison) | `Code postal livraison` | Texte libre | Idem |
| Ville (livraison) | `Ville livraison` | Texte libre | Idem |
| Contact | `Contact`, `Interlocuteur`, `Nom du contact` | Texte libre | Laissé vide |
| Identifiant fiscal | `Identifiant fiscal`, `SIRET`, `NIF`, `Tax ID` | Texte libre (SIRET pour la France, équivalent local pour les autres pays — voir libellé par pays section 4) | Laissé vide |
| IBAN | `IBAN` | Texte libre | Laissé vide |
| BIC | `BIC`, `Swift` | Texte libre | Laissé vide |
| Statut mandat SEPA | `Mandat SEPA`, `Statut mandat SEPA` | `Non renseigné`, `En attente`, `Valide`, `Révoqué` (insensible casse/accents) | **Non renseigné** par défaut si absent ou non reconnu — jamais laissé vide en base (le champ n'accepte pas de valeur nulle) |
| Régime fiscal | `Régime fiscal`, `Tax regime` | Une valeur **exacte** parmi : `FRANCE_STANDARD`, `INTRACOMMUNAUTAIRE_HT`, `RECARGO_EQUIVALENCIA`, `EXPORT_HORS_UE_HT` | Si absent ou non reconnu (y compris un libellé approximatif) : **dérivé automatiquement du pays** à la création (voir règle section 4) — jamais deviné à partir d'un libellé approchant. `RECARGO_EQUIVALENCIA` n'est **jamais** choisi automatiquement, uniquement via cette colonne, ligne par ligne, pour un client espagnol identifié comme tel |
| Master Rep | `Master Rep`, `Master Représentant` | UUID de l'utilisateur dans l'app, avec le rôle **Master Rep** exclusivement | Si absent, ou si l'ID ne correspond à aucun Master Rep actif : laissé vide (`null`) — **pas de repli automatique**, à la différence du commercial (Nom du commercial ci-dessus). C'est un champ distinct de "Nom du commercial" : un compte peut avoir un représentant de suivi (owner) différent de son Master Rep de rattachement |

### 2bis. Règle de duplication de l'adresse de livraison

- Si **aucune** des 3 colonnes livraison (`Adresse livraison`, `Code postal
  livraison`, `Ville livraison`) n'est mappée dans le fichier : l'adresse de
  livraison est **automatiquement dupliquée** depuis l'adresse de facturation,
  champ par champ, pour chaque ligne (comportement de l'export standard,
  confirmé).
- Si **au moins une** colonne livraison est mappée : chaque champ livraison
  prend alors la valeur de **sa propre colonne** dédiée, ligne par ligne —
  y compris si cette cellule est vide pour une ligne donnée (elle reste
  vide, elle n'est **pas** repliée sur la facturation au cas par cas). Un
  export enrichi qui fournit ces 3 colonnes doit donc les remplir pour
  toutes les lignes où une adresse de livraison est nécessaire.

---

## 3. Typologies officielles (valeur du champ "Typologie")

| Libellé attendu dans le fichier | Valeur enregistrée | Secteur dérivé automatiquement |
|---|---|---|
| Opticien | `OPTICIEN` | Opticien |
| Surf Shop | `SURF_SHOP` | Mode-Surf-Sport |
| Fashion Store | `FASHION_STORE` | Mode-Surf-Sport |
| Skate Shop | `SKATE_SHOP` | Mode-Surf-Sport |
| Ski Shop | `SKI_SHOP` | Mode-Surf-Sport |
| Concept Store | `CONCEPT_STORE` | Mode-Surf-Sport |
| Uship | `USHIP` | Mode-Surf-Sport |
| Bike Store | `BIKE_STORE` | Mode-Surf-Sport |
| Key Account | `KEY_ACCOUNT` | Mode-Surf-Sport |
| Distributor / Distributeur | `DISTRIBUTOR` | Mode-Surf-Sport |
| Autre / Other | `AUTRE` | Mode-Surf-Sport |

Reconnaissance insensible à la casse, aux espaces et aux accents (ex. "surf
shop", "SURF SHOP", "Surf-Shop" sont tous reconnus).

---

## 4. Référentiel pays (colonne "Pays", obligatoire)

Le nom doit correspondre **exactement** (insensible casse/accents) à l'un de
ces 9 pays actuellement au référentiel. Un pays absent de cette liste fait
échouer la ligne ("Pays inconnu") — aucun pays n'est ajouté automatiquement à
l'import.

| Nom attendu | Code | Indicatif téléphonique dérivé | Libellé identifiant fiscal local | Régime fiscal dérivé par défaut (si colonne "Régime fiscal" absente/non reconnue) |
|---|---|---|---|---|
| France | FR | +33 | SIRET | France standard |
| Espagne | ES | +34 | NIF/CIF | Intracommunautaire HT |
| Allemagne | DE | +49 | Steuernummer | Intracommunautaire HT |
| Italie | IT | +39 | Partita IVA | Intracommunautaire HT |
| Portugal | PT | +351 | NIF/NIPC | Intracommunautaire HT |
| Belgique | BE | +32 | N° d'entreprise BCE | Intracommunautaire HT |
| Pays-Bas | NL | +31 | KVK/BTW | Intracommunautaire HT |
| Suisse | CH | +41 | IDE | Export hors UE HT |
| Royaume-Uni | GB | +44 | Company Number | Export hors UE HT |

---

## 5. Ce qui n'est jamais lu dans le fichier, quelle que soit la colonne fournie

- **Le secteur** (Opticien / Mode-Surf-Sport) — toujours recalculé depuis la
  typologie, jamais saisi.
- **Les indicatifs téléphoniques** — toujours dérivés du pays résolu, jamais
  lus dans une colonne dédiée.
- **Le taux de TVA à l'export Dolibarr** — dérivé du régime fiscal au moment
  de l'export, jamais du pays seul ni d'une colonne du fichier d'import.

## 6. Ce qui reste hors périmètre de cet import

- La **photo**/logo de la fiche client n'existe pas comme champ du modèle
  actuel — sans objet ici (à la différence du catalogue produit, cf. l'autre
  cahier des charges).
- La création de **prospects** par ce mécanisme reste possible via la colonne
  enrichie "Type", mais l'export Dolibarr standard actuel ne fournit que des
  clients (actifs ou inactifs) : voir section 6 de
  `cahier-des-charges-import-fiches-client.md`.

---

## 7. Historique

- **2026-09-14** — Première version, à la demande du client pour cadrer la
  configuration d'un export Dolibarr enrichi ("un maximum d'info"). Grounded
  dans le code réellement implémenté et testé (`importMappingAccounts.js`,
  `accountsImport.js`) — chaque comportement décrit ci-dessus a été vérifié
  par un import de bout en bout (fichier socle à 13 colonnes + fichier
  enrichi couvrant l'intégralité des champs listés ci-dessus, création et
  mise à jour).
