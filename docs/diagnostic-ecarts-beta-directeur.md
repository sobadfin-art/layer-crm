# Diagnostic — Retours de test bêta (profil Directeur)

Réponse point par point au document de retours reçu, après vérification directe dans le code et dans les documents de cadrage d'origine (`etat-final-prototype-handoff.md`, cahiers des charges, README). Chaque point est classé dans une des quatre catégories suivantes, pour éviter de mélanger « bug à corriger », « fonctionnalité déjà là mais pas trouvée » et « nouvelle demande qui dépasse ce qui avait été cadré au départ » :

- 🐞 **Bug réel** — confirmé dans le code, à corriger.
- ✅ **Déjà existant** — la fonctionnalité est présente et fonctionnelle ; le point ci-dessous explique où la trouver.
- 📐 **Décision déjà documentée** — absente volontairement, pour une raison déjà écrite noir sur blanc dans le projet (le plus souvent : donnée non disponible). Réintégrer ce point suppose de revenir sur cette décision, pas juste de « corriger un oubli ».
- 🆕 **Écart réel par rapport au cadrage initial** — jamais construit avec ce niveau de détail ; le document de cadrage d'origine (handoff) prévoyait quelque chose de plus simple. C'est une vraie extension de périmètre, pas une régression.

---

## 1. Interface générale / Navigation

### Notifications — 🐞 Bug réel
Confirmé : l'icône cloche est coincée dans la même rangée que le sélecteur de langue (FR/EN/ES), sur une sidebar large de 210px seulement. Cette rangée déborde sur certaines largeurs d'écran, ce qui a le même effet que le bug du bouton Logout déjà identifié et corrigé (voir plus bas) : l'icône se retrouve visuellement décalée par-dessus le contenu principal. Le panneau de notifications, positionné en absolu par rapport à cette icône, hérite du même décalage — ce qui peut expliquer qu'aucune notification ne semblait accessible au clic (le panneau s'ouvre, mais au mauvais endroit ou en partie masqué).
À corriger : repositionner la cloche hors de cette rangée surchargée, avec le même traitement que celui déjà appliqué au bouton de déconnexion.
Point à vérifier une fois corrigé : il est possible qu'il n'y ait simplement eu aucune notification de test à afficher (l'état « aucune notification » est un texte normal, pas une erreur) — à confirmer une fois le positionnement réparé.

### Logout / Déconnexion — 🐞 Déjà corrigé
C'était le même bug que la cloche (rangée du haut qui déborde). Corrigé lors du dernier échange : le bouton est maintenant en bas de la sidebar, sous le nom et le rôle, avec le libellé « Déconnexion » bien visible. Fichiers déjà livrés (`AppShell.jsx`, `styles.css`) — à uploader sur GitHub si ce n'est pas encore fait.

---

## 2. Tableau de bord Directeur

### Ce qui est déjà présent — ✅
En relisant le code du tableau de bord Directeur, sont déjà présents : le CA ferme cumulé de l'équipe avec objectif cible, une barre de progression sur ce CA, le même suivi pour les précommandes, le nombre de commandes en attente au front desk, et le détail par représentant (CA réalisé / objectif / barre de progression individuelle), organisé par Master Rep avec les représentants qui lui sont rattachés. La création d'objectif (multi-secteur, multi-catégorie, période, montant) est également déjà là.

### Ce qui manque réellement — 🆕
- **Filtre de période d'analyse** sur le dashboard lui-même (aujourd'hui, seule la période propre à chaque objectif compte — pas de sélecteur « voir le mois dernier / le trimestre dernier » indépendant).
- **Vue « territoire »** : il n'existe aujourd'hui aucune notion de territoire commercial (France/Espagne/etc.) dans la base de données — ni sur les représentants, ni sur les comptes clients. Le seul champ « pays » existant sert à la fiche client (adresse de facturation), pas à un découpage territorial de l'équipe. C'est un vrai ajout de structure de données, pas un réglage d'affichage.
- **« Performance »** en tant que tel dépend de ce qu'on entend par ce mot : le suivi CA/objectif par rep est déjà là (voir ci-dessus) ; s'il s'agit d'autre chose (classement, tendance dans le temps, etc.), à préciser.

### Carte sous le Dashboard — 📐 Décision déjà documentée
Ce point est explicitement traité dans le README du projet, avec justification écrite : la maquette d'origine propose une carte, mais elle affiche les comptes à partir de coordonnées latitude/longitude **qui n'existent nulle part dans la base de données réelle** (vérifié, aucune colonne de ce type dans aucune migration). La maquette elle-même est présentée comme un prototype non destiné à être repris tel quel. Construire cette carte suppose donc, avant même le développement de l'écran : choisir un service de géocodage (ex. API Google Maps, payante au-delà d'un certain volume), transformer chaque adresse client en coordonnées, et gérer les adresses incomplètes ou invalides. Ce n'est pas un correctif, c'est un nouveau chantier avec une dépendance externe et un coût récurrent à valider.

