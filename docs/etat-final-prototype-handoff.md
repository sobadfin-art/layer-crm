# État final du prototype — à transmettre à Claude Code

Ce document consolide tout ce qui a été défini au fil des itérations, pour que rien ne se perde au moment de démarrer le développement réel. À donner à Claude Code **avec** : le fichier prototype (`prototype-crm-commercial.jsx`), le cahier des charges export Dolibarr, le cahier des charges import catalogue, et le plan de développement.

---

## 1. Catégories de produits (liste officielle, ne pas en inventer d'autres)

**Premium, Classic, Optics, Access, Display, Merch, Goggles, Kids**

- "Kids" = les anciennes lignes non classées (Mini Rocket, Mini Rob...) — catégorie officielle à part entière, pas un statut temporaire.
- "Non classé" reste utilisé uniquement comme filet de sécurité pour les imports dont la catégorie ne correspond à aucune valeur connue — jamais choisi automatiquement à la place d'une vraie catégorie.

---

## 2. Catalogues produits transmis

Deux catalogues réels ont été importés et sont intégrés directement dans le prototype (`INITIAL_CATALOG`) :

| Catalogue | Références | Contenu |
|---|---|---|
| **2026 SUNGLASSES** | 195 | Premium, Classique, Accessoires, Displays, Merchandising, Goggles, Kids |
| **Optic 2026** | 150 | Catégorie Optics uniquement |

Pour chaque référence : `ref`, `label`, `model`, `color`, `category`, `collection` (nom de gamme d'origine), `catalogName`, `photoUrl` (vide, à compléter), `priceFR`, `priceExport`, `priceCH`, `rrp`, `qty`, `stockStatus`, `restockDate`, `expectedQty`, `productStatus`, `lastModified`, `modifiedBy`.

**Important sur les prix** : `priceFR` a été rempli avec le prix de référence à markup ×2,3 de ton fichier (uniquement pour la France et l'Espagne — l'Espagne utilise la même grille que la France, cf. section 5). `priceExport` et `priceCH` sont vides — à compléter par l'administrateur, ce ne sont pas des données que j'ai inventées.

Plusieurs catalogues doivent rester **sélectionnables simultanément** (multi-sélection) par le représentant avant de passer commande, par l'administrateur (catalogues actifs) et par le directeur (visibilité).

---

## 3. Rôles et permissions (résumé)

| Rôle | Accès principal |
|---|---|
| **Représentant** | Ses clients uniquement, prise de commande, agenda, tâches, Data (Bestsellers + Customer Performance) |
| **Master Rep** | Suit les représentants qui lui sont affectés (objectifs en lecture seule, tâches, agenda), voit et commande pour leurs clients — ne fixe jamais d'objectif |
| **Front desk** | Toutes les fiches clients et commandes, vérifie et exporte vers Dolibarr, gère le SAV, notifié en temps réel des nouvelles fiches/commandes |
| **Directeur commercial** | Vue globale, fixe les objectifs (CA et précommande, multi-secteur/multi-catégorie), gère l'équipe (reps + Master Reps), accès complet à Data (Bestsellers/Analytics/Extraction), **a aussi un accès direct à la vue Front desk** |
| **Administrateur** | Catalogue produits (CRUD, recherche, suppression de catalogue), import en masse (catalogue **et** fiches clients), pas d'accès aux règles commerciales |

Cloisonnement : chaque client a un `ownerRep` (représentant propriétaire) et optionnellement un `masterRep` — les deux peuvent être affectés indépendamment, y compris en même temps, par le front desk, l'admin ou le directeur (jamais par le représentant lui-même, qui est automatiquement propriétaire de ce qu'il crée).

Le directeur dispose en plus d'une **vue Carte** de tous les clients/prospects, filtrable (multi-sélection) par type, typologie, représentant et Master Rep — outil de visualisation, distinct de l'outil de tournée du représentant.

---

## 4. Fiche client — champs actuels

