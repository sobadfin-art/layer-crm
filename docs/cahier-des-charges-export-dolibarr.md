# Cahier des charges — Export commandes vers Dolibarr

Ce document liste précisément les informations à obtenir de votre instance Dolibarr pour construire un mapping fiable entre l'application (catalogue, clients, commandes) et l'import Dolibarr. À faire valider par la personne qui administre votre Dolibarr (ou votre intégrateur).

---

## 1. Version et mode d'accès à Dolibarr

- **Numéro de version Dolibarr** (ex. 19, 21, 23) — les noms de champs et le module d'import varient selon la version.
- **Mode d'intégration prévu** :
  - Import fichier (CSV/Excel) via le module "Import" natif de Dolibarr → c'est le scénario par défaut de l'app actuellement.
  - Ou API REST Dolibarr → nécessite une clé API (`DOLAPIKEY`), l'URL de l'instance, et les droits API activés.
- Si API : confirmer que le module API REST est activé dans Dolibarr (Configuration → Modules → API REST).

---

## 2. Identification produit

- **Quel champ Dolibarr sert de clé unique produit à l'import ?**
  - `ref` (référence produit, le plus courant) — dans ce cas, la référence utilisée dans l'app (ex. `MKNF03-CRST-TORT-GRN`) doit être **strictement identique** à celle déjà en base dans Dolibarr, y compris la casse et les tirets.
  - Ou identifiant interne Dolibarr (`rowid` / `fk_product`) — dans ce cas il faut un tableau de correspondance SKU app ↔ ID Dolibarr.
- **Les produits existent-ils déjà dans Dolibarr, ou doivent-ils être créés à l'import ?**
  - S'ils existent déjà : confirmer que 100% des SKU de l'app y sont déjà présents avec la même référence.
  - S'ils doivent être créés : quels champs sont obligatoires côté Dolibarr à la création d'un produit (catégorie comptable, TVA par défaut, unité de vente...) ?
- **Gestion du stock/entrepôt** : si Dolibarr suit le stock par entrepôt (`fk_entrepot`), indiquer l'entrepôt à utiliser (un seul entrepôt, ou un entrepôt par pays/représentant ?).

---

## 3. Identification client (tiers)

- **Clé de rapprochement du tiers** :
  - `code_client` (code client Dolibarr, ex. `CU0042`) — généré par Dolibarr, il faut savoir comment le récupérer pour les clients déjà existants.
  - Ou SIRET / n° TVA intracommunautaire — plus fiable si vous voulez rapprocher automatiquement sans dépendre du code interne Dolibarr.
  - Ou raison sociale exacte — le moins fiable (risque de doublons en cas de faute de frappe).
- **Nouveaux prospects devenus clients** : quand un rep crée un prospect dans l'app qui n'existe pas encore dans Dolibarr, faut-il :
  - Créer le tiers dans Dolibarr **avant** la première commande (via un import "tiers" séparé, déclenché par le front desk) ?
  - Ou laisser le module d'import Dolibarr créer le tiers automatiquement à la volée depuis le fichier de commande ?
- **Champs tiers obligatoires côté Dolibarr** à la création (ex. code compta, type de tiers, régime TVA) — à lister pour que le front desk sache quoi compléter avant l'export.
- **Représentant commercial affecté au tiers** (`fk_user` côté Dolibarr) : correspondance entre le nom du rep dans l'app et son identifiant utilisateur Dolibarr.

---

## 4. Structure de la commande dans Dolibarr

- **Quel objet Dolibarr reçoit la commande ?**
  - Commande client directement (`llx_commande` + `llx_commandedet`) — scénario actuellement prévu dans l'app.
  - Ou passage par un devis (`llx_propal`) d'abord, converti manuellement en commande ensuite ?
- **Statut par défaut à l'import** : brouillon, validée, ou "à valider manuellement" par le front desk après import ?
- **Référence externe** : Dolibarr a un champ "Réf. client" (`ref_client`) sur la commande — faut-il y placer l'identifiant interne de l'app (ex. `o12`) pour garder la traçabilité entre les deux systèmes ?
- **Devise** : uniquement EUR, ou faut-il gérer le CHF pour les commandes Suisses ?

---

## 5. Lignes de commande

- **Correspondance des colonnes attendues par votre import Dolibarr** (le module Import est configurable, donc à confirmer précisément) :
  - Référence produit
  - Quantité
  - Prix unitaire HT
  - Taux de remise (%) ou montant remisé
  - Taux de TVA (`fk_tva` dans Dolibarr — nécessite l'ID exact du taux configuré, pas juste "20%")
  - Unité de mesure si applicable
- **Gestion des lignes "Offert" (displays, articles gratuits)** : Dolibarr attend-il un prix à 0, ou une ligne de remise à 100%, ou un champ spécifique "gratuit" ?

---

## 6. Conditions de paiement et de règlement

- **`fk_cond_reglement`** (délai de paiement — ex. "30 jours", "Comptant") : Dolibarr utilise un identifiant interne, pas du texte libre. Besoin de la liste des conditions déjà configurées dans votre Dolibarr avec leurs ID.
- **`fk_mode_reglement`** (mode de règlement — virement, prélèvement SEPA, chèque...) : idem, liste des modes configurés avec leurs ID.
- **Prélèvement SEPA** : si Dolibarr gère les prélèvements (module Prélèvements), quel format attend-il pour l'IBAN/BIC et la référence de mandat (RUM) ? Généralement rattachés au tiers (`llx_societe_rib`), pas à la commande — à confirmer.

---

## 7. Fréquence et déclenchement

- **Qui déclenche l'import dans Dolibarr** : le front desk manuellement (scénario actuel : téléchargement du fichier puis import via l'interface Dolibarr), ou un import automatique programmé ?
- **Fréquence attendue** : à la commande, par lot quotidien, ou autre ?

---

## Ce que je peux faire dès que j'ai ces réponses

Une fois ces points confirmés, je peux :
1. Ajuster le format du fichier d'export (colonnes, ordre, encodage, séparateur) pour qu'il corresponde exactement à ce qu'attend le module Import de votre Dolibarr.
2. Mettre à jour le mapping des conditions de paiement et taux de TVA avec les vrais identifiants Dolibarr.
3. Si vous partez sur l'API plutôt que le fichier, basculer l'intégration sur des appels API directs (plus fiable, sans étape manuelle pour le front desk).

Le point le plus bloquant à clarifier en premier : **la clé de rapprochement produit et client** (section 2 et 3) — sans ça, impossible de garantir que l'import ne crée pas de doublons.