---

## 3. Carte & Tournées — 📐 Décision déjà documentée (même cause que ci-dessus)

Cette section n'existe dans aucun document de cadrage technique du projet (handoff, cahiers des charges) — uniquement dans la maquette visuelle d'origine, pour la même raison que la carte du dashboard : pas de coordonnées géographiques disponibles. Les filtres par typologie que vous listez (Opticien, Surf Shop, Fashion Store, etc.) existent déjà, eux, comme filtre sur l'écran Clients & prospects — c'est la partie cartographique et la préparation de tournées qui manquent, et qui dépendent du même chantier de géocodage que le point précédent.

Concrètement, tant que la question du géocodage n'est pas tranchée (quel service, quel budget), ce point et le précédent (carte du dashboard) ne peuvent pas être traités indépendamment l'un de l'autre — ils partagent le même prérequis technique.

---

## 4. Création Clients & Prospects / Fiche Société

### Catégorisation des clients — ✅ Déjà existant
Les 11 typologies (Opticien, Surf Shop, Fashion Store, Skate Shop, Ski Shop, Concept Store, Bike Store, Key Account, Distributeur, Autre, + une 11e déjà en base) sont déjà en place dans le code, utilisées à la création de compte et dans les filtres. Rien à reconstruire ici — juste à confirmer avec vous que les intitulés affichés à l'écran correspondent bien à ceux attendus.

### Complétion de la fiche Société par le Directeur — à vérifier plus précisément
Le Directeur a déjà accès en écriture à la fiche client (`AccountDetail.jsx` gère explicitement son rôle). Pour confirmer que **tous** les champs prévus dans la maquette y sont bien repris (et pas seulement une partie), il faudrait comparer champ par champ avec la maquette — je peux le faire si vous me confirmez que c'est prioritaire.

### Type de rendez-vous (planifié/physique, téléphonique, courtoisie) — 🆕 Écart réel
Vérifié dans la base de données : un rendez-vous peut aujourd'hui recevoir un compte rendu texte libre, une date et un client associé — mais **aucun champ ne distingue le type de rendez-vous** (physique / téléphonique / courtoisie). Un commentaire technique dans le code indique même explicitement qu'un système de statuts (Planifié/Honoré/Reporté/Annulé) avait été jugé « hors périmètre » sur demande explicite à l'époque. Le type d'action, lui, n'a jamais été mentionné dans les documents de cadrage — c'est un ajout réel à spécifier (quelles valeurs exactement, à quel endroit du parcours il se choisit) avant de l'implémenter.

---

## 5. Équipes & Territoires

### Déjà existant — ✅
La hiérarchie Master Rep → Représentant est déjà gérée (affectation d'un représentant à un Master Rep, visualisation de la structure en arborescence sur le dashboard Directeur et l'écran Équipe), avec activation/désactivation de compte.