Identité, type (client/prospect), pays, typologie (11 valeurs : Opticien, Surf Shop, Fashion Store, Skate Shop, Ski Shop, Concept Store, Uship, Bike Store, Key Account, Distributor, Autre), secteur dérivé (Opticien / Mode-Surf-Sport), adresse de facturation **et** de livraison (rue/CP/ville séparés), contact, téléphone **et** mobile avec indicatifs pays, email, identifiant fiscal (libellé dynamique selon le pays : SIRET, NIF/CIF, Steuernummer, Partita IVA, NIF/NIPC, Company Number, n° d'entreprise BCE, KVK/BTW, IDE), n° TVA, **IBAN + BIC**, statut du mandat SEPA, pièces jointes (photos/PDF), historique d'interactions (avec dictée vocale), toutes les commandes, `wonDate`/`lostDate` (pour le comparatif de portefeuille N vs N-1), `ownerRep`, `masterRep` (les deux affectables indépendamment, y compris à la création, par front desk/admin/directeur).

---

## 5. Règles commerciales — mécanique générale

Aucune valeur n'est codée en dur ; tout passe par la table de règles (`businessRules`), gérée par le directeur, avec portée Globale / Pays / Représentant :

- **Remise par catégorie** : catégorie + taux (%) configurables.
- **Remise combo** : plusieurs catégories + taux, ne s'applique que si **toutes** les catégories du combo sont présentes ensemble dans la commande.
- **Frais de port** : montant par défaut (actuellement 9,60 € HT) **et** seuil optionnel d'offre automatique — plus un bouton manuel "Offrir" dans le récapitulatif, indépendant du seuil.
- **Conditions de paiement**, **Taxe**, **Export** (mapping Dolibarr) : entités prévues, valeurs à compléter.
- Règle spécifique France + Espagne : ces deux pays partagent la même grille tarifaire (`priceFR`).

---

## 6. Prise de commande — éléments du récapitulatif

- Sélection des catalogues actifs (multi-choix)
- Recherche produit par libellé/modèle
- Remise par catégorie (bouton, taux piloté par les règles)
- Article "Offert" (toggle individuel, notamment pour les displays)
- Case **Précommande** (comptabilisée séparément du CA ferme partout : dashboards, objectifs, exports)
- **Reliquat** : un produit "Réassort prévu" reste commandable, la ligne est notifiée "reliquat — livraison tardive" avec date d'expédition si la commande est ferme
- Date de livraison souhaitée (calendrier) + note libre pour le front desk
- Bloc "Frais de port" avec bouton offrir/ne pas offrir
- Totaux : quantité totale, montant marchandise, frais de port, total commande, et sous-total par catégorie avec nombre d'unités

---

## 7. Objectifs

Assignables par représentant, **multi-secteur** et **multi-catégorie** simultanément, avec un type **Chiffre d'affaires** ou **Précommande** distinct. Visibles en lecture seule par le Master Rep sur son équipe, et sur la fiche représentant consolidée (objectif, tâches, rendez-vous à venir) utilisée par directeur et Master Rep.

---

## 8. Ce qui reste explicitement à compléter (ne pas inventer ces valeurs)

- `priceExport` et `priceCH` sur la majorité des références
- Les vrais taux de remise (les 10 %/15 % actuels sont des valeurs de démonstration reprises du prototype d'origine, pas des données client)
- Le seuil réel d'offre des frais de port
- Les identifiants Dolibarr exacts (ref produit, code client, conditions de paiement/TVA — cf. cahier des charges dédié)
- Les photos produit (aucune n'est chargée, hors les 3 récupérées depuis MokenVision.com à titre de test)

---

## 9. Fichiers à donner à Claude Code au démarrage

1. `prototype-crm-commercial.jsx` — référence visuelle et logique fonctionnelle complète
2. `cahier-des-charges-export-dolibarr.md`
3. `cahier-des-charges-import-catalogue.md`
4. `plan-developpement-claude-code.md`
5. Ce document