### Écarts réels — 🆕
- **Territoires (France/Espagne/etc.)** : comme indiqué au point 2, cette notion n'existe pas du tout dans la structure de données actuelle. C'est un ajout de fond (nouvelle colonne, écran d'affectation, filtres associés), pas un réglage.
- **Objectifs filtrés par typologie de réseau complète** (Opticien, Surf Shop, etc., soit 10 catégories) : le cadrage d'origine (section 7 du handoff, « multi-secteur ») prévoyait uniquement 2 secteurs (Opticien / Mode-Surf-Sport), pas les 10 typologies détaillées. C'est le comportement actuellement implémenté. Passer aux 10 catégories est une vraie extension du modèle d'objectifs, pas une régression — la fonctionnalité « objectifs multi-catégories » existe bien, juste pas au niveau de détail attendu ici.
- **Catégories produit** : Premium, Classique, Optique, Access, Display, Kids existent déjà comme catégories d'objectif (`PREMIUM`, `CLASSIC`, `OPTICS`, `ACCESS`, `DISPLAY`, `KIDS`). Les deux dernières de votre liste, « Merge » et « Google », correspondent très probablement à ce qui existe déjà en base sous les noms `MERCH` (Merchandising) et `GOGGLES` (masques de ski) — cohérent avec un compte-rendu retranscrit à l'oral. À confirmer avec vous avant tout changement de nom.

---

## 6. Commandes — ✅ Déjà existant

Le détail d'une commande (lignes, montants, statut) est déjà consultable par le Directeur, dans l'écran **Front desk** (accessible depuis son menu) — chaque commande peut être dépliée pour afficher son détail complet. Il n'y a en revanche aucune notion de fichier/pièce jointe associée à une commande dans le code actuel. Le « fichier de libar » mentionné pendant le test reste à clarifier avec la personne qui a fait la remarque : ni le nom ni la fonctionnalité ne correspondent à quelque chose d'identifiable dans le projet ou les documents de cadrage — sans plus de précision, impossible de savoir s'il s'agit d'un export Dolibarr, d'un document de livraison, ou d'autre chose.

---

## 7. Data / Analytics — ✅ Déjà existant, à re-tester

Contrairement à ce que le retour indique, cet espace existe déjà en entier pour le Directeur, dans l'onglet **Data** de son menu : Bestsellers, Performance Client (avec comparaison automatique à la période précédente), Analytics (ferme vs précommande, par catégorie/pays), et Extraction (export Excel). Il est probable que cet onglet n'ait pas été localisé pendant le test plutôt que réellement absent — à revérifier en priorité avant de considérer qu'il y a un développement à refaire ici.

Une vraie nuance à noter : la comparaison de périodes actuellement disponible est automatique (période actuelle vs période précédente, N vs N-1), pas un choix libre de deux périodes A et B au calendrier. Si le besoin est bien un sélecteur de dates libre des deux côtés, c'est un ajustement réel à prévoir — mais sur une fonctionnalité qui existe déjà, pas à construire de zéro.

---

## 8. Agenda — ✅ Déjà existant

Le Directeur a déjà accès à l'agenda complet de l'équipe (tous les représentants et Master Reps), avec droit de saisie de compte rendu sur n'importe quel rendez-vous, sans restriction. Comme indiqué dans le retour lui-même, les écarts précis restent à confirmer après la suite du test — rien à corriger tant qu'un problème concret n'est pas identifié.

---

## Synthèse — statut réel des 18 points listés

| # | Point | Statut réel |
|---|-------|-------------|
| 1 | Responsive de la cloche de notifications | 🐞 Bug confirmé, à corriger |
| 2 | Accès fonctionnel aux notifications | 🐞 Probablement la même cause que le point 1 |
| 3 | Repositionnement du bouton Logout | ✅ Déjà corrigé, en attente d'upload |
| 4 | KPI du Dashboard Directeur | ✅ Déjà là pour CA/précommande/progression ; 🆕 filtre de période et notion de territoire à ajouter |
| 5 | Suivi des objectifs avec barre de progression | ✅ Déjà existant |
| 6 | Carte sous le Dashboard | 📐 Décision documentée (pas de lat/lng) — à retrancher |
| 7 | Mapping des clients via API | 📐 Même cause que le point 6 |
| 8 | Carte & Tournées | 📐 Même cause que les points 6-7 |
| 9 | Typologies et catégories de clients | ✅ Déjà existant à l'identique |
| 10 | Fiches Société modifiables par le Directeur | ✅ Déjà existant (à confirmer champ par champ si besoin) |
| 11 | Types de rendez-vous et interactions | 🆕 Jamais spécifié ni construit — à cadrer |
| 12 | Équipes, hiérarchies, territoires | ✅ Hiérarchie déjà là ; 🆕 territoires à construire |
| 13 | Objectifs par réseau/produit/rep/période | ✅ Déjà là au niveau secteur (2 valeurs) ; 🆕 passage à 10 typologies = extension |
| 14 | Accès détaillé aux commandes | ✅ Déjà existant (écran Front desk) |
| 15 | Fonctions Data / Analytics | ✅ Déjà existant en entier — à re-tester |
| 16 | Comparaison de périodes | ✅ Existe (N vs N-1) ; 🆕 sélection libre de deux périodes si c'est le besoin réel |
| 17 | Fonctions d'extraction | ✅ Déjà existant (export Excel) |
| 18 | Agenda d'équipe | ✅ Déjà existant |

## Comment avancer

Sur les 18 points, la situation réelle est : **2 bugs à corriger** (cloche + logout, ce dernier déjà fait), **9 fonctionnalités déjà construites** qu'il vaut mieux re-tester avant de les remettre en développement, **3 points couverts par une décision déjà documentée** (la carte, dans ses deux versions) qui nécessitent une vraie discussion produit/budget avant d'y toucher, et **4 extensions réelles** du périmètre d'origine (territoires, typologies détaillées sur les objectifs, types de rendez-vous, sélection libre de périodes) qui demandent d'abord d'être précisées avant chiffrage.

Autrement dit, la priorité immédiate est : corriger la cloche de notifications, puis refaire un tour de test ciblé sur Data/Analytics, Front desk et l'agenda avec ce diagnostic sous les yeux, avant de décider quoi construire réellement de nouveau.
