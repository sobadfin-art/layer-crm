# Moken CRM

CRM commercial pour les représentants, front desk et direction — développé lot par lot
selon `plan-developpement-claude-code.md`.

## État d'avancement

- [x] **Lot 1 — Fondations** : repo initialisé, schéma DB, authentification JWT, cloisonnement par rôle
- [x] **Lot 2 — CRM de base** : CRUD fiches client/prospect, historique d'interactions, pipeline, tâches/agenda
- [x] **Lot 3 — Catalogue et commandes** : import en masse, catalogues, prise de commande avec remises par catégorie/frais de port
- [x] **Lot 4 — Front desk et export Dolibarr** : file de commandes, validation, check-list, export CSV configurable, SAV
- [x] **Lot 5 — Pilotage** : objectifs (CA ferme vs précommande enfin distingués), dashboard/Data (bestsellers, analytics, extraction Excel), gestion d'équipe (représentants, Master Reps, territoires)
- [x] **Lot 6 — Finitions** : audit/historique des modifications, notifications temps réel (websocket + persistance), multilingue FR/EN/ES (écrans existants), PWA installable + mode hors-ligne partiel — voir section dédiée plus bas pour le périmètre exact
- [x] **Durcissement authentification et gestion des utilisateurs** (suite à audit) : bootstrap sécurisé du premier DIRECTEUR, création FRONT_DESK/ADMINISTRATEUR par le DIRECTEUR, changement de mot de passe forcé en première connexion, mot de passe oublié (structure backend complète), désactivation à effet immédiat, changement de rôle encadré, limitation de débit sur le login, session en cookie httpOnly uniquement — voir section dédiée plus bas
- [x] **Portails frontend** : Représentant, Master Rep, Directeur et Administrateur sont tous les quatre construits et testés — voir « Portail Master Rep » et « Portail Directeur » plus bas, et la section « Authentification et gestion des utilisateurs » (rôle ADMINISTRATEUR) pour le détail du périmètre de ce dernier (catalogue produits + import en masse, import fiches client, fiche client en lecture/écriture hors commandes/pipeline).

## Stack

| Couche | Choix |
|---|---|
| Frontend | React + Vite, PWA (Lot 6) — tous les portails (connexion, front desk, Représentant, Master Rep, Directeur, Administrateur) sont désormais construits ; seuls l'écran de connexion et l'écran front desk sont couverts par le mode installable/hors-ligne (périmètre assumé du Lot 6, cf. section dédiée plus bas) |
| Backend | Node.js + Express |
| Base de données | PostgreSQL (migrations SQL brutes, pas d'ORM) |
| Auth | JWT + bcrypt |

**Note sur l'absence d'ORM (Prisma) :** le plan initial prévoyait Prisma, mais son
téléchargement de binaires (`binaries.prisma.sh`) est bloqué par la politique réseau
de cet environnement de développement. Le schéma est donc géré en SQL brut avec un
petit runner de migrations (`src/scripts/migrate.js`) + `pg` pour les requêtes. C'est
un choix tout à fait viable pour la suite ; si un ORM est préféré une fois le projet
hébergé ailleurs (Railway/Render, sans cette contrainte réseau), Prisma pourra être
réintroduit en s'appuyant sur `migrations/001_init.sql` comme référence du schéma.

## Backend — démarrage local

```bash
cd backend
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET
npm run migrate         # applique migrations/*.sql
npm run seed            # crée un utilisateur de démo par rôle (mdp: moken1234)
npm run dev              # démarre sur http://localhost:4000
```

Comptes de démo créés par `npm run seed` :

| Rôle | Email | Notes |
|---|---|---|
| Représentant | rep@moken.demo | affecté à masterrep@moken.demo |
| Représentant | rep2@moken.demo | sans master rep (pour tester l'isolation) |
| Master Rep | masterrep@moken.demo | suit rep@moken.demo |
| Front desk | frontdesk@moken.demo | |
| Directeur | directeur@moken.demo | |
| Administrateur | admin@moken.demo | |

Mot de passe pour tous : `moken1234`

### Routes disponibles

**Lot 1 — Auth & démo**
- `GET  /api/health` — vérifie la connexion DB
- `POST /api/auth/login` — `{ email, password }` → cookie de session httpOnly uniquement (aucun JWT
  renvoyé dans le corps de la réponse — voir section "Sessions : cookie httpOnly uniquement" plus bas)
- `POST /api/auth/logout`
- `GET  /api/auth/me` — profil de l'utilisateur connecté
- `GET  /api/whoami`, `/api/admin/ping`, `/api/front-desk/ping`, `/api/accounts/mine` —
  routes de démonstration du Lot 1, laissées en place à titre d'exemple du pattern
  `requireAuth` + `requireRole`.

**Lot 2 — CRM de base**
- `GET    /api/accounts` — liste filtrée par rôle (voir `src/lib/scope.js`)
- `POST   /api/accounts` — création (typologie → secteur dérivé automatiquement)
- `GET    /api/accounts/:id`
- `PATCH  /api/accounts/:id` — réassignation ownerRep/masterRep réservée à front desk/directeur
- `PATCH  /api/accounts/:id/pipeline` — `{ stage }`, gère won_date/lost_date automatiquement
- `GET/POST /api/accounts/:accountId/interactions`
- `GET/POST /api/tasks`, `PATCH /api/tasks/:id`

**Règle (votre demande) — un RDV passé sort de l'agenda mais reste dans l'historique du
client, migration `009`.** `tasks.type` (`RDV` | `TACHE`, défaut `TACHE` pour ne rien
changer au comportement existant) :
- Un `RDV` doit obligatoirement être rattaché à une fiche compte (`accountId` requis,
  sinon 400) — un rendez-vous se prend avec un client, contrairement à une tâche
  générique. Une `TACHE` classique n'a pas cette contrainte, comme avant.
- **À la création d'un RDV**, une interaction est automatiquement journalisée sur la
  fiche du compte (`RDV planifié : "<titre>" — <date>`) — les interactions n'étant
  jamais supprimées ni filtrées par date, cette trace survit indéfiniment, y compris
  après que le RDV a disparu de l'agenda.
- **`GET /api/tasks` (l'agenda) exclut désormais un RDV dont la date est passée**
  (`due_date < now()`) — récupérable explicitement via `?includePastRdv=true` si besoin
  ponctuel, mais absent de la vue par défaut. Une tâche générique en retard, elle,
  continue de s'afficher normalement (elle reste probablement à faire, contrairement à
  un rendez-vous qui a eu lieu ou non).
- **Compte rendu de RDV (règle définitive, migration `012`) :** `PATCH
  /api/tasks/:id/compte-rendu` — `{ compteRendu: "texte libre" }`, uniquement sur une
  tâche `type = 'RDV'` (400 sinon). Rattaché au RDV lui-même (`tasks.compte_rendu` /
  `compte_rendu_at`), au client (`account_id`), au commercial (`assignee_id`) et à la
  date du rendez-vous (`due_date`) — tout est déjà porté par la ligne `tasks`. Volontairement
  simple : pas de gestion de statuts Planifié/Honoré/Reporté/Annulé. Réservé au titulaire
  du RDV, ou à front desk/directeur (même règle que la modification générique d'une
  tâche). Chaque saisie ajoute aussi une entrée dans l'historique du compte
  (`GET /api/accounts/:id/interactions`) — un seul flux à consommer côté frontend pour
  tout l'historique texte du compte (planification du RDV + compte rendu + interactions
  manuelles). *Mise à jour :* au moment de l'écriture de cette règle (migration 012), aucun
  écran "agenda"/"fiche client" n'existait côté frontend (seul l'écran front desk existait)
  et elle n'était donc active que côté API. Ce n'est plus le cas — un écran **Agenda**
  (`Agenda.jsx`) et une **fiche client** complète (`AccountDetail.jsx`, avec l'historique
  et la saisie de compte rendu) existent désormais pour Représentant/Master Rep/Directeur
  (`frontend/src/pages/Agenda.jsx`, `AccountDetail.jsx`, routées dans `App.jsx`) — voir aussi
  « Portail Master Rep » plus bas pour la variante équipe de l'agenda.
- **Testé de bout en bout avec de vraies requêtes** : RDV créé sans `accountId` → 400 ;
  RDV créé avec une date passée (2020) → absent de `GET /api/tasks`, présent avec
  `?includePastRdv=true`, et retrouvé mot pour mot dans
  `GET /api/accounts/:id/interactions` ; RDV avec une date future (2030) → présent dans
  l'agenda par défaut ; tâche générique avec une date passée → toujours présente dans
  l'agenda (comportement inchangé, non affecté par cette règle) ; compte rendu saisi par
  le titulaire du RDV → 200, visible dans l'historique du compte ; compte rendu tenté par
  un autre représentant → 403 ; compte rendu tenté sur une `TACHE` (pas un `RDV`) → 400.

**Cloisonnement par rôle appliqué (section 3 du handoff) :**
- Représentant : ne voit/gère que ses propres comptes et tâches ; ne peut jamais
  s'affecter un masterRep ni réassigner un compte.
- Master Rep : voit les comptes où il est `masterRepId`, et les tâches de ses reps
  affectés (lecture) en plus des siennes.
- Front desk / Directeur : accès à tous les comptes et tâches, seuls rôles pouvant
  réaffecter `ownerRep`/`masterRep` sur un compte existant.
- Administrateur : accès lecture/écriture complet à la fiche client (comptes), au même
  niveau que front desk — à l'exception du pipeline commercial, jamais ouvert à ce rôle
  (`PIPELINE_ROLES` dans `accounts.js`) — et du module commandes, entièrement hors périmètre.
  Toujours aucun accès au module tâches/agenda. *Mise à jour :* au moment de l'écriture de
  cette règle (Lot 2), le rôle Administrateur n'avait accès qu'au catalogue et aux imports ;
  l'accès à la fiche client lui a été ouvert plus tard (cf. `docs/cahier-des-charges-import-
  fiches-client.md` section 2 et la section « Authentification et gestion des utilisateurs »
  ci-dessous pour le périmètre définitif du rôle).

**Règle confirmée — création de compte par un Master Rep :** à la création, le Master
Rep désigne un représentant de son équipe (`ownerRepId`, doit faire partie de ses reps
affectés, sinon 403) ; s'il n'en désigne aucun, le compte lui reste directement rattaché
— **il devient lui-même `ownerRepId`**, jamais de compte orphelin sans propriétaire.
Dans ce dernier cas `masterRepId` reste `null` (il n'est pas "son propre master rep").
Sa visibilité (`GET /api/accounts`, `canAccessAccount`) couvre donc les deux cas : les
comptes où il est `masterRepId` (ceux de son équipe) et ceux dont il est directement
`ownerRepId` (les siens) — testé dans les deux configurations.

**Règles définitives — réassignation et suppression de compte :** le Master Rep ne peut
**jamais** réassigner un compte existant, quelle que soit la situation ; seuls front
desk/directeur peuvent réaffecter `ownerRep`/`masterRep` sur un compte (cf. section 3).
Aucun compte client ne peut être supprimé : il n'existe et n'existera aucune route
`DELETE` pour un compte client. Le cycle de vie d'un compte est `ACTIF ↔ INACTIF →
ARCHIVE` (bascule `ACTIF ↔ INACTIF` ouverte aux rôles habituels de gestion du compte ;
`INACTIF → ARCHIVE` réservée front desk/directeur, cf. "Ajustements" plus bas) ;
`ARCHIVE` est un état terminal, sans réactivation possible.

**Lot 3 — Catalogue et commandes**
- `GET  /api/catalogs` — liste (avec nombre de références) ; `POST/PATCH/DELETE` réservés admin.
  La suppression détache les références (`catalog_id = NULL`, jamais de suppression de produit,
  cf. section 11 du cahier des charges import).
- `GET  /api/products` — filtrable par `catalogId` (accepte plusieurs valeurs : `?catalogId=A&catalogId=B`
  ou `?catalogId=A,B`, pour la sélection multi-catalogues du récapitulatif — section 2/6 handoff),
  `category`, `search` ; lecture ouverte à tous les rôles concernés ; `POST/PATCH` réservés admin.
- **Import en masse** (`POST /api/catalogs/:id/import/preview|summary|commit`, multipart `file`) :
  - `preview` : en-têtes détectées + mapping auto-suggéré (motifs du cahier des charges) + 10
    premières lignes.
  - `summary` : compte nouvelles/mises à jour/erreurs sans rien écrire.
  - `commit` : applique réellement (`mode`: `create_and_update` | `create_only` | `update_only`),
    journalise dans `catalog_import_logs`. Catégorie inconnue → `NON_CLASSE`, jamais rejetée ;
    seuls les champs mappés sont écrasés à la mise à jour ; aucune suppression de référence absente
    du fichier. Formats CSV/XLS/XLSX via SheetJS (le CSV est décodé nous-mêmes en UTF-8 avant
    parsing pour éviter le mojibake sur les accents que SheetJS produit sinon).
  - Non couvert (cf. section 9 du cahier des charges) : import de photos en masse, template
    de fichier vierge téléchargeable — à ajouter ultérieurement.
- `GET  /api/business-rules` (tous rôles sauf admin) ; `POST/PATCH` réservés **directeur**
  (l'administrateur n'a explicitement pas accès aux règles commerciales, section 3).
- `POST /api/orders` — panier → commande en brouillon. Le prix unitaire n'est **jamais** accepté
  du client : recalculé serveur selon le pays du compte (FR/ES → `priceFR`, CH → `priceCH`,
  sinon `priceExport`). Remise catégorie appliquée automatiquement si non fournie par le client
  (~~remise combo~~ — **retirée du périmètre après revue, voir section "Ajustements" plus bas**).
  Ligne "offert" → total forcé à 0. Ligne "reliquat" refusée si le produit n'est pas en statut
  `REASSORT_PREVU`. Frais de port avec offre automatique au-delà du seuil de la règle
  `FRAIS_DE_PORT`, ou offre manuelle via `shippingOffered`.
- `GET  /api/orders`, `GET /api/orders/:id` — cloisonnement par `rep_id` (représentant propriétaire
  du compte), étendu aux reps affectés pour un Master Rep, ouvert pour front desk/directeur.
- `POST /api/orders/:id/send-to-front-desk` — transition `BROUILLON` → `ENVOYEE_FRONT_DESK` +
  entrée dans `audit_logs`. La vraie notification temps réel (push/websocket) est un item explicite
  du **Lot 6** ; cette entrée d'audit sert de point d'accroche pour la brancher plus tard.

**Règle confirmée — commande non modifiable après création :** pas de `PATCH /api/orders/:id` pour
ajouter/retirer une ligne ou re-basculer le bouton "Offrir" les frais de port. C'est le flux
attendu et **confirmé par vous** : le panier reste éditable côté frontend tant que "Envoyer au
front desk" n'a pas été cliqué, l'API n'intervient qu'une fois à ce moment-là.

**Précommande :** le flag `isPrecommande` est bien capturé et stocké sur la commande (vérifié),
et son traitement séparé du CA ferme dans les tableaux de bord/objectifs est un calcul qui
relève du **Lot 5** (Pilotage) — désormais construit et testé, voir la section Lot 5 ci-dessous
et « Ajustements suite au retour client détaillé » pour la règle définitive sur la période.

**Lot 4 — Front desk et export Dolibarr**
- `GET /api/orders` accepte maintenant `status`, `accountId`, `search` (nom de compte), `dateFrom`,
  `dateTo` — la file de commandes du front desk.
- `PATCH /api/orders/:id/status` — validation (`ENVOYEE_FRONT_DESK → VALIDEE`) ou annulation, réservé
  front desk/directeur. C'est cette validation qui débloque l'export (section 4 du cahier des charges :
  "à valider manuellement par le front desk").
- `GET /api/dolibarr/orders/:id/export-checklist` — jamais silencieuse : distingue les points
  **bloquants** (commande non validée, déjà exportée, sans ligne, **référence produit manquante sur
  une ligne** — cf. "Ajustements" plus bas) des **avertissements** (régime fiscal
  Intracommunautaire/Recargo mal configuré). **Aucun contrôle d'identification client** dans cette
  check-list (règle définitive, voir "Ajustements" plus bas) : dans le flux retenu, le client est
  déjà connu de Dolibarr au moment de l'import du fichier. *(TVA et `fk_user` retirés de la
  check-list dès le Lot 4 — plus des sujets pour ce périmètre.)*
- `GET/PATCH /api/dolibarr/settings` — réglages configurables. Mis à jour en détail dans la section
  "Ajustements" plus bas suite à la configuration Dolibarr réelle communiquée (version 23.0.3,
  fichier uniquement, pas de TVA, conditions/mode de paiement avec de vraies valeurs par défaut).
- `POST /api/dolibarr/orders/export` — génère un fichier (une ligne par ligne de commande, plusieurs
  commandes combinables en un seul fichier pour un export par lot), marque les commandes
  `EXPORTEE_DOLIBARR` avec horodatage et `ref_client`, journalise dans `audit_logs`. Une commande déjà
  exportée ou non validée est rejetée avec le motif exact (testé). *Mise à jour (corrections V2,
  section "Prochaine étape" plus bas) : ce fichier était initialement un CSV, désormais un .xlsx.*
- `PATCH /api/accounts/:id` accepte toujours `dolibarrCodeClient` (champ conservé en base pour
  utilité historique éventuelle), mais ce champ est **optionnel et n'intervient plus du tout** dans
  le flux d'export Dolibarr — ni contrôle, ni avertissement, ni rapprochement automatique (règle
  définitive, cf. "Ajustements" plus bas).
- **SAV** (`/api/sav-tickets`) : création par tout rôle ayant accès au compte, notes partagées, mais
  seuls front desk/directeur changent le statut ou l'assignation — **règle confirmée** par vous
  ("SAV ouvert à tout rôle ayant accès au compte"). Cloisonnement testé : un représentant sans accès
  au compte n'a aucune visibilité sur le ticket.

**Lot 5 — Pilotage (objectifs, dashboard, équipe)**
- `GET  /api/objectives` — cloisonné par rôle : représentant voit les siens, Master Rep voit les
  siens + ceux de ses reps affectés **en lecture seule — règle confirmée** ("il peut suivre les
  objectifs de ses reps affectés, jamais les fixer") ; directeur voit tout ; front desk et
  administrateur n'y ont pas accès. Seul le directeur peut créer/modifier un objectif
  (`POST`/`PATCH` réservés `ROLES.DIRECTEUR` — l'accès en écriture du Master Rep n'a jamais été
  ouvert, rien à changer côté code).
- `GET  /api/objectives/:id/progress` — calcule la réalisation réelle via `computeObjectiveProgress`
  (`src/lib/objectiveProgress.js`).
- `POST /api/objectives`, `PATCH /api/objectives/:id` — réservés **directeur**. Un objectif porte un
  `type` (`CHIFFRE_AFFAIRES` ou `PRECOMMANDE`), une période, et peut être filtré par catégories
  et/ou secteurs (multi-valeurs).
- **C'est ici, comme annoncé dès le Lot 3, que le CA ferme et le CA précommande sont enfin
  distingués.** Deux règles confirmées, ajustées après revue :
  - **Statuts comptés (`COUNTED_STATUSES`) : `VALIDEE` et `EXPORTEE_DOLIBARR` uniquement.**
    `ENVOYEE_FRONT_DESK` a été retiré : un objectif doit rester "certifié", jamais "optimiste" sur
    une commande que le front desk n'a pas encore contrôlée. Testé : une commande fraîchement
    envoyée au front desk n'augmente pas la réalisation ; elle ne compte qu'après
    `PATCH /api/orders/:id/status` → `VALIDEE`.
  - **Bascule précommande → CA ferme : logique hybride, jamais automatique.** Nouvelle colonne
    `orders.converted_to_firm` (migration `005`, `FALSE` par défaut). Tant qu'elle est à `FALSE`,
    une commande `is_precommande = TRUE` compte dans les objectifs de type `PRECOMMANDE` ; une fois
    passée à `TRUE` via `PATCH /api/orders/:id/confirm-delivery`, elle compte comme CA ferme
    (objectifs `CHIFFRE_AFFAIRES` et dashboard `analytics`) — jamais de bascule automatique par la
    seule `desired_delivery_date` dépassée, toujours une confirmation humaine du front desk que la
    marchandise est réellement partie.
  - **Testé de bout en bout avec des montants réels**, sur une commande de précommande de 30 € :
    `ENVOYEE_FRONT_DESK` → 0 € comptés ; `VALIDEE` → compte dans l'objectif `PRECOMMANDE` (121,50 €
    → 151,50 €), l'objectif `CHIFFRE_AFFAIRES` reste à 405 € ; `confirm-delivery` → bascule
    immédiatement l'objectif `PRECOMMANDE` de retour à 121,50 € et l'objectif `CHIFFRE_AFFAIRES` à
    435 €. Confirmé aussi : confirmer deux fois la même commande → 409 ; confirmer une commande non
    précommande → 409 ; confirmer une précommande pas encore validée par le front desk → 409 avec
    message explicite ; un représentant qui tente `confirm-delivery` → 403 (réservé front
    desk/directeur, comme la validation).
- `PATCH /api/orders/:id/confirm-delivery` (nouveau, `src/routes/orders.js`) — action **distincte**
  de la validation front desk : une commande de précommande passe d'abord par la validation
  habituelle (`ENVOYEE_FRONT_DESK` → `VALIDEE`, débloque déjà l'export Dolibarr comme au Lot 4),
  **puis**, plus tard, par cette confirmation de livraison qui la fait basculer en CA ferme.
- `GET /api/dashboard/bestsellers` — top références par quantité/montant, cloisonné par rôle via
  `repScopeForDashboard` (`src/lib/dashboardScope.js`) : représentant → lui-même, Master Rep →
  lui-même + ses reps affectés, directeur → tout. Les lignes "offert" (`is_gift`) sont exclues du
  montant.
- `GET /api/dashboard/customer-performance` — comparatif de portefeuille N vs N-1 par compte (section
  4 du handoff), même cloisonnement.
- `GET /api/dashboard/analytics` — réservé **directeur** : ventilation CA ferme/précommande par
  catégorie et par pays, plus les totaux globaux. Utilise la même classification "effective"
  qu'`computeObjectiveProgress` (`is_precommande AND NOT converted_to_firm`) : une précommande
  confirmée livrée bascule ici aussi côté CA ferme. Vérifié : après confirmation, les 30 € de
  l'exemple ci-dessus sont bien passés du total précommande (121,50 €) au total ferme (405 € → 435 €)
  dans `GET /api/dashboard/analytics`.
- `GET /api/dashboard/extract.xlsx` — réservé **directeur** : export Excel réel (via SheetJS), une
  ligne par ligne de commande avec compte, représentant, produit, quantité, remise, montant.
- `GET /api/dashboard/rdv` — widget RDV du tableau de bord. **Règle définitive** : le périmètre
  d'**accès** de chaque rôle est fixe, distinct du filtre d'**affichage** "aujourd'hui" du widget —
  les deux ne doivent jamais être confondus :
  - **Représentant** : accès à ses propres RDV uniquement (`assignee_id` = lui).
  - **Master Rep** : accès à ses propres RDV **+** ceux des représentants rattachés à son équipe.
  - **Directeur** : vision globale — accès aux RDV des utilisateurs de rôle **Représentant ET
    Master Rep**.
  - Front desk / administrateur : pas d'accès, comme le reste du module Data.
  - Le paramètre `?today=true` filtre l'**affichage** sur la date du jour (exactement ce qu'un
    widget "RDV du jour" veut montrer) **sans jamais réduire le périmètre d'accès** du rôle défini
    ci-dessus : sans ce paramètre, l'endpoint renvoie tous les RDV du périmètre (passés et futurs).
    Les anciennes règles documentées ici (représentant/directeur limités au jour même par défaut,
    Master Rep sans ses propres RDV, directeur sans les RDV des Master Reps) ne correspondent plus
    au comportement actuel et ont été corrigées, code et documentation, lors de la revue de
    cohérence finale.
  - **Testé de bout en bout avec de vraies données** pour les trois rôles : un représentant avec un
    RDV aujourd'hui + un RDV passé (2020) + un RDV futur (2030) → voit ses 3 RDV sans `?today=true`,
    seulement celui du jour avec `?today=true` ; son Master Rep voit les 3 RDV du représentant **et**
    les siens propres (avec/sans le filtre du jour) ; un Master Rep non rattaché ne les voit jamais ;
    le directeur voit les RDV du représentant **et** ceux du Master Rep (avec/sans le filtre du
    jour).
- `GET/POST /api/team/territories` — lecture ouverte à front desk + directeur, création réservée
  directeur. Un territoire regroupe une liste de codes pays.
- `GET/POST/PATCH /api/team/members` — réservés **directeur** : création de représentants/Master
  Reps (mot de passe généré et haché en bcrypt, comptes `sales_reps`/`master_reps` créés en même
  temps), affectation à un territoire et/ou un Master Rep, activation/désactivation de compte. Un
  compte désactivé ne peut plus se connecter (testé).
- Testé de bout en bout : création de territoire, lecture par front desk, blocage d'un représentant
  (403), création d'un nouveau représentant affecté à un Master Rep et à un territoire, connexion
  immédiate de ce nouveau compte, hiérarchie correcte dans la liste des membres, email en doublon
  rejeté (409), désactivation puis connexion refusée sur le compte désactivé.

**Écran front desk (frontend) — premier écran réel de l'application.** Les Lots 1 à 5 n'avaient
construit que le backend ; le dossier `frontend/` était vide. Après votre demande explicite du
bouton "Valider la commande" et de l'action "Confirmer la livraison", on a démarré le frontend
React (Vite) en commençant précisément par cet écran :
- `frontend/` : React + Vite, proxy `/api` vers le backend (`:4000`), style repris de la palette du
  prototype (`docs/prototype-crm-commercial.jsx` : couleurs `--teal`/`--gold`/`--ink`, police
  Manrope) pour rester visuellement cohérent.
- Écran de connexion (`POST /api/auth/login`, session en cookie httpOnly — rien stocké côté client)
  puis, pour front desk et
  directeur, la file de commandes (`GET /api/orders`) avec filtre par statut et recherche par nom
  de compte.
- Chaque commande affiche : compte, représentant, montant, badge "Précommande" le cas échéant, et
  le bouton **"Valider la commande"** (visible seulement si `ENVOYEE_FRONT_DESK`,
  `PATCH /api/orders/:id/status`), un bouton Annuler, le détail des lignes à la demande
  (`GET /api/orders/:id`).
- **Bouton "Exporter vers Dolibarr" désactivé tant que la commande n'est pas `VALIDEE`** (grisé,
  infobulle explicative), actif une fois validée, remplacé par "Déjà exportée" une fois
  `EXPORTEE_DOLIBARR` — exactement la règle demandée au point 3.
- **Signal "Livraison prévue dépassée — à confirmer"** affiché dès que `desiredDeliveryDate` est
  dépassée sur une précommande non confirmée ; le bouton **"Confirmer la livraison"** apparaît une
  fois la commande validée (`PATCH /api/orders/:id/confirm-delivery`) et le signal disparaît
  immédiatement après confirmation.
- `GET /api/orders` a été enrichi (`rep_first_name`/`rep_last_name`, `merchandise_total` calculé par
  agrégation des lignes) pour que la file front desk affiche client/rep/montant sans recharger
  chaque commande individuellement.
- **Testé de bout en bout dans un vrai navigateur** (Chromium piloté par Playwright, pas seulement
  en curl) : connexion front desk, commande précommande en retard affichée avec le bandeau
  d'avertissement et sans bouton de confirmation tant qu'elle n'est pas validée ; clic sur "Valider
  la commande" → bascule de statut confirmée ; une fois validée, le bouton d'export devient actif et
  "Confirmer la livraison" apparaît ; clic dessus → le bandeau d'avertissement disparaît
  immédiatement ; ouverture du détail → lignes de commande affichées correctement.
- *Mise à jour :* à l'écriture de cette section (Lot 4), seuls l'écran front desk et l'écran de
  connexion existaient côté frontend (d'où le périmètre Multilingue/PWA-hors-ligne du Lot 6,
  volontairement limité à ces deux écrans, cf. section dédiée). Les écrans représentant/master
  rep/directeur/administrateur (catalogue, prise de commande, dashboard, gestion d'équipe...) ont
  tous été construits depuis — voir « État d'avancement » en tête de ce document.

Pour lancer le frontend en local : `cd frontend && npm install && npm run dev` (backend démarré en
parallèle sur `:4000`), puis ouvrir `http://localhost:5173`. Pour tester le comportement PWA/hors-
ligne tel qu'il fonctionnera réellement une fois déployé (bundle JS/CSS figé, pas le rechargement à
chaud de `vite dev`) : `npm run build && npm run preview`, puis `http://localhost:4173`.

**Lot 6 — routes ajoutées (voir section dédiée "Lot 6 — Finitions" plus bas pour le détail complet
et les preuves de test)**
- `GET /api/audit-logs`, `GET /api/audit-logs/facets` — réservés **directeur**.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
  — utilisateur connecté, ses propres notifications uniquement.
- Websocket `ws://.../ws` — poussée temps réel des notifications. Authentification initialement par
  JWT en query string (`?token=...`, cf. détail historique ci-dessous dans "2. Notifications temps
  réel") puis, suite au durcissement authentification, par le **cookie httpOnly** de session — voir
  "Sessions : cookie httpOnly uniquement" plus bas pour la règle actuelle.

**Correctif de robustesse trouvé en testant ce lot :** une erreur SQL dans un handler async (ici,
une comparaison `enum = ANY(text[])` sans cast, cf. plus bas) faisait planter tout le process Node,
car Express 4 ne rattrape pas nativement les rejets de promesse dans les routes `async`. Corrigé à
la fois localement (cast `::text` explicite partout où un statut d'enum est comparé) et
systémiquement en important `express-async-errors` en tête de `server.js`, pour qu'une future
erreur async dans n'importe quelle route reste une réponse 500 propre plutôt qu'un crash complet du
serveur.

## Lot 6 — Finitions (audit, notifications, multilingue, PWA)

Quatre chantiers, chacun testé de bout en bout avant d'être considéré fini. Contrairement aux lots
précédents qui touchaient surtout le backend, celui-ci touche autant le backend (audit, notifications)
que le frontend existant (i18n, PWA) — dans les deux cas, le périmètre reste honnête : seul ce qui
existe réellement dans le frontend aujourd'hui (écran de connexion + écran front desk) est traduit
ou rendu installable/hors-ligne. Il n'y a pas d'autre écran à couvrir pour l'instant.

### 1. Audit / historique des modifications

La table `audit_logs` existait depuis la toute première migration (Lot 1) mais n'était utilisée que
ponctuellement (envoi front desk, export Dolibarr, confirmation de livraison). Ce lot généralise
l'écriture et ajoute la lecture :
- `src/lib/audit.js` — helper central `logAudit({ userId, action, entity, entityId, details })`,
  utilisé partout désormais (remplace les `INSERT` bruts dupliqués dans `orders.js`/`dolibarr.js`).
  Écrit en `try/catch` non bloquant : un souci d'audit ne doit jamais faire échouer l'action métier
  réelle.
- Actions maintenant tracées, en plus de celles qui l'étaient déjà (`ORDER_SENT_TO_FRONT_DESK`,
  `ORDER_EXPORTED_DOLIBARR`, `ORDER_DELIVERY_CONFIRMED`) : `ORDER_VALIDATED`/`ORDER_CANCELLED`
  (validation front desk, qui n'était curieusement pas encore auditée), `ACCOUNT_CREATED`/
  `ACCOUNT_UPDATED`/`ACCOUNT_PIPELINE_CHANGED`/`ACCOUNT_STATUS_CHANGED`, `OBJECTIVE_CREATED`/
  `OBJECTIVE_UPDATED`, `BUSINESS_RULE_CREATED`/`BUSINESS_RULE_UPDATED`, `PRODUCT_CREATED`/
  `PRODUCT_UPDATED`, `SAV_TICKET_CREATED`/`SAV_TICKET_UPDATED`, `DOLIBARR_SETTINGS_UPDATED`.
- `GET /api/audit-logs` (nouveau, réservé **directeur** — vision globale, aucun autre rôle n'en a
  besoin) : filtres `entity`, `entityId`, `action`, `userId`, `dateFrom`/`dateTo`, pagination
  `limit`/`offset`, jointure sur `users` pour afficher qui a fait quoi. `GET /api/audit-logs/facets`
  renvoie les valeurs `action`/`entity` réellement présentes en base, pour peupler des filtres côté
  UI sans deviner une liste figée à l'avance.
- **Testé avec de vraies actions** : création/modification de compte, création d'objectif, de règle
  commerciale, de produit, de ticket SAV, validation de commande — chaque action retrouvée dans
  `GET /api/audit-logs?entityId=...` avec le bon acteur et les bons détails ; front desk qui tente
  `GET /api/audit-logs` → 403 (réservé directeur) ; filtre `entityId` vérifié précisément (ne
  renvoie que les lignes de l'entité demandée, pas tout l'historique).

### 2. Notifications temps réel

- Migration `008_notifications.sql` : table `notifications` (toujours rattachée à un utilisateur
  précis — jamais de diffusion "à tout le monde" sans destinataire nommé).
- `src/lib/notifications.js` : `notifyUser`/`notifyUsers` écrivent toujours en base d'abord (la
  notification existe même si personne n'est connecté au moment de l'événement — mode "poll" de
  secours), puis poussent en temps réel via websocket si un socket est ouvert pour cet utilisateur.
  Ne jette jamais, comme `lib/audit.js`.
- Serveur websocket monté directement dans `server.js` (paquet `ws`) sur le chemin `/ws`, sur le
  **même port** que l'API REST (pas de second process/port à gérer) — d'où le passage d'`app.listen`
  à `http.createServer(app)` explicite. *Historique technique :* à l'origine (ce Lot 6), authentifié
  par le même JWT que le reste de l'API, passé en query string (`?token=...`) puisqu'un client
  websocket navigateur ne peut pas poser de header `Authorization` à la connexion ; token invalide →
  fermeture immédiate (code `4001`). **Ce n'est plus le comportement actuel** : depuis le durcissement
  authentification (section "Sessions : cookie httpOnly uniquement" plus bas), la connexion lit le
  cookie httpOnly envoyé automatiquement par le navigateur à la requête d'upgrade — il n'y a plus de
  `?token=` du tout ; cookie absent/invalide → même fermeture immédiate `4001`.
- Événements câblés : commande envoyée au front desk → notifie tous les front desk + le directeur ;
  commande validée/annulée → notifie le représentant propriétaire ; livraison confirmée (précommande
  → CA ferme) → notifie le représentant ; nouveau ticket SAV → notifie front desk + directeur.
  D'autres événements pourront être ajoutés au même endroit (`lib/notifications.js` +
  `userIdsWithRoles`) sans changer l'architecture.
- `GET /api/notifications` (liste + compteur non lues), `PATCH /api/notifications/:id/read`,
  `POST /api/notifications/read-all` — mode "poll" de secours, utile au chargement initial ou si le
  websocket n'a pas pu se connecter.
- Frontend : `useNotifications` (hook websocket + repli REST + reconnexion automatique après 4s en
  cas de coupure) et `NotificationBell` (cloche dans la topbar, badge non-lues, panneau au clic).
- **Testé de bout en bout avec un vrai client websocket** (pas seulement en curl) : rep connecté en
  websocket pendant qu'une commande est validée par le front desk → message reçu en temps réel
  (`{"kind":"notification", ...}`) en moins d'une seconde, en plus de la ligne en base ; token
  invalide → fermeture `4001` ; `GET /api/notifications` → notification retrouvée, marquage lu
  fonctionnel, compteur non-lues qui décroît. Vérifié aussi dans un vrai navigateur (Playwright) :
  cloche cliquable, panneau affiche les notifications reçues.

### 3. Multilingue FR/EN/ES

- `src/i18n/translations.js` (dictionnaires complets FR/EN/ES) + `src/i18n/I18nContext.jsx`
  (context React, fonction `t(clé, variables)` avec interpolation `{variable}`, repli sur le
  français si une clé manque dans la langue active — jamais une clé brute affichée à l'écran).
  Langue détectée par défaut depuis `navigator.language`, mémorisée ensuite dans `localStorage`
  (acceptable ici : c'est une vraie app React que vous exécutez vous-même via `npm run dev`/`vite
  build`, pas un artefact Claude en conversation soumis à la restriction habituelle sur le
  stockage navigateur).
- Sélecteur de langue dans la topbar (et sur l'écran de connexion) — les trois écrans existants
  (connexion, topbar/rôle, front desk) sont entièrement traduits.
- **Testé dans un vrai navigateur** : bascule FR → EN → ES vérifiée sur le titre de l'écran
  (`Commandes`/`Orders`/`Pedidos`) et sur des libellés de boutons ; langue persistée après un
  rechargement complet de la page (localStorage).

### 4. PWA — installation + mode hors-ligne partiel

- `public/manifest.json` (nom, icônes 192/512, couleur de thème `--teal`) + `public/sw.js` (service
  worker) + balises `<link rel="manifest">`/`theme-color` dans `index.html` → l'application est
  installable (icône sur l'écran d'accueil / raccourci bureau) dans un navigateur qui le supporte.
- **Périmètre du hors-ligne, volontairement limité et assumé** : app shell (JS/CSS/HTML) en
  cache-first avec repli réseau ; uniquement quelques lectures GET précises côté API (`/api/orders`,
  `/api/orders/:id`, `/api/notifications`) en réseau-prioritaire-avec-repli-cache, pour pouvoir
  au moins **afficher** la dernière donnée connue si le réseau tombe. Tout le reste — en particulier
  toute écriture (`POST`/`PATCH`/`DELETE`) — n'est jamais intercepté par le service worker : ça doit
  échouer normalement hors-ligne, jamais donner une fausse impression de succès.
  `frontend/src/pages/FrontDesk.jsx` garde en plus sa propre copie de secours en `localStorage`
  (`moken_frontdesk_cache`) pour le cas où le service worker ne serait pas actif.
  Un bandeau **"Hors ligne — lecture seule"** (`OfflineBanner`) s'affiche dès que le navigateur
  détecte la coupure (`navigator.onLine`/évènements `online`/`offline`).
- **Correctif de robustesse trouvé en testant ce point précis** : `AuthContext` revérifiait
  systématiquement le token via `GET /api/auth/me` à chaque chargement de page, et déconnectait
  l'utilisateur (`setToken(null)`) sur n'importe quelle erreur — y compris une simple coupure
  réseau, ce qui renvoyait vers l'écran de connexion et rendait tout le travail de cache ci-dessus
  inutile en pratique. Corrigé : seule une vraie réponse `401` du serveur déconnecte désormais ;
  une erreur réseau (pas de `err.status`) réutilise un profil utilisateur mis en cache
  (`moken_user_cache` en `localStorage`) pour rester connecté en lecture seule.
- **Testé de bout en bout avec un vrai build de production** (`vite build && vite preview`, pas le
  serveur de dev — en dev les modules ne sont pas bundlés et un rechargement hors-ligne complet
  n'a pas de sens à tester), navigation simulée hors-ligne via Playwright
  (`context.setOffline(true)`) : après un premier chargement en ligne suivi d'un rechargement (le
  service worker ne prend le contrôle qu'à partir de la navigation qui suit son activation),
  passage hors-ligne + rechargement complet → l'app shell se charge bien depuis le cache, la session
  reste active (plus de déconnexion intempestive), la file de commandes du front desk s'affiche
  depuis le cache avec le bandeau hors-ligne visible, et une tentative de clic sur "Valider la
  commande" échoue proprement (erreur réseau affichée) sans jamais laisser croire que l'action a
  réussi.

**Pas encore fait, honnêtement :** les écrans représentant/master rep/directeur restent à construire
(cf. section précédente) — le multilingue et la PWA ne couvrent donc que ce qui existe. Quand un
nouvel écran sera construit, ses clés de traduction devront être ajoutées dans les 3 langues en même
temps pour ne jamais se retrouver avec un écran francophone-only oublié.

## Authentification et gestion des utilisateurs

Chantier de durcissement mené après un audit complet (lecture seule, aucune modification) de
l'authentification et de la gestion des utilisateurs telles qu'elles existaient à l'issue du Lot 6.
Objectif explicite : corriger les manques identifiés **sans refaire l'architecture** et sans ralentir
le développement du frontend (portails représentant/master rep/directeur, prochaine étape).

### Les 5 rôles

Aucun rôle ajouté ou retiré — toujours exactement les 5 mêmes qu'au Lot 1 :

| Rôle | Portée |
|---|---|
| REPRESENTANT | ses clients uniquement (`owner_rep_id`), prise de commande, agenda, tâches |
| MASTER_REP | comptes de son équipe + les siens en propre, objectifs en lecture seule |
| FRONT_DESK | toutes les fiches clients/commandes, export Dolibarr, SAV |
| **DIRECTEUR** | vue globale, fixe les objectifs, **gère l'ensemble des utilisateurs de l'application** (tous rôles), accès direct à la vue front desk |
| ADMINISTRATEUR | **rôle spécialisé, volontairement resté étroit** : catalogue produits (CRUD + imports en masse) et import fiches client, plus la fiche client elle-même en lecture/écriture (hors pipeline/commandes). Aucun droit transversal supplémentaire ne lui a été donné dans ce chantier d'authentification — l'accès à la fiche client a été ajouté séparément, cf. « Cloisonnement par rôle appliqué » plus haut et `docs/cahier-des-charges-import-fiches-client.md` section 2. |

Le DIRECTEUR reste le seul rôle de gestion générale de l'entreprise et des utilisateurs — c'est lui,
et lui seul, qui peut créer/désactiver/réactiver un compte de n'importe quel rôle et changer le rôle
d'un utilisateur (sous réserve des garde-fous ci-dessous).

### Séparation des routes d'administration

- `POST /api/team/members` (existant, Lot 5) : reste la **gestion d'équipe commerciale** —
  création de REPRESENTANT/MASTER_REP avec territoires et rattachement à un Master Rep.
  `PATCH /api/team/members/:userId` **vérifie désormais explicitement que la cible est bien un
  REPRESENTANT ou un MASTER_REP** avant toute modification (403 sinon) : cette route ne peut plus
  jamais toucher silencieusement un FRONT_DESK/ADMINISTRATEUR/DIRECTEUR simplement parce qu'on
  connaît son ID.
- `POST /api/admin/users` (nouveau) : **administration générale des utilisateurs**, DIRECTEUR
  uniquement — création de FRONT_DESK/ADMINISTRATEUR (jusqu'ici impossible, corrigé), liste/filtre
  de tous les utilisateurs (tous rôles), activation/désactivation, changement de rôle encadré,
  réinitialisation de mot de passe déclenchée par le directeur. **Le rôle DIRECTEUR n'est jamais
  atteignable via cette route**, ni en création ni en changement de rôle.

### Premier compte DIRECTEUR (bootstrap)

`seed.js` ne doit **jamais** être utilisé pour créer des comptes de production (voir encadré plus
bas) — il n'a donc jamais été la bonne réponse pour créer le tout premier DIRECTEUR d'une
installation réelle. Procédure dédiée :

```bash
cd backend
npm run bootstrap-directeur
```

- Script **CLI uniquement**, jamais une route HTTP — choix délibéré : cela garantit par construction
  qu'aucune procédure de création de DIRECTEUR ne reste exposée publiquement après son usage (pas de
  endpoint à penser à désactiver).
- Se refuse à s'exécuter s'il existe déjà un DIRECTEUR actif en base (protection contre une seconde
  exécution accidentelle).
- Demande interactivement prénom, nom, email, puis un mot de passe (saisi deux fois) — **jamais de
  mot de passe généré ou imposé automatiquement** : aucun compte à identifiants connus n'est créé.
- Le mot de passe est haché (bcrypt) avant stockage, comme tout mot de passe de l'application.
- Action journalisée dans `audit_logs` (`DIRECTEUR_BOOTSTRAPPED`).

**Pour créer un DIRECTEUR supplémentaire** après ce tout premier compte (le script refuse de
tourner une deuxième fois) : un DIRECTEUR existant se connecte, obtient l'`id` du compte à
promouvoir puis appelle directement l'API avec son propre cookie de session —

```
PATCH /api/admin/users/:userId/role   { "role": "DIRECTEUR" }
```

n'est **volontairement pas exposé** (le rôle DIRECTEUR est explicitement exclu de la route de
changement de rôle, pour qu'il ne soit jamais "trivialement" atteignable depuis l'interface
standard). La procédure documentée pour un DIRECTEUR supplémentaire est donc, à ce stade, une
opération manuelle en base par une personne ayant un accès direct à la base de données de
production :

```sql
UPDATE users SET role = 'DIRECTEUR' WHERE id = '<uuid-de-l-utilisateur>';
```

à exécuter par l'équipe technique, jamais depuis l'application — cohérent avec le principe "pas de
promotion DIRECTEUR triviale depuis l'interface standard".

### Connexion à l'application avec le compte DIRECTEUR bootstrappé

1. Ouvrir l'écran de connexion du frontend.
2. Saisir l'email et le mot de passe choisis pendant `npm run bootstrap-directeur`.
3. Le backend pose un cookie de session httpOnly (`token`) — rien à faire côté utilisateur, le
   navigateur le gère automatiquement pour toutes les requêtes suivantes.

### Création des autres comptes

- **REPRESENTANT / MASTER_REP** : `POST /api/team/members` (DIRECTEUR uniquement) — mot de passe
  initial choisi par le directeur.
- **FRONT_DESK / ADMINISTRATEUR** : `POST /api/admin/users` (DIRECTEUR uniquement) — un mot de
  passe temporaire **aléatoire** est généré côté serveur et renvoyé **une seule fois** dans la
  réponse HTTP (jamais journalisé, jamais stocké en clair) ; à communiquer manuellement à la
  personne concernée.
- Dans les deux cas, le compte créé démarre avec `must_change_password = TRUE`.

### Première connexion et changement de mot de passe forcé

Tant que `must_change_password` vaut `TRUE` sur un compte :

- l'utilisateur **peut se connecter** normalement (email + mot de passe temporaire),
- mais **toutes les routes protégées sauf `/api/auth/*`** lui répondent `403
  {"code":"MUST_CHANGE_PASSWORD"}` — appliqué côté **backend** (`middleware/auth.js`), pas
  seulement côté interface : "le frontend n'est jamais une barrière de sécurité".
- le frontend détecte ce cas (`user.mustChangePassword`) et affiche systématiquement l'écran de
  changement de mot de passe à la place du reste de l'application, jusqu'à ce que le changement soit
  effectué.
- `PATCH /api/auth/password` (mot de passe actuel + nouveau) passe alors `must_change_password` à
  `FALSE` et l'utilisateur accède normalement à l'application.

### Politique de mot de passe

Choix délibéré, sur demande explicite : **pas de complexité imposée** (majuscule + chiffre + symbole
obligatoires) — cette contrainte pousse vers des mots de passe faibles-mais-conformes plutôt que vers
de vraies phrases de passe longues, plus sûres et plus faciles à retenir. Règles réellement
appliquées (`backend/src/lib/passwordPolicy.js`) :

- minimum **10 caractères** (les phrases de passe sont donc pleinement acceptées) ;
- refusé si identique à l'adresse email du compte ;
- refusé si présent dans une courte liste de mots de passe évidemment faibles (`password`,
  `azertyuiop`, `moken1234`...) ;
- jamais de mot de passe vide.

Le mot de passe en clair n'est **jamais** journalisé ni stocké — seul son hash bcrypt l'est.

### Mot de passe oublié (réinitialisation)

Structure backend complète et fonctionnelle :

- `POST /api/auth/password-reset/request` `{ email }` — génère un jeton aléatoire (32 octets), n'en
  stocke que le **hash SHA-256** en base (`password_reset_tokens`), avec une expiration de 30 minutes
  et un usage strictement unique (`used_at`). Réponse **toujours identique** que l'email existe ou
  non, pour ne jamais révéler l'existence d'un compte. Limité en débit (voir plus bas).
- `POST /api/auth/password-reset/confirm` `{ token, newPassword }` — vérifie jeton, expiration,
  non-usage, applique la politique de mot de passe, met à jour le hash, marque le jeton utilisé.

**Limitation assumée et documentée plutôt que masquée** : il n'existe à ce jour **aucun système
d'envoi d'email** dans le projet. La structure backend ci-dessus est complète et prête, mais rien
n'envoie réellement le jeton par email — conformément à la consigne, **aucun faux mécanisme d'envoi
n'a été inventé**. En développement (`NODE_ENV !== "production"`), le jeton brut est simplement
journalisé côté serveur pour permettre de tester le flux de bout en bout ; en production ce log doit
être retiré. **Ce qui reste à brancher pour une vraie mise en production** : un fournisseur d'envoi
transactionnel (SMTP applicatif ou API type Postmark/SendGrid/SES) appelé à l'endroit exact du
`console.log` de développement dans `routes/auth.js` — c'est la seule pièce manquante, tout le reste
(génération, stockage sécurisé, expiration, usage unique, validation) est déjà en place et testé.

Côté frontend : lien "Mot de passe oublié ?" sur l'écran de connexion → formulaire email → message
générique de confirmation (avec mention explicite que l'envoi email n'est pas encore branché, et
qu'il faut contacter son directeur en attendant) → écran de saisie du jeton + nouveau mot de passe.

### Désactivation d'un compte — effet immédiat

`requireAuth` (middleware appliqué à toutes les routes protégées) **revérifie en base, à chaque
requête**, que l'utilisateur existe toujours et est actif — il ne fait plus une confiance aveugle au
contenu du JWT jusqu'à son expiration (par défaut 8h). Conséquence : désactiver un compte depuis
`/api/admin/users/:userId/deactivate` coupe l'accès **immédiatement**, même si la personne avait une
session (cookie/JWT) encore valide et en cours d'utilisation — testé explicitement (voir tests
ci-dessous).

Le système garantit aussi qu'il ne peut **jamais rester à zéro DIRECTEUR actif** : un DIRECTEUR ne
peut pas désactiver son propre compte, et une tentative de désactivation du dernier DIRECTEUR actif
restant est refusée (409) même par un tiers — deux garde-fous indépendants pour la même invariante.

### Changement de rôle

Route dédiée `PATCH /api/admin/users/:userId/role`, DIRECTEUR uniquement, avec garde-fous :

- personne ne peut changer son **propre** rôle (y compris un DIRECTEUR) ;
- le rôle **DIRECTEUR est totalement exclu** de cette route, en source comme en destination — ni
  "rétrogradable" ni atteignable depuis l'interface standard (cf. procédure manuelle ci-dessus) ;
- REPRESENTANT ↔ MASTER_REP est autorisé, avec cohérence automatique des rattachements : un Master
  Rep ayant encore des représentants rattachés ne peut pas être rétrogradé tant qu'ils n'ont pas été
  réaffectés (409 explicite) ; les lignes `sales_reps`/`master_reps` sont créées/nettoyées
  automatiquement selon le sens du changement ;
- chaque changement de rôle est journalisé dans `audit_logs` (`ROLE_CHANGED`, avec l'ancien et le
  nouveau rôle).

### Limitation de débit (rate limiting)

Solution standard et maintenue (`express-rate-limit`), pas de système maison :

- `POST /api/auth/login` : 10 tentatives échouées par IP / 15 minutes, message générique, ne révèle
  jamais si l'email existe ;
- `POST /api/auth/password-reset/request` et `/confirm` : 5 requêtes par IP / 15 minutes.

### Sessions : cookie httpOnly uniquement

Le JWT n'est plus dupliqué entre un cookie httpOnly et le `localStorage` du frontend :

- `POST /api/auth/login` pose un cookie `token` (httpOnly, `sameSite=lax`, `secure` en production,
  8h de durée de vie) et **ne renvoie plus le JWT en clair** dans le corps de la réponse JSON.
- Le frontend n'a plus aucune gestion de token côté JS (`localStorage` retiré) — chaque requête part
  avec `credentials: "include"`, le navigateur joint le cookie automatiquement. Le header
  `Authorization: Bearer ...` reste accepté côté API pour la flexibilité (tests, futurs clients non
  navigateur) mais n'est plus utilisé par le frontend web.
- La connexion websocket de notifications temps réel lit désormais le même cookie httpOnly depuis
  les en-têtes de la requête d'upgrade (un navigateur l'envoie automatiquement, même httpOnly) au
  lieu de le faire transiter en clair dans l'URL (`?token=...`, visible dans des logs de proxy) —
  repli conservé sur `?token=` pour un éventuel client non-navigateur.
- `POST /api/auth/logout` efface le cookie côté serveur ; le frontend efface aussi tout son état
  d'authentification local, pour que l'interface ne puisse jamais laisser croire que la session est
  encore active.
- **Limite assumée et documentée plutôt que masquée** : les JWT restent "stateless" côté serveur —
  il n'existe pas de liste de révocation (blacklist) ni de refresh token. Un JWT émis reste
  cryptographiquement valide jusqu'à son expiration (8h) même après un logout ; ce que le logout
  garantit réellement, c'est que **le cookie du navigateur** ne le renvoie plus automatiquement, et
  que toute requête ultérieure sur un compte désactivé est de toute façon bloquée par la
  revérification en base de `requireAuth`. Un système de blacklist/refresh token n'a volontairement
  pas été construit à ce stade ("ne pas développer un système complexe... sauf si réellement
  nécessaire à l'architecture") — à reconsidérer si un besoin métier concret apparaît (ex : révoquer
  une session précise sans attendre l'expiration).

### Interface "Utilisateurs" du portail Directeur

L'API d'administration générale (`/api/admin/users` — liste/filtre, création, activation/
désactivation, changement de rôle, réinitialisation forcée) est **entièrement prête, testée, et
désormais branchée à un écran réel** (`UsersAdmin.jsx`, onglet « Utilisateurs » du portail Directeur —
voir « Portail Directeur » plus bas pour le détail). Cette section restait ici comme trace historique
de l'état au moment de l'audit ; elle est conservée pour ne pas réécrire l'historique du projet, mais
n'est plus d'actualité.

### Environnement de développement vs production

> **Ne jamais utiliser les comptes seed en production.**

`backend/src/scripts/seed.js` reste **exclusivement destiné au développement/à la démonstration** —
tous ses comptes partagent le même mot de passe (`moken1234`), ce qui serait une faille de sécurité
béante en production. Garde-fou ajouté : le script refuse désormais de s'exécuter si
`NODE_ENV=production`, sauf à passer explicitement `ALLOW_SEED=true` (cas d'un environnement de
recette dédié, en connaissance de cause). La création de comptes de production passe exclusivement
par `bootstrap-directeur.js` (premier DIRECTEUR) puis par `/api/admin/users` et
`/api/team/members` (tous les autres comptes).

### Déploiement Render (démo/test, sans rien installer localement)

`render.yaml` à la racine du projet (Blueprint Render) : un service web Node (plan gratuit) qui
build le frontend et sert son résultat (`frontend/dist`) directement depuis le backend Express
(cf. bloc `express.static`/catch-all ajouté dans `server.js`, actif uniquement si ce dossier
existe) — une seule origine pour l'API et le frontend, ce qui évite tout problème de cookie
cross-origin — plus une base PostgreSQL gratuite reliée automatiquement via `DATABASE_URL`.

- `preDeployCommand` applique les migrations puis lance `seed.js` avec `ALLOW_SEED=true` (le
  garde-fou anti-comptes-démo décrit ci-dessus est volontairement contourné ici : ce déploiement
  gratuit **est** un environnement de démo, pas une vraie mise en production).
- `lib/db.js` active désormais le SSL sur la connexion Postgres dès que `NODE_ENV=production`
  (avec certificat auto-signé toléré), sans rien changer en local où `NODE_ENV` n'est pas défini.
- **Limites de la formule gratuite Render, à connaître avant de l'utiliser** : le service web
  s'endort après 15 minutes sans requête (premier chargement plus lent après une pause) et la base
  de données gratuite est automatiquement supprimée 30 jours après sa création (14 jours de délai
  de grâce pour passer sur une formule payante avant suppression effective) — adapté pour tester,
  pas pour stocker de vraies données durablement. L'URL Render est aussi publique (n'importe qui
  la connaissant peut l'atteindre) ; seule l'authentification de l'application protège les données,
  comme pour n'importe quelle vraie application en ligne.
- Pour déployer : créer un compte Render gratuit, mettre le code sur GitHub (l'interface web de
  GitHub permet de glisser-déposer les fichiers sans utiliser `git` en ligne de commande), puis
  dans Render choisir **New > Blueprint** et pointer vers ce dépôt — `render.yaml` est détecté
  automatiquement et crée le service web et la base en une fois.

### Tests exécutés

Tous les tests ci-dessous ont été exécutés réellement (curl avec cookie jars, requêtes SQL directes,
Playwright pour les parcours frontend) — pas seulement relus dans le code — puis les données de test
nettoyées :

1. Connexion valide → 200, cookie de session posé, profil renvoyé.
2. Mot de passe incorrect → 401, message générique.
3. Utilisateur désactivé qui tente de se connecter → 401, message générique (ne révèle pas la
   désactivation avant authentification).
4. Session déjà active d'un utilisateur désactivé **pendant** la session (JWT non expiré) → 403
   `ACCOUNT_DEACTIVATED` sur la requête suivante — effet immédiat vérifié.
5. Création par un DIRECTEUR d'un REPRESENTANT, d'un MASTER_REP (`/api/team/members`), d'un
   FRONT_DESK et d'un ADMINISTRATEUR (`/api/admin/users`) → chacun créé avec succès,
   `must_change_password = true`.
6. Un FRONT_DESK tente de créer un utilisateur via `/api/admin/users` et via `/api/team/members` →
   403 dans les deux cas.
7. Changement de mot de passe (`PATCH /api/auth/password`) : mauvais mot de passe actuel → 401 ;
   mot de passe actuel correct + nouveau valide → 200, hash mis à jour.
8. Parcours complet de première connexion forcée (Playwright, navigateur réel) : connexion avec mot
   de passe temporaire → écran de changement forcé affiché → changement effectué → accès normal à
   l'application → déconnexion → reconnexion avec le nouveau mot de passe, sans réapparition de
   l'écran forcé.
9. Limitation de débit sur le login : au-delà du seuil configuré, 429 sur les tentatives suivantes.
10. Vérifications de rôle sur les routes : chaque route d'administration testée avec un rôle non
    autorisé → 403 systématique.
11. Impossibilité de l'auto-promotion : une route de changement de rôle réservée au DIRECTEUR refuse
    tout appel par un autre rôle (403) ; un DIRECTEUR ne peut pas changer son propre rôle (403).
12. Impossibilité de supprimer le dernier DIRECTEUR actif : auto-désactivation refusée (400) ; avec
    deux DIRECTEUR actifs, désactivation du premier par le second autorisée, ramenant à un seul actif
    — situation ensuite protégée par le même garde-fou d'auto-désactivation.
13. Changement de rôle REPRESENTANT ↔ MASTER_REP : promotion puis rétrogradation d'un représentant
    sans équipe → succès dans les deux sens, tables `sales_reps`/`master_reps` cohérentes ; tentative
    de rétrogradation d'un Master Rep ayant des représentants rattachés → 409.
14. Flux "mot de passe oublié" complet : demande → jeton généré et journalisé (dev) → jeton invalide
    refusé → mot de passe trop court refusé (politique appliquée) → jeton valide + mot de passe valide
    → 200 → jeton réutilisé → refusé (usage unique) → connexion avec le nouveau mot de passe → 200.
15. Connexion websocket de notifications authentifiée par cookie httpOnly (sans `?token=` dans
    l'URL) : testée à la fois en Node direct et dans un vrai navigateur (Playwright) → connexion
    acceptée ; testée aussi sans cookie → fermeture immédiate (code 4001).

## Ajustements suite au retour client détaillé (migration 006)

Six points corrigés/précisés après votre retour, tous appliqués et **testés avec de vraies
requêtes** :

**1. Objectifs — période obligatoire et explicite.** Déjà en place depuis le Lot 5
(`period_start`/`period_end`, deux champs distincts, jamais une notion générique de "période") :
rien à changer côté schéma. Ajout suite à votre demande : `periodEnd` doit désormais être
strictement postérieur à `periodStart`, à la création **et** à la modification — vérifié : créer
un objectif avec une date de fin antérieure à la date de début → 400 ; modifier un objectif
existant pour que sa période devienne incohérente → 400 également (la validation recalcule la
période complète, pas seulement le champ envoyé).

**Règle définitive (revue de cohérence finale) — c'est la date de VALIDATION qui détermine la
période, jamais `created_at`.** Une commande ne compte dans un objectif qu'une fois validée par le
front desk ; c'est sa **date de validation** qui détermine dans quelle période elle compte — jamais
sa date de création. Une commande créée pendant une période mais validée pendant la suivante compte
donc **entièrement dans la période de validation**, pas celle de création. Nouvelle colonne
`orders.validated_at` (migration 011, `TIMESTAMPTZ`), écrite **une seule fois**, exactement au
moment de la transition `ENVOYEE_FRONT_DESK → VALIDEE` (`PATCH /api/orders/:id/status`) — jamais
`updated_at`, qui peut être modifié par d'autres actions ultérieures (annulation, export, etc.) et
ne serait donc pas fiable comme date de référence. Les commandes déjà validées avant cette migration
ont été rétro-remplies une fois (`COALESCE(exported_at, updated_at)`, approximation historique
ponctuelle, pas la règle en vigueur). `computeObjectiveProgress` (et tous les calculs qui doivent
rester cohérents avec lui — voir `GET /api/dashboard/customer-performance`) filtrent désormais sur
`o.validated_at BETWEEN period_start AND period_end`. La bascule précommande → CA ferme
(`converted_to_firm`) ne change ni ne réécrit `validated_at` : seul le type d'objectif compté change,
la période reste celle de la validation d'origine. **Testé** : commande créée et validée dans la même
période → comptée normalement ; commande créée en période A mais validée en période B → comptée
**uniquement** dans l'objectif de la période B (zéro dans A) ; commande seulement envoyée au front
desk (jamais validée) → zéro dans tout objectif ; précommande validée → compte dans l'objectif
`PRECOMMANDE` de sa période de validation ; précommande confirmée livrée → bascule vers `CHIFFRE_AFFAIRES`
selon la logique déjà en place (point 2 du Lot 5), sans changer sa période.

**2. Master Rep — ne peut jamais réaffecter un compte, règle définitive.** Déjà appliqué depuis
le Lot 2 (`canReassignAccount` dans `scope.js` n'a jamais inclus `MASTER_REP`) ; passé de
"hypothèse à confirmer" à règle actée dans le code et le README. Vérifié à nouveau : un Master Rep
qui tente `PATCH /api/accounts/:id` avec `ownerRepId` → 403 ("Seuls le front desk et le directeur
peuvent réaffecter un compte.") ; front desk et directeur → autorisés.

**3. Statut client : Actif → Inactif → Archivé, jamais de suppression.** Nouvelle colonne
`accounts.status` (`ACTIF` par défaut) + `archived_at`, et `PATCH /api/accounts/:id/status`.
Aucune route `DELETE` sur les comptes n'a jamais existé et n'existera pas — l'archivage est la
seule "fin de vie" possible, et il conserve l'intégralité de la fiche et de son historique
(interactions, commandes, SAV). Cycle strict : `ACTIF ↔ INACTIF` est une bascule opérationnelle
ouverte à tout rôle ayant accès au compte (comme le pipeline) ; `INACTIF → ARCHIVE` est réservé
**front desk/directeur, règle définitive** et **terminal** — aucune réactivation
depuis `ARCHIVE`. `GET /api/accounts` masque les comptes archivés par défaut (pour ne pas encombrer
la liste courante) mais les montre toujours explicitement via `?status=ARCHIVE` — aucune donnée
perdue. Testé : représentant désactive son propre compte (`ACTIF→INACTIF`, ok) ; représentant tente
d'archiver → 403 ; front desk archive (`INACTIF→ARCHIVE`, ok, `archivedAt` horodaté) ; tentative de
réactivation d'un compte archivé → 409 ; compte archivé absent de la liste par défaut mais présent
via le filtre explicite, et toujours consultable individuellement avec son historique intact.

**4. Remise Combo — retirée complètement, pas seulement bloquée en façade.** La valeur d'enum
`REMISE_COMBO` a été retirée du type PostgreSQL `business_rule_type` lui-même (recréation propre du
type, pas un simple filtre applicatif), après suppression des éventuelles règles Combo existantes.
Toute la logique de sélection/priorité Combo vs Catégorie a été supprimée de `pricing.js`, et le
champ `comboApplied` retiré de la réponse de `POST /api/orders`. Il ne reste que la remise par
catégorie (`REMISE_CATEGORIE`). Vérifié : créer une règle `REMISE_COMBO` via l'API → rejetée par la
validation (valeur d'enum inexistante) ; `SELECT enum_range(NULL::business_rule_type)` en base ne
liste plus `REMISE_COMBO` ; une commande avec remise catégorie fonctionne normalement, sans le champ
`comboApplied`.

**5. Configuration Dolibarr — simplifiée selon vos réponses concrètes.** `dolibarr_settings`
porte maintenant `dolibarrVersion` (23.0.3, informatif), et de vraies valeurs métier par défaut :
`paymentTermDays` (30 jours) et `paymentMode` (`PRELEVEMENT_SEPA` ou `LCR` uniquement — toute autre
valeur est rejetée par la validation), tous deux modifiables uniquement par front desk/directeur
comme le reste de ces réglages. `defaultWarehouseId` a désormais un vrai défaut : "Entrepôt
principal". La gestion par ID Dolibarr générique de la TVA a été **retirée** (colonne
`default_vat_rate_id` supprimée) — *mise à jour ultérieure (migration 007, section dédiée plus
bas) : la TVA est en fait gérée, mais via un vrai régime fiscal par compte (`regimeFiscal`), pas via
un ID Dolibarr générique.* Le `fk_user` des représentants a été **retiré entièrement** (colonne
`users.dolibarr_user_id` supprimée, route `PATCH /api/users/:id/dolibarr` retirée) puisque
l'intégration se fait exclusivement par fichier, jamais par API Dolibarr. Les éventuels ID internes
Dolibarr pour les conditions/mode de paiement (`defaultPaymentTermId`/`defaultPaymentModeId`)
restent disponibles en configuration optionnelle/avancée pour plus tard, mais ne bloquent et ne
signalent plus rien désormais que les vraies valeurs métier sont connues. Le fichier CSV généré
reflète tout ça : colonnes `entrepot`, `condition_paiement_jours`, `mode_paiement` (libellé lisible)
ajoutées ; `taux_tva_dolibarr_id` et `rep_dolibarr_user_id` supprimées. Vérifié avec un export réel :
`Entrepôt principal;...;30;...;Prélèvement SEPA;...`.

**6. Correspondance produit CRM ↔ Dolibarr.** Nouveau champ `products.dolibarrRef`, utilisé dans le
fichier d'export à la place de la référence CRM (`ref`) uniquement quand il est renseigné
(`COALESCE(dolibarr_ref, ref)`) — la référence existante reste utilisée par défaut, ce champ ne
sert qu'en complément quand elle ne suffit pas à la correspondance. Modifiable via
`POST`/`PATCH /api/products` (administrateur), et reconnu automatiquement à l'import en masse
(colonnes détectées : "Code Dolibarr", "Dolibarr Ref", etc.). Vérifié : produit créé avec
`dolibarrRef: "DLB-999"` → le CSV d'export utilise bien `DLB-999` comme `produit_ref` au lieu de la
référence CRM.

## Régime fiscal et calcul de TVA export (migration 007)

**⚠️ Base fournie par vous, non définitive — à valider par votre expert-comptable avant mise en
production.** Tout reste configurable en base, rien n'est codé en dur au-delà de ce qui a été
explicitement communiqué.

- Nouveau champ `accounts.regimeFiscal` (`FRANCE_STANDARD` | `INTRACOMMUNAUTAIRE_HT` |
  `RECARGO_EQUIVALENCIA` | `EXPORT_HORS_UE_HT`), **indépendant de la typologie commerciale**
  (Opticien, Surf Shop... reste un champ marketing distinct, aucun lien entre les deux).
- Défaut dérivé automatiquement du pays à la création (`lib/taxRegime.js`), toujours modifiable
  manuellement ensuite, cas par cas (`PATCH /api/accounts/:id` avec `regimeFiscal`). **Règle
  définitive confirmée par vous :** si le pays d'un client change après coup, le `regimeFiscal` déjà
  défini n'est **jamais recalculé automatiquement** — il doit être changé à la main. Le code ne
  contient d'ailleurs aucune logique qui touche à `regimeFiscal` lors d'une mise à jour du pays ; le
  défaut par pays ne s'applique qu'une seule fois, à la création du compte :
  - France → `FRANCE_STANDARD`.
  - Espagne, Allemagne, Italie, Portugal, Belgique, Pays-Bas → `INTRACOMMUNAUTAIRE_HT`.
  - Suisse, Royaume-Uni → `EXPORT_HORS_UE_HT`.
  - `RECARGO_EQUIVALENCIA` : **jamais automatique**, uniquement à la main sur un client espagnol
    identifié comme tel — vérifié : un compte espagnol créé sans le préciser reçoit bien
    `INTRACOMMUNAUTAIRE_HT`, jamais `RECARGO_EQUIVALENCIA`.
- `GET/PATCH /api/dolibarr/settings` porte maintenant `vatRateFranceStandard` (20% par défaut,
  configurable) et `vatRateRecargoEquivalencia` (`null` par défaut — **volontairement jamais
  deviné**, à configurer avec votre expert-comptable).
- Calcul du taux exporté (`lib/taxRegime.js#vatRateForRegime`, utilisé dans le CSV Dolibarr) basé
  **uniquement sur `regimeFiscal`**, jamais sur le pays seul ni la typologie : `FRANCE_STANDARD` →
  taux configuré (20% par défaut) ; `INTRACOMMUNAUTAIRE_HT` et `EXPORT_HORS_UE_HT` → toujours 0% ;
  `RECARGO_EQUIVALENCIA` → taux configuré, ou vide si non configuré (jamais 0% par défaut, pour ne
  pas laisser croire à un taux validé qui ne l'est pas). Deux nouvelles colonnes dans le CSV export :
  `regime_fiscal` et `taux_tva_pct`.
- Check-list d'export (`GET /api/dolibarr/orders/:id/export-checklist`) : deux nouveaux
  avertissements **non bloquants**, dans le même esprit que les avertissements Dolibarr déjà en
  place — numéro de TVA intracommunautaire manquant sur un compte en régime Intracommunautaire HT ;
  taux Recargo de Equivalencia non configuré sur un compte en régime Recargo.
- **Testé de bout en bout** avec des comptes et exports réels dans les 4 régimes : FR → 20% exporté ;
  compte espagnol par défaut → Intracommunautaire HT → 0% exporté, avertissement si TVA intraco
  manquante (n'empêche pas l'export) ; compte espagnol forcé manuellement en Recargo → taux vide et
  avertissement tant que non configuré, puis 5,20% exporté une fois `vatRateRecargoEquivalencia`
  renseigné ; compte suisse/anglais → Export hors UE HT → 0% exporté.

## Remise catégorie — sélection multiple de représentants (migration 013)

Demande explicite du client, tranchant la question laissée en suspens plus tôt sur le ciblage des
règles commerciales de portée Représentant : « le plus simple est d'avoir une sélection lors de la
création de la règle (remise) avec une sélection multiple des représentants concernés. Ils auront
par la suite le bouton de remise catégorie correspondant qui s'affichera en haut de la catégorie sur
le récap de commande. Ce sera à eux de l'activer ou non en fonction de la commande. »

- `business_rules.rep_id` (un seul représentant par règle) est remplacé par une table de jonction
  many-to-many `business_rule_reps (business_rule_id, rep_id)`, qui permet à une même règle
  `REMISE_CATEGORIE` de portée `REPRESENTANT` de cibler plusieurs représentants à la fois. La colonne
  `rep_id` est conservée sur `business_rules` (aucune suppression de donnée) mais n'est plus lue par
  le code — elle porte un commentaire SQL expliquant son obsolescence. Les règles existantes qui
  avaient un `rep_id` ont été automatiquement migrées vers la nouvelle table.
- `GET /api/business-rules`, `POST /api/business-rules` et `PATCH /api/business-rules/:id`
  exposent désormais `repIds` (tableau d'UUID) à la place de `repId`. Une règle de portée
  `REPRESENTANT` doit obligatoirement avoir au moins un représentant sélectionné (HTTP 400 sinon,
  à la création comme à la mise à jour) — une règle Représentant sans représentant ne pourrait
  jamais s'appliquer, ce serait un piège silencieux pour le directeur qui la crée. Si le `scope`
  d'une règle est modifié pour quitter `REPRESENTANT` (vers `GLOBAL` ou `PAYS`) sans qu'un nouveau
  `repIds` soit fourni, la sélection de représentants est automatiquement vidée (elle n'aurait plus
  de sens sur une règle qui ne cible plus un représentant précis).
- Priorité de sélection de règle inchangée (`lib/pricing.js#pickRule`) : Représentant > Pays >
  Global, la plus spécifique l'emporte. Le représentant retenu pour matcher une règle
  `REPRESENTANT` est le propriétaire du compte client (`account.ownerRepId`/`owner_rep_id`), pas
  forcément l'utilisateur connecté qui saisit la commande — cohérent avec le fait qu'un front desk
  ou un master rep peut saisir une commande pour le compte d'un représentant.
- Écran représentant (`NewOrder.jsx`, prise de commande) : le bouton de remise catégorie n'apparaît
  en haut d'une catégorie du récapitulatif de commande **que si une règle active s'applique** à ce
  représentant/cette catégorie (`pickDiscountRule`, même logique de priorité que le serveur). Le
  représentant l'active ou le désactive librement par commande (interrupteur, activé par défaut dès
  qu'une règle s'applique) — ce n'est qu'un aperçu côté client : le serveur recalcule toujours la
  remise réelle à l'enregistrement (`POST /api/orders`), sans jamais faire confiance au taux envoyé
  par le client.
- **Vérifié :** création d'une règle `REPRESENTANT` avec `repIds` vide → HTTP 400 ; création avec un
  `repIds` valide → règle créée, `repIds` renvoyé correctement (tableau JS, pas une chaîne postgres
  brute — confirmé via `json_agg` côté SQL, node-postgres ne parsant pas fiablement les tableaux de
  types custom comme `product_category[]`) ; `GET /api/business-rules` renvoie bien `repIds` comme
  tableau exploitable ; commande réelle passée par le représentant ciblé sur un produit de la
  catégorie visée → remise appliquée (25% testé, contre 10% pour la règle globale existante,
  priorité Représentant > Global bien respectée) ; commande passée par un représentant **non**
  ciblé par la règle sur le même compte/produit → retombe bien sur la règle Globale (10%), ni 0% ni
  25% ; mise à jour de `repIds` d'une règle existante (ajout d'un second représentant) → persistée
  et relue correctement ; changement de `scope` vers `GLOBAL` sans fournir `repIds` → `repIds` vidé
  automatiquement ; remise en `REPRESENTANT` avec `repIds` → de nouveau refusée si vide (HTTP 400).

## Portail Master Rep

Deuxième portail construit après celui du Représentant (priorité annoncée dans la version
précédente de cette section — voir « Prochaine étape » ci-dessous), fidèle à la maquette
(`docs/prototype-crm-commercial.jsx`, `masterRepNav`) et au tout le backend déjà scopé pour ce rôle
depuis les lots précédents (`lib/scope.js`, `lib/dashboardScope.js`, `lib/managedReps.js`,
`accountsScopeClause`, `objectives.js`, `dashboard.js`, `tasks.js`, `orders.js`) — aucune nouvelle
règle de cloisonnement n'a dû être inventée pour ce portail, seul l'écran manquait.

- **Mon équipe** (`GET /api/team/mine`, nouvelle route restreinte au Master Rep lui-même — distincte
  de `GET /api/team/members`, réservée au directeur et qui expose l'équipe complète de
  l'entreprise) : liste des représentants qui lui sont affectés par la direction
  (`sales_reps.master_rep_id`), avec pour chacun la progression de ses objectifs **Chiffre
  d'affaires actifs** (période en cours), plus deux cartes de synthèse d'équipe (CA ferme cumulé et
  précommandes en cours, sur les objectifs actifs de toute l'équipe). Écran d'accueil du Master Rep
  (`homePath`), à la place d'un tableau de bord séparé — cohérent avec la maquette, qui n'a pas
  d'onglet « Tableau de bord » pour ce rôle. Entièrement en lecture seule : le Master Rep ne fixe
  jamais d'objectif (section 3 du handoff), seul le lien vers la fiche de chaque représentant est
  cliquable.
- **Fiche représentant consolidée** (`/equipe/:repId`) : objectifs (tous, actifs ou non, avec
  progression individuelle), tâches et prochains rendez-vous d'UN représentant de l'équipe — pas de
  nouvelle route backend dédiée, recomposée côté client à partir des mêmes endpoints déjà scopés
  équipe (`/objectives`, `/objectives/:id/progress`, `/tasks`, `/dashboard/rdv`), filtrés sur
  `repId`.
- **Clients & prospects**, **fiche client**, **prise de commande/panier**, **suivi des commandes** :
  réutilisent tels quels les écrans du portail Représentant (`ClientsList.jsx`, `AccountDetail.jsx`,
  `NewOrder.jsx`, `OrdersList.jsx`) — déjà entièrement génériques côté rôle, le cloisonnement étant
  géré exclusivement côté serveur. Seul ajout : le nom du représentant propriétaire du compte
  s'affiche désormais en badge dans la liste des clients quand il diffère de l'utilisateur connecté
  (utile au Master Rep, qui voit les comptes de plusieurs représentants de son équipe en plus des
  siens propres) — `GET /api/accounts` joint maintenant le prénom/nom du propriétaire.
  « Commandes » a été ajouté à la navigation Master Rep en plus de la maquette d'origine (qui ne
  l'y affichait pas) : `NewOrder.jsx` redirige vers `/commandes` après l'envoi d'une commande, cette
  route doit donc rester atteignable depuis la nav. Pas de Catalogue ni de Data séparés pour ce
  rôle — cohérent avec le Représentant, dont l'onglet Data lui-même n'a encore qu'un écran «
  Bientôt disponible ».
- **Agenda équipe** (`Agenda.jsx`, réutilisé) : `GET /api/dashboard/rdv` et `GET /api/tasks`
  renvoient déjà, pour un Master Rep, ses propres rendez-vous/tâches **et** ceux de son équipe
  affectée. Un Master Rep ne peut cocher une tâche ou saisir un compte rendu de rendez-vous que sur
  ses **propres** éléments (même règle que le serveur, `tasks.js` `isOwnTask`/`isPrivileged`) — ceux
  de son équipe s'affichent en lecture seule, avec le nom du titulaire en badge pour les distinguer
  des siens. `GET /api/tasks` joint maintenant le prénom/nom du titulaire de chaque tâche pour
  permettre cet affichage (absent auparavant, l'écran n'avait jusqu'ici qu'un seul titulaire
  possible : soi-même).
- **Vérifié** (via Playwright, en conditions réelles avec les comptes de démonstration) : connexion
  Master Rep → atterrit sur « Mon équipe » ; les deux représentants affectés apparaissent (dont un
  compte désactivé, correctement badgé, sans objectif actif) ; la somme des objectifs CA actifs
  affichée sur la fiche équipe correspond exactement à la somme affichée sur la fiche représentant
  consolidée (3 588 € / 52 300 € dans les deux cas) ; ouverture d'un compte client d'un représentant
  de l'équipe, passage d'une commande complète jusqu'à l'envoi au front desk, retrouvée dans
  « Commandes » avec le bon statut ; liste des clients affiche le badge du représentant propriétaire
  uniquement quand il diffère du Master Rep connecté ; dans l'agenda, les rendez-vous et tâches de
  l'équipe s'affichent avec le nom du représentant et leurs cases à cocher/bouton « compte rendu »
  sont désactivés, alors que ceux du représentant lui-même restent pleinement interactifs (testé en
  se connectant successivement comme Master Rep puis comme le représentant concerné) ; aucune
  régression constatée sur les portails Représentant et Front desk/Directeur après les changements
  partagés (`GET /api/accounts`, `GET /api/tasks`).

## Portail Directeur

Troisième et dernier portail commercial construit (après Représentant puis Master Rep — voir sections
dédiées ci-dessus), sur tout le backend déjà en place depuis les lots précédents (`team.js`,
`admin-users.js`, `objectives.js`, `business-rules.js`, `dashboard.js`, `dolibarr.js`, `accounts.js`)
— une seule route backend a dû être ajoutée (`GET /api/countries`, jusqu'ici seulement consommée en
jointure, jamais exposée en liste — nécessaire aux formulaires de création de compte/territoire) et
une seule route existante étendue (`GET /api/business-rules?includeInactive=true`, réservé au
directeur, pour que l'écran Config puisse aussi réactiver une règle désactivée — le calcul de prix
continue d'utiliser exclusivement la variante « actives seulement »).

- **Tableau de bord** (`DirecteurDashboard.jsx`, écran d'accueil) : trois indicateurs globaux (CA
  ferme et précommandes cumulés sur les objectifs actifs de toute l'entreprise, nombre de commandes
  en attente au front desk), un tableau de performance d'équipe imbriqué (Master Reps → leurs
  représentants → représentants non rattachés, même construction que « Mon équipe » côté Master Rep
  mais sur l'équipe complète), et le formulaire de **fixation d'objectif** (`POST /api/objectives`,
  strictement réservé au directeur — le Master Rep ne les voit qu'en lecture seule, cf. portail
  Master Rep).
- **Clients & prospects** (`ClientsList.jsx`/`AccountDetail.jsx`, réutilisés et étendus) : le
  directeur voit tous les comptes de l'entreprise (déjà le cas côté serveur, `accountsScopeClause`).
  Deux ajouts réservés à son rôle : un filtre par représentant/Master Rep (100 % côté client, la
  liste étant déjà complète) et un formulaire de création de compte (`POST /api/accounts`, déjà
  supporté serveur avec `ownerRepId` obligatoire pour ce rôle). Sur la fiche compte, une section
  **Réaffectation** s'affiche uniquement pour le directeur (représentant propriétaire / Master Rep,
  `PATCH /api/accounts/:id`, sauvegarde immédiate au changement — repris du prototype) ; le bouton
  « Nouvelle commande », lui, ne s'affiche pas pour ce rôle (le directeur pilote, il ne prend pas
  commande — hors périmètre tel qu'annoncé).
- **Équipe** (`TeamManagement.jsx`, nouvel écran, chemin `/equipe` — distinct de la page « Mon
  équipe » en lecture seule du Master Rep, qui utilise le même chemin mais jamais pour le même rôle)
  : gestion complète des représentants et Master Reps sur `/api/team` — création (avec mot de passe
  initial et rattachement optionnel à un Master Rep), rattachement/dé-rattachement, affectation de
  territoires (badges cliquables), activation/désactivation, création de territoires. Strictement
  séparé de l'écran Utilisateurs ci-dessous (routes backend distinctes, cf. section authentification
  plus haut : `team.js` ne peut jamais toucher un compte FRONT_DESK/ADMINISTRATEUR/DIRECTEUR).
- **Front desk** : accès direct à `FrontDesk.jsx`, déjà prévu pour ce rôle depuis le Lot 4
  (`EXPORT_ROLES` y inclut DIRECTEUR) — aucun changement nécessaire, juste rendu atteignable depuis
  la nouvelle nav.
- **Data** (`Data.jsx`, nouvel écran) : quatre onglets sur `dashboard.js` — Bestsellers, Performance
  clients (comparatif CA année en cours / année précédente par compte), Analytics (réservé directeur
  — répartition CA ferme vs précommande par catégorie et par pays, avec la bascule précommande→ferme
  uniquement sur confirmation de livraison, cohérent avec `computeObjectiveProgress`), et Extraction
  (téléchargement du fichier `.xlsx` détaillé, `GET /api/dashboard/extract.xlsx`).
- **Config** (`BusinessRules.jsx`, nouvel écran) : gestion des règles commerciales — création avec
  champs conditionnels au type (Remise par catégorie : catégories + taux ; Frais de port : montant
  forfaitaire + seuil de franco ; les trois autres types — Conditions de paiement, Taxe, Export
  Dolibarr — n'ont aucun champ métier structuré défini nulle part, y compris dans le prototype
  d'origine où ils sont des stubs non implémentés : plutôt que d'inventer des champs sans donnée
  réelle du client, seuls la portée et le statut actif leur sont proposés pour l'instant), portée
  Globale/Pays/Représentant (sélection multiple de représentants par badges, migration 013), et
  statut actif/inactif togglable — **jamais de suppression**, cohérent avec le reste de
  l'application : la liste inclut désormais les règles désactivées pour permettre leur réactivation.
  Une seconde section du même écran couvre les réglages d'export Dolibarr (`dolibarr.js`, déjà
  utilisés en lecture par le front desk pour la check-list d'export, ici en écriture par le
  directeur).
- **Utilisateurs** (`UsersAdmin.jsx`, nouvel écran) : administration générale des comptes sur
  `/api/admin/users` — création de comptes FRONT_DESK/ADMINISTRATEUR avec mot de passe temporaire
  affiché **une seule fois** dans un encart explicite juste après création (jamais journalisé,
  jamais récupérable ensuite), changement de rôle encadré, activation/désactivation, réinitialisation
  forcée de mot de passe (même encart à affichage unique). Les lignes DIRECTEUR (y compris son propre
  compte) s'affichent sans aucune action disponible — ce rôle ne se gère pas depuis cette interface
  (cf. section authentification plus haut).
- **Agenda** : accès à `Agenda.jsx`, réutilisé tel quel — `tasks.js` et `dashboard.js#/rdv` renvoient
  déjà, pour un directeur, l'ensemble des tâches/RDV de tous les représentants et Master Reps
  (`isPrivileged`, même logique que pour le front desk), sans restriction de propriétaire pour
  cocher/saisir un compte rendu.
- **Pas d'écran « Carte »** : la maquette (`docs/prototype-crm-commercial.jsx`) en propose une, mais
  elle affiche les comptes sur un fond de carte SVG à partir de coordonnées latitude/longitude qui
  **n'existent nulle part dans le schéma réel** (aucune colonne `lat`/`lng`, confirmé par relecture de
  toutes les migrations) — la maquette elle-même la présente comme un prototype grossier, pas
  destinée à être reprise telle quelle. Conformément à la consigne du projet de ne jamais inventer de
  donnée, cet écran n'a pas été construit. La seule partie réellement utile qu'il aurait offerte — le
  filtrage multi-critères des comptes par représentant/typologie — est reprise dans l'écran Clients &
  prospects ci-dessus (filtre par représentant/Master Rep déjà en place ; filtre par typologie non
  ajouté faute de demande explicite, facile à ajouter si besoin).
- **Bug corrigé au passage** (`lib/businessRules.js`) : `categories` (type PostgreSQL
  `product_category[]`) revenait côté driver en texte brut non parsé (ex. `"{PREMIUM,CLASSIC}"` plutôt
  qu'un vrai tableau JS) — sans conséquence visible jusqu'ici car `lib/pricing.js` ne fait qu'un
  `.includes()` dessus (un match par sous-chaîne fonctionne par coïncidence, aucune valeur de l'enum
  n'étant sous-chaîne d'une autre), mais cassait tout code ayant besoin d'un vrai tableau — découvert
  en construisant l'écran Config (`rule.categories.join is not a function`). Corrigé via
  `to_jsonb(br.categories) AS categories` dans les deux requêtes de lecture ; `lib/pricing.js` n'est
  pas impacté (un `.includes()` exact sur un vrai tableau est même plus correct qu'un match par
  sous-chaîne). Le même type de colonne existe sur `objectives.categories`/`objectives.sectors` mais
  n'est lu comme tableau par aucun écran construit à ce jour — non corrigé, car hors périmètre
  observable, à garder en tête si un futur écran en a besoin.
- **Vérifié** (via Playwright, en conditions réelles avec le compte de démonstration
  `directeur@moken.demo`) : connexion → atterrit sur le tableau de bord ; création d'un objectif
  (le montant cible s'ajoute bien au total affiché, la ligne du Master Rep concerné se met à jour) ;
  création d'une règle commerciale (apparaît immédiatement dans la liste) puis désactivation (reste
  visible, badgée « Désactivé », jamais supprimée) ; création d'un compte FRONT_DESK (mot de passe
  temporaire affiché une fois, compte visible ensuite avec le badge « Doit changer son mot de passe »)
  ; réaffectation du représentant propriétaire d'un compte client (persistée après rechargement complet
  de la page) ; les quatre onglets Data s'affichent sans erreur avec des données réelles ; aucune
  régression constatée sur les portails Représentant et Master Rep après les changements partagés
  (`ClientsList.jsx`, `AccountDetail.jsx`, `translations.js`) — testé en se reconnectant successivement
  comme `rep@moken.demo` et `masterrep@moken.demo`.

## Documents de référence du projet

- `docs/cahier-des-charges-export-dolibarr.md`
- `docs/cahier-des-charges-import-catalogue.md` — périmètre général de l'import catalogue
- `docs/cahier-des-charges-import-fiches-client.md` — périmètre général de l'import fiches client
- `docs/cahier-des-charges-champs-import-catalogue.md` — référence champ par champ pour configurer
  un export Dolibarr enrichi côté catalogue (inclut le téléversement direct de photo, section 5 bis)
- `docs/cahier-des-charges-champs-import-fiches-client.md` — référence champ par champ pour
  configurer un export Dolibarr enrichi côté fiches client
- `docs/rapprochement-photos-mokenvision.md` — rapprochement automatique des photos produit avec
  mokenvision.com, et alternative par téléversement pour les produits pas encore en ligne
- `docs/etat-final-prototype-handoff.md`
- `docs/plan-developpement-claude-code.md`
- `docs/prototype-crm-commercial.jsx` — référence visuelle et logique fonctionnelle

## Prochaine étape

**Les 6 lots du plan de développement initial sont désormais tous livrés et testés**, y compris le
Lot 6 (audit/historique, notifications temps réel, multilingue FR/EN/ES, PWA/hors-ligne partiel —
voir la section dédiée plus haut pour le détail et les limites honnêtes de chaque point), et le
chantier de durcissement authentification/gestion des utilisateurs qui a suivi (voir section dédiée)
est également livré et testé.

**Les quatre portails sont désormais tous construits et testés** : Représentant, Master Rep,
Directeur (voir les sections « Portail Master Rep »/« Portail Directeur » ci-dessus pour le détail
de chacun) et **Administrateur** (catalogue produits + import en masse, import fiches client, fiche
client en lecture/écriture hors commandes/pipeline — voir « Authentification et gestion des
utilisateurs » ci-dessus, rôle ADMINISTRATEUR, pour le détail exact du périmètre retenu). Le
Directeur dispose d'une vision globale sur toute l'entreprise — tableau de bord, CRM élargi avec
réaffectation, gestion d'équipe complète, accès direct au front desk, Data complet
(bestsellers/performance clients/analytics/extraction), gestion des règles commerciales et des
réglages Dolibarr, et administration des comptes front desk/administrateur. Seul écart assumé par
rapport à l'énumération initiale : pas d'écran « Carte » (données de géolocalisation inexistantes
dans le schéma réel — voir « Portail Directeur » ci-dessus pour la justification complète et ce qui
en a été repris ailleurs).

Ce qui a été ajouté depuis, à la demande du client : l'import Dolibarr enrichi (comptes et
catalogue, champs facultatifs au-delà du strict nécessaire — cf. les deux cahiers des charges
`champs-import-*`), le rapprochement automatique des photos produit avec mokenvision.com, et le
téléversement direct d'une photo produit sans passer par une URL, pour les produits pas encore
vendus en ligne (voir `docs/rapprochement-photos-mokenvision.md` section 5 bis).

**Corrections V2 (2026-09-16), suite aux 5 fiches correctives par rôle transmises le 15/09/2026.**
La quasi-totalité des points P0/P1 relevés (détail des commandes, badge "à traiter", stock/réassort
visible à la prise de commande, ouverture directe de l'élément depuis une notification) a été
corrigée directement, sans qu'il y ait matière à trancher. Deux points remettaient en cause des
décisions déjà actées avec vous et ont donc fait l'objet d'une question explicite avant toute
modification :
- **Fichier Dolibarr : CSV → .xlsx.** Le PDF Front Desk demande littéralement un "Fichier Dolibarr
  (.xlsx)" alors que le Lot 4 avait délibérément retenu un CSV (voir plus haut). Sur confirmation,
  le front desk télécharge désormais un vrai classeur Excel (`lib/dolibarrExport.js#buildDolibarrXlsx`,
  bibliothèque `xlsx` déjà utilisée par `GET /api/dashboard/extract.xlsx`) — mêmes colonnes/valeurs
  que le CSV, qui reste disponible dans le code (`buildDolibarrCsv`) pour un usage outillage éventuel
  mais n'est plus ce qui est proposé au téléchargement. Le réglage "délimiteur CSV" a été retiré de
  l'écran de configuration Directeur (`BusinessRules.jsx`), devenu sans objet pour ce flux.
- **Année commerciale (01/11-31/10) sur les tableaux de bord.** Le PDF Représentant fixe cette règle
  pour le "portefeuille annuel et les indicateurs annuels" — jusqu'ici codée en année civile
  (1er janvier) sur le Dashboard Représentant, et délibérément laissée en année civile sur le
  Dashboard Directeur (décision documentée dans une version antérieure de ce code, désormais
  remplacée). Sur confirmation explicite, et **strictement cantonné à la lisibilité des indicateurs
  cumulés des trois tableaux de bord** (Représentant/Master Rep/Directeur) — portefeuille
  gagné/perdu/actifs (a) commandé/(n'a) pas commandé, et CA ferme/précommandes cumulés vs objectif :
  nouveau `frontend/src/lib/fiscalYear.js` (bornes 01/11-31/10), utilisé pour la fenêtre de calcul du
  portefeuille (Dashboard.jsx, DirecteurDashboard.jsx) et pour une étiquette "Année commerciale
  2025–2026" affichée à côté de ces blocs cumulés (les trois dashboards). Rien d'autre ne change : ni
  les dates explicites que le Directeur choisit lui-même pour chaque objectif, ni les autres écrans
  qui restent volontairement en année civile (Data/RepData.jsx, historique de la fiche compte,
  extraction Directeur...).

**Corrections V3 (2026-09-16), suite aux 6 fiches correctives transmises le même jour (Représentant,
Parcours de création de commande, Master Rep Backend, Administrateur, Direction Commerciale, Front
Desk).** Constat préalable important : en reprenant chaque point un par un dans le code, une bonne
partie de ce qui était signalé "cassé" ou "absent" (panneau de notifications mal positionné, actions
Consulter/Valider/Export Dolibarr du front desk, accès global du front desk aux clients) s'est avérée
déjà corrigée dans une session précédente — jamais déployée sur la bêta Render testée, qui reflétait
donc une version plus ancienne du code que celle disponible ici. Mécanisme de déploiement clarifié
depuis (2026-09-16) : le client pousse lui-même le code vers `github.com/sobadfin-art/layer-crm`
(dépôt connecté à Render), déploiement confirmé fonctionnel sur `moken-crm.onrender.com`.

Corrections réellement apportées ce lot :
- **Parcours de création de commande (Représentant) :** le panier ne se vide plus lors d'un
  changement de catalogue et les produits d'un catalogue quitté restent résolubles au récapitulatif
  (`NewOrder.jsx`, accumulateur `productsById`) — jusqu'ici, changer de catalogue effaçait le panier
  et perdait silencieusement les articles d'un catalogue précédent, ce qui explique probablement le
  ressenti "commande impossible à finaliser". Ajout d'une saisie directe de quantité en plus des
  boutons +/-, conforme au document de référence "Parcours de création de commande" (section 4).
- **Directeur — création de commande (nouveau) :** override explicite documenté par la fiche
  Direction Commerciale V3 ("remplacent les règles antérieures... notamment sur la capacité à créer
  une commande") pour ce rôle uniquement — **le Master Rep reste strictement en lecture seule, décision
  client distincte non concernée**. Route `/clients/:id/commande` + bouton "Nouvelle commande" sur la
  fiche compte + `ORDER_CREATE_ROLES` côté serveur (`routes/orders.js`), qui n'autorisait jusqu'ici que
  le Représentant.
- **Accès rapide "Nouvelle commande" depuis le dashboard (nouveau) :** bouton en haut à droite du
  Dashboard Représentant et du Dashboard Directeur, sélection obligatoire d'un client existant avant
  d'ouvrir le catalogue (`components/NewOrderQuickAccess.jsx`) — n'existait nulle part auparavant.
- **Master Rep — comptes de l'équipe pas correctement affichés (bug réel corrigé) :** le scope
  `MASTER_REP` s'appuyait sur `accounts.master_rep_id`, un champ jamais renseigné quand un
  représentant crée lui-même son compte (le cas normal) et jamais mis à jour lors d'une réaffectation
  d'équipe. Le scope repose désormais sur une jointure vivante contre `sales_reps`/`master_reps`
  (`lib/scope.js`), + migration `019_backfill_accounts_master_rep.sql` pour les comptes existants.
- **Directeur — "Rendez-vous du jour"/"Tâches du jour" (dashboard) et "Performance de l'équipe"
  (Équipe) :** nouveaux blocs, vision globale tous représentants, réutilisant les endpoints agenda
  déjà scopés globalement pour ce rôle côté serveur.
- **Front Desk / Administrateur — création de client par le Front Desk (nouveau) :** `POST
  /api/accounts` acceptait déjà ce rôle côté serveur ; seul le formulaire de création (déjà construit
  pour le Directeur) n'était pas affiché pour Front Desk — corrigé, `GET /team/members` ouvert à ce
  rôle pour le choix du représentant propriétaire.
- **Administrateur — désignation de la photo principale (gap comblé) :** l'endpoint de
  réordonnancement (`PATCH /products/:id/photos/reorder`) existait déjà côté serveur sans aucun
  contrôle côté client ; bouton "Définir comme couverture" ajouté à la galerie photo.
- **Administrateur — carrousel photo dans la grille catalogue (nouveau) :** `components/
  ProductPhotoCarousel.jsx`, utilisé dans `Catalogue.jsx` et `NewOrder.jsx` — swipe tactile/trackpad,
  flèches desktop, indicateur de position, jamais de déclenchement de la sélection produit
  (stopPropagation systématique).
- **Administrateur — "Visualisation du catalogue" (déjà construite) :** l'écran demandé par la fiche
  V3 existait déjà (`CatalogueConsult.jsx`, route `/catalogue-produits`) avec son propre carrousel ;
  seul le lien "Modifier la référence" manquait pour boucler vers Admin produits — ajouté (`?editId=`).
- **Représentant — création de client/prospect (2026-09-16, gap comblé suite à test bêta) :** `POST
  /api/accounts` acceptait déjà ce rôle côté serveur (propriétaire auto-affecté, Master Rep dérivé
  automatiquement — cf. `routes/accounts.js`), et le scénario était même documenté comme attendu dans
  `docs/recap-acces-test-beta.md` ("Se connecter en Représentant, créer un client..."). Seule l'UI ne
  l'exposait pas (`canCreateAccount` dans `ClientsList.jsx` limité à Directeur/Front Desk). Le
  formulaire "Nouveau compte" est désormais aussi affiché pour ce rôle, sans les champs
  représentant/Master Rep propriétaire (non pertinents ici, déterminés par le serveur) — vérifié de
  bout en bout : création du prospect → fiche compte → "Nouvelle commande" → commande envoyée au
  front desk. *(Voir l'entrée suivante — ce premier correctif, volontairement minimal à 4 champs, a
  ensuite été remplacé par le formulaire complet ci-dessous suite au retour client.)*
- **Représentant — parcours de commande complet, formulaire de création intégral et création de
  client sans rupture de workflow (2026-09-16, fiche corrective "CORRECTIONS PRIORITAIRES CRM — PROFIL
  REPRÉSENTANT") :** suite au retour explicite du client — *"Ne pas simplifier le workflow. La
  maquette fournie précédemment reste la référence fonctionnelle et UX"* — le formulaire de création
  minimal ci-dessus a été remplacé par un composant partagé, `components/AccountFormFields.jsx`,
  reprenant l'intégralité des champs prévus par la maquette de référence
  (`docs/prototype-crm-commercial.jsx`) : identité (raison sociale, nom du magasin), type
  Client/Prospect, pays/typologie, adresse de facturation complète, adresse de livraison complète,
  contact complet (nom, indicatifs + téléphone + mobile, email), informations légales (identifiant
  fiscal dynamique selon le pays via `GET /countries`, n° TVA) et coordonnées bancaires (IBAN, BIC,
  statut du mandat SEPA) — tous ces champs étaient déjà acceptés tels quels par `POST /api/accounts`
  côté serveur (`createSchema`, `routes/accounts.js`), aucune modification backend n'a été nécessaire.
  Ce composant est désormais utilisé par la page "Clients & prospects" (`ClientsList.jsx`, remplace
  l'ancien formulaire à 4 champs) ET par le raccourci "+ Nouvelle commande" du dashboard
  (`components/NewOrderQuickAccess.jsx`), qui n'offrait auparavant que la sélection d'un client
  existant. Ce raccourci propose maintenant un bouton "+ Nouveau prospect / client" ouvrant ce même
  formulaire complet directement dans la modale de sélection ; à la création, le représentant est
  envoyé **directement** sur le catalogue de commande du client fraîchement créé — jamais de retour à
  "Clients & prospects", de nouvelle recherche ou de réouverture de fiche, conformément à l'exigence
  explicite de la fiche corrective (règle CLIENT → COMMANDE → CATALOGUE → PANIER → FRONT DESK sans
  rupture). Un helper partagé, `accountPayloadFromForm()`, normalise les champs texte optionnels
  laissés vides en `null` avant l'envoi (évite un piège zod : un champ `email` vide en chaîne "" est
  rejeté par `.email()` alors qu'il serait accepté par `.optional()` seul). Vérifié de bout en bout
  par script Playwright (21/21 assertions) : dashboard → "+Nouvelle commande" → "+ Nouveau prospect /
  client" → remplissage intégral du formulaire → création → atterrissage direct sur le catalogue →
  ajout au panier → panier/récapitulatif → note pour le Front Desk → "Envoyer au Front Desk" →
  commande retrouvée côté API avec tous les champs (adresses, contact, IBAN...) correctement
  persistés ; et séparément pour le parcours "Clients & prospects" classique (Représentant sans
  sélecteur représentant/Master Rep, Directeur avec ce sélecteur obligatoire et blocage si absent).
- **Import catalogue produits — ID Dolibarr, fichiers "1 onglet par catalogue" et modèles
  téléchargeables (2026-09-16, sur exemple réel fourni par le client) :** trois évolutions liées, à
  la demande explicite du client : (1) la colonne "ID Dolibarr" est désormais reconnue à l'import
  (`lib/importMapping.js`) et déclenche une nouvelle règle de cohérence — une référence ne peut avoir
  qu'un seul ID Dolibarr et réciproquement, tous catalogues confondus, MAIS une référence peut
  parfaitement exister dans plusieurs catalogues tant que son ID ne change pas (`lib/catalogImport.js`,
  `validateDolibarrIds` — cf. `docs/cahier-des-charges-import-catalogue.md` section 7 bis pour le
  détail) ; (2) support des fichiers Excel à plusieurs onglets ("1 onglet par catalogue", ex. SUN 26 /
  SUN 27 / OPTICS 26 du fichier fourni) avec sélecteur d'onglet dans l'assistant d'import
  (`lib/fileParsing.js`, `ImportWizard.jsx`) — la détection de la ligne d'en-têtes a aussi été rendue
  tolérante à une ou plusieurs lignes vides au-dessus (motif réel du fichier fourni, qui aurait sinon
  fait échouer silencieusement la reconnaissance des colonnes) ; (3) un bouton "Télécharger un modèle"
  (Excel vierge, colonnes attendues, un onglet par catalogue existant) a été ajouté à l'import
  catalogue **et**, sur demande explicite complémentaire du client en cours de conversation, à l'import
  fiches client (`routes/catalogs.js` et `routes/accounts-import.js`, `GET .../template`), ce dernier
  renversant une décision antérieure qui l'excluait faute d'utilité perçue (cf. `docs/cahier-des-
  charges-import-fiches-client.md` section 11). Au passage, corrigé un bug latent de l'import
  catalogue exposé par les vraies données du fichier fourni : une référence apparaissant plusieurs
  fois dans un même onglet provoquait une violation de contrainte `UNIQUE(ref)` à l'application
  (`applyImport` ne mettait pas à jour son suivi des références déjà vues pendant la boucle). Aucun
  changement de schéma de base de données. Vérifié de bout en bout avec le fichier réel fourni par le
  client (script API : 20/20 assertions — import des 3 onglets dans des catalogues séparés, détection
  effective d'un vrai conflit d'ID Dolibarr présent dans ce fichier entre deux variantes de casse
  d'une même référence, rejet correct de conflits construits délibérément dans les deux sens ; script
  Playwright : sélecteur d'onglet, bouton modèle sur les deux écrans, déclenchement réel du
  téléchargement).
- **Correctifs Administrateur (2026-09-16, fiche corrective "CORRECTIFS CRM — PROFIL
  ADMINISTRATEUR")** : lot de corrections/évolutions demandées après relecture de la bêta.
  - **Bug réel corrigé — erreur serveur en modifiant le statut de stock :** confirmée reproductible
    (500 systématique), root-caused à `routes/products.js` (`PATCH /products/:id`) : la conversion
    générique camelCase -> snake_case des noms de colonnes (`f.replace(/[A-Z]/g, ...)`) transformait
    `priceFR` en `price_f_r` et `priceCH` en `price_c_h` au lieu de `price_fr`/`price_ch` — colonnes
    inexistantes, `UPDATE` en échec. Le formulaire complet de la fiche produit envoyant toujours ces
    deux champs, l'erreur touchait en réalité **toute** modification via ce formulaire, pas seulement
    Rupture/Réassort prévu (les deux statuts que le client avait testés). Remplacé par une
    correspondance champ -> colonne explicite (`COLUMN_FOR_FIELD`), qui ne peut plus se tromper de
    façon similaire. Vérifié par appel direct reproduisant exactement le payload du formulaire.
  - **Rattachement multi-catalogue (nouveau, changement de modèle de données) :** un produit peut
    désormais appartenir à plusieurs catalogues simultanément ("les catalogues ne doivent pas être
    mutuellement exclusifs"), alors que `products.catalog_id` ne portait qu'un seul catalogue à la
    fois. Nouvelle table de jointure `product_catalogs` (migration `020_product_catalogs.sql`,
    backfillée depuis les données existantes, non destructive), qui remplace `catalog_id` comme
    source de vérité dans tout le backend (`routes/products.js` : `catalogIds`/`catalogNames` sur
    chaque référence + filtre `?catalogId=` en "appartient à au moins un des catalogues demandés" ;
    `lib/catalogImport.js` : importer une référence dans un catalogue l'y **ajoute** désormais, ne la
    lui réattribue plus exclusivement — cf. `docs/cahier-des-charges-import-catalogue.md` section 11
    bis ; `routes/catalogs.js` : comptage et suppression via la table de jointure). Côté écrans :
    sélection multi-catalogue en bulles cochables sur la fiche produit (`CatalogueAdmin.jsx`), colonne
    "Catalogue(s)" ajoutée à la liste, et parité confirmée avec le catalogue de prise de commande côté
    Représentant (même `GET /catalogs`, même `GET /products?catalogId=`).
  - **Sélecteur de catalogue en bulles (point 7) :** le menu déroulant de catalogue de l'écran
    "Catalogue produits" (`CatalogueConsult.jsx`) — le seul `<select>` de catalogue effectivement
    présent dans l'appli — remplacé par des boutons/bulles (`cat-tab`, même style que le filtre
    catégorie juste en dessous et que la sélection de catalogue côté prise de commande, `catalog-bubble`
    dans `NewOrder.jsx`), pour rester cohérent "comme dans le reste de l'interface CRM".
  - **ID Dolibarr éditable manuellement :** ajouté au formulaire de création/modification de fiche
    produit (`CatalogueAdmin.jsx`) — jusqu'ici uniquement modifiable via l'import en masse, alors que
    la fiche corrective liste "ID Dolibarr" parmi les champs minimum attendus sur chaque fiche produit.
  - **Détail des erreurs d'import (points 13/14) :** le résumé d'import (catalogue et fiches client)
    n'affichait jusqu'ici qu'un **compte** d'erreurs, jamais le détail. `summarizeImport`/`applyImport`
    (`lib/catalogImport.js` et `lib/accountsImport.js`) renvoient désormais aussi `errorDetails`
    (numéro de ligne, référence si connue, motif exact — plafonné à 50 lignes) et `errorDetailsTruncated`
    ; affiché par `ImportWizard.jsx` à l'étape résumé ET à l'étape "import terminé", sur les deux écrans
    d'import (catalogue et fiches client) puisque partagés par ce même composant.
  - **Boutons "Choisir un fichier" et import ID Dolibarr (points 1/2/3) :** déjà présents et
    fonctionnels dans le code livré la veille (session précédente) — confirmés à nouveau par capture
    d'écran et test Playwright, aucun changement nécessaire.
  - **Éléments explicitement non touchés (points 5/6/10/17)** : statuts produit (Nouveau/Actif/
    Discontinué — la fiche mentionne aussi "Inactif", absent du code et de la base ; non ajouté pour ne
    pas modifier une logique que le client demande explicitement de ne pas refaire, à confirmer avec
    lui si un vrai besoin), galerie photo multi-image + swipe, filtre "Toute disponibilité".
  - Vérifié de bout en bout : script API (multi-catalogue : ajout sans perte d'affiliation existante,
    visibilité identique Admin/Représentant, suppression de catalogue ne retirant qu'une affiliation) et
    Playwright (bulles multi-catalogue sur la fiche produit, bulles de catalogue sur "Catalogue produits",
    détail des erreurs d'import affiché, absence d'erreur serveur en enregistrant Rupture/Réassort prévu
    avec le formulaire complet).

- **Correctifs P0 — Profil Représentant (2026-09-16, fiche corrective "CORRECTIFS P0 — PROFIL
  REPRÉSENTANT")** : quatre sujets strictement cadrés par la fiche ("Ne pas refondre les modules qui
  fonctionnent déjà" — Dashboard, Agenda, Rendez-vous, Tâches, Fiche client, Panier, Récapitulatif de
  commande et Front Desk non touchés, sauf minimum nécessaire ci-dessous).
  - **Filtre Catalogue de "Nouvelle commande" — repositionné et passé en sélection multiple :**
    l'étape intermédiaire "choisir un catalogue" (bulles pleine page avant d'arriver aux produits) est
    supprimée ; le filtre Catalogue apparaît désormais directement sur l'écran "Nouvelle commande",
    au-dessus de la recherche et de la grille produits, sous forme de bulles (`cat-tab`, jamais de
    `<select>`) permettant une sélection simple OU multiple simultanée (`NewOrder.jsx` :
    `selectedCatalogIds` remplace l'ancien `catalogId` unique + `subview: "catalog"`). La grille se
    met à jour immédiatement à chaque changement de sélection (réutilise le filtre OR déjà existant
    côté serveur, `GET /products?catalogId=A,B`, construit pour le Catalogue Admin lors du lot
    précédent — aucun changement backend nécessaire ici) **sans jamais vider le panier** : un article
    ajouté sous un catalogue reste au panier après ajout d'un second catalogue à la sélection (vérifié
    explicitement, cf. tests ci-dessous). Aucun catalogue sélectionné = grille vide + message explicite
    "Veuillez sélectionner au moins un catalogue." (jamais un état vide silencieux), et les fonctions
    d'ajout au panier sont gardées côté client en backstop défensif dans ce cas. Panier et
    Récapitulatif (sous-vue `"cart"`) strictement inchangés. Vérifié par script Playwright dédié,
    13/13 assertions (pas de page intermédiaire, bulles visibles directement, sélection simple et
    multiple, mise à jour immédiate de la grille, panier préservé à travers les changements de
    catalogue, blocage + message à zéro sélection).
  - **Bug réel corrigé — Data > Bestsellers, fragmentation par un `GROUP BY` trop large
    (`routes/dashboard.js`) :** la requête groupait par référence produit **mais aussi** par
    représentant et par typologie de compte. Un même produit vendu à des comptes de typologies
    différentes (cas très courant) remontait donc en plusieurs lignes distinctes au lieu d'une seule
    ligne consolidée — confirmé en base : une référence vendue à 17 unités au total apparaissait
    fragmentée en trois lignes (3 + 13 + 1), ce qui fausse à la fois les quantités affichées et le
    classement (`ORDER BY total_qty DESC` ne peut alors plus refléter le vrai total). Corrigé :
    agrégation stricte par produit pour `total_qty`/`total_amount` (les vrais totaux, réconciliables
    avec l'historique de commandes réel) ; typologie et représentant restent affichés côté écran
    Directeur (`Data.jsx`) mais comme **listes** agrégées (`array_agg(DISTINCT ...)`) plutôt que comme
    clés de regroupement, pour ne plus jamais fragmenter les totaux.
  - **Bug réel corrigé — Data > Bestsellers, erreur serveur systématique dès qu'une période est
    précisée (`routes/dashboard.js`) :** la sous-requête de comparaison N-1 réutilisait les paramètres
    positionnels ($n) de la requête principale en filtrant certaines clauses de date par correspondance
    de texte, tout en laissant les anciennes valeurs de paramètres en place et en ajoutant de nouvelles
    bornes à la fin du tableau — créant un "trou" dans la numérotation des paramètres. PostgreSQL
    refusait alors la requête ("could not determine data type of parameter $3"), et l'écran Bestsellers
    échouait en erreur serveur **dès que `dateFrom` et `dateTo` étaient tous les deux fournis** —
    c'est-à-dire à chaque clic normal sur "Générer" depuis l'écran (Représentant comme Directeur),
    expliquant vraisemblablement le ressenti "Bestsellers ne retrouve pas toutes les ventes" au moins
    autant que le bug de `GROUP BY` ci-dessus. Corrigé en factorisant la construction des clauses/
    paramètres (`buildBestsellersFilters`), appelée séparément pour chaque période et systématiquement
    renumérotée à partir de `$1` — élimine la classe de bug, pas seulement l'occurrence observée.
    Jointures `INNER JOIN` vers `accounts`/`users`/`products` vérifiées non problématiques :
    `orders.account_id`/`orders.rep_id`/`order_lines.product_id` sont `NOT NULL` avec contrainte de
    clé étrangère en base, aucune ligne orpheline possible. Vérifié par appel direct (comparaison avec
    un calcul SQL manuel, quantités et montants identiques au centime près) et script Playwright sur
    les deux écrans consommateurs (`RepData.jsx` Représentant, `Data.jsx` Directeur).
  - **Data > Customer Performance — période par défaut passée à l'année commerciale (1er novembre →
    31 octobre) :** seul point non conforme identifié sur ce module après audit complet (jointures
    `LEFT JOIN accounts → orders → order_lines`, gestion des comptes sans commande, `COALESCE` à 0€,
    tri décroissant — tous déjà corrects et vérifiés avant ce lot, voir détail ci-dessous). La période
    par défaut de `GET /api/dashboard/customer-performance` était l'année **civile**
    (`${year}-01-01` → `${year+1}-01-01}`), contredisant la règle métier déjà en vigueur ailleurs dans
    l'app (`frontend/src/lib/fiscalYear.js`, Corrections V2) et la demande explicite de cette fiche.
    Corrigé : nouveau module miroir `backend/src/lib/fiscalYear.js` (même calcul de bornes
    01/11-31/10), utilisé par défaut par l'endpoint ; `?year=` désigne maintenant l'année de **début**
    de la période commerciale (ex. `year=2025` → 01/11/2025-31/10/2026, cohérent avec l'étiquette
    "2025–2026" déjà affichée sur les tableaux de bord) au lieu d'une année civile. Le sélecteur d'année
    de l'onglet "Customer Performance" (`RepData.jsx`) affiche désormais ces libellés d'année
    commerciale ; l'onglet Bestsellers du même écran, non concerné par cette règle selon la fiche
    corrective, reste volontairement en année civile.
  - **Data > Customer Performance — audit du reste du module (aucun autre bug trouvé, documenté par
    exhaustivité).** La fiche demandait de vérifier explicitement l'absence d'un `INNER JOIN` qui
    exclurait silencieusement les clients sans commande, et de ne jamais masquer un vrai bug derrière
    un affichage à 0€ par défaut. Vérifié ligne à ligne : la requête utilisait déjà un `LEFT JOIN`
    (jamais un `INNER JOIN`) entre comptes et commandes, avec `COALESCE(SUM(...), 0)` — un client sans
    commande valide sur la période apparaît donc bien dans la liste avec 0€, jamais absent. Confirmé
    par comparaison systématique entre un calcul manuel en base (somme directe sur `order_lines`) et la
    réponse de l'API pour l'intégralité du portefeuille de test (12 comptes, dont plusieurs à 0
    commande) : montants identiques au centime près, tri décroissant par CA correct. Aucun compte-test
    "ALOA" (cas nommé par la fiche) n'existe dans les données de développement disponibles ; la
    vérification a donc porté sur l'ensemble du portefeuille disponible plutôt que sur ce nom précis —
    à rejouer sur les données réelles si un écart devait malgré tout apparaître sur ce client en
    particulier.
  - **Fiabilisation / centralisation des calculs commerciaux :** la liste des statuts de commande
    "valides" pour le calcul de CA (`VALIDEE`, `EXPORTEE_DOLIBARR` — une commande ne compte qu'une fois
    contrôlée par le front desk) était déjà centralisée dans `lib/objectiveProgress.js`
    (`COUNTED_STATUSES`) et déjà réutilisée telle quelle par Bestsellers et Customer Performance avant
    ce lot — vérifié, aucune divergence trouvée entre les trois modules. En revanche, la **formule de
    calcul du montant d'une ligne de commande**
    (`qty * unit_price_ht * (1 - discount_pct/100)`) était copiée-collée telle quelle dans quatre
    requêtes SQL distinctes (calcul d'objectif, Bestsellers x2, Customer Performance, Analytics
    Directeur) — identique partout au moment de l'audit, mais sans source unique, donc à risque de
    divergence silencieuse lors d'une prochaine évolution (nouvelle taxe, arrondi différent...).
    Extraite dans une constante partagée unique, `LINE_AMOUNT_SQL`
    (`lib/objectiveProgress.js`), réutilisée par les quatre requêtes. Le périmètre de rattachement
    représentant/client (qui voit quels comptes) était lui aussi déjà centralisé
    (`lib/dashboardScope.js#repScopeForDashboard`, partagé par Bestsellers et Customer Performance).
    Aucune valeur retournée par les endpoints n'a changé suite à cette factorisation — reconfirmé par
    re-test complet après coup (Bestsellers, Customer Performance, Analytics Directeur, calcul
    d'objectif : mêmes montants qu'avant, aux mêmes centimes).
  - Non-régression vérifiée sur les modules explicitement exclus par la fiche : Dashboard Représentant
    (dont l'étiquette "Année commerciale", inchangée), Agenda, et le sous-écran Panier/Récapitulatif de
    `NewOrder.jsx` (non modifié, seule la partie "choix des produits" en amont a changé) — script
    Playwright dédié, 5/5 assertions, en plus des 13+6+5 assertions propres à chacun des trois sujets
    ci-dessus (24 au total).

- **Correctifs prioritaires — Direction Commerciale + Représentant + Règles de remise (2026-09-16,
  fiche corrective "CORRECTIFS PRIORITAIRES — DIRECTION COMMERCIALE + REPRÉSENTANT + RÈGLES DE
  REMISE")** : cinq sujets, priorisés P0 par la fiche elle-même ; deux des cinq ("régressions" bouton
  commande / multi-catalogue) se sont révélées **déjà corrigées** par le lot précédent et non
  reproductibles dans le code actuel — voir le point dédié ci-dessous.
  - **Directeur — création d'utilisateurs Représentant/Master Rep/Front Desk/Administrateur depuis un
    seul écran (gap comblé) :** l'écran "Utilisateurs" (`UsersAdmin.jsx`, `/api/admin/users`) ne
    proposait jusqu'ici que Front Desk/Administrateur au moment de la création — exactement la
    limitation décrite par la fiche ("je peux principalement créer un utilisateur Front Desk /
    Administrateur"). Le formulaire de création propose désormais les 4 rôles minimum demandés
    (Représentant, Master Rep, Front Desk, Administrateur), et **le rôle choisi détermine réellement les
    droits accordés** (jamais de repli implicite sur Administrateur — exigence explicite de la fiche) :
    selon le rôle sélectionné, la création est routée vers la route backend appropriée, exactement comme
    si elle avait été faite depuis l'écran dédié — `POST /api/team/members` (mot de passe initial saisi
    par le directeur, rattachement à un Master Rep pour un représentant, Pays/Territoire obligatoire)
    pour Représentant/Master Rep, `POST /api/admin/users` (mot de passe temporaire auto-généré, comme
    avant) pour Front Desk/Administrateur. Les deux routes backend restent délibérément séparées (cf.
    commentaire d'origine dans `admin-users.js`) : cet écran appelle l'une ou l'autre selon le rôle, il
    ne les fusionne pas. L'écran "Équipe" (`TeamManagement.jsx`, `/equipe`) reste pleinement
    fonctionnel et inchangé — "Utilisateurs" est désormais un second point d'entrée vers la même
    création de représentant/Master Rep, pas un remplacement.
  - **Champ Pays/Territoire pour les profils commerciaux (gap comblé) :** obligatoire à la création d'un
    Représentant ou d'un Master Rep depuis "Utilisateurs" (comme depuis "Équipe"), sous forme de bulles
    multi-sélection alimentées par `GET /api/team/territories` — mécanisme déjà existant, réutilisé tel
    quel plutôt qu'un nouveau champ "pays" séparé, pour rester cohérent avec le seul modèle de données
    existant (`sales_reps.territory_ids`). Quatre territoires mono-pays ("France", "Espagne",
    "Allemagne", "Suisse") créés en données de démonstration pour correspondre directement aux exemples
    de la fiche ("Pays : France", "Pays : Espagne") ; le territoire préexistant "Sud-Ouest" (FR+ES
    combinés, seul territoire présent auparavant) reste disponible pour un usage multi-pays si besoin.
  - **Bug réel corrigé — la remise France ne s'appliquait pas dans l'aperçu panier (`NewOrder.jsx`) :**
    cas testé par la fiche reproduit puis corrigé. La fonction `parsePgArray(r.categories)`, utilisée
    par l'aperçu panier pour filtrer les règles de remise par catégorie produit, supposait à tort que
    `categories` était une chaîne brute façon PostgreSQL (`"{PREMIUM}"`) — alors que l'API renvoie déjà
    un tableau JS natif (`["PREMIUM"]"`, le driver `pg` parse les colonnes tableau automatiquement).
    `parsePgArray` retournait donc silencieusement `[]` pour **toutes** les règles, ce qui annulait de
    fait leur restriction de catégorie côté aperçu : une règle Représentant réservée à PREMIUM (25%)
    semblait s'appliquer à n'importe quelle catégorie, masquant la règle Pays/France réellement
    applicable (20% sur Classic). Le calcul **serveur** (`backend/src/lib/pricing.js#pickRule`, qui
    recalcule systématiquement et seul fait foi à l'enregistrement de la commande) n'a jamais été
    affecté — le montant réellement facturé était donc toujours correct, mais le représentant voyait un
    aperçu trompeur avant envoi. Corrigé en supprimant `parsePgArray` et en utilisant `r.categories`
    directement, comme le fait déjà le backend. Vérifié de bout en bout par script Playwright (remise
    France 20% désormais visible et correcte au panier pour une commande Classic) et par API (commande
    réelle envoyée au front desk : `discountPct: "20.00"` conservé jusqu'à la fiche front desk) ; non-
    régression confirmée sur le cas Premium/Représentant (25%, inchangé).
  - **Normalisation du rattachement pays — bug secondaire trouvé lors de l'audit (import CSV de
    comptes) :** la fiche demandait explicitement de vérifier que FR/France/fr/FRANCE résolvent au même
    pays partout dans le code. Audit complet des points de résolution pays (création manuelle de compte,
    création de règle commerciale, import CSV) : les deux premiers utilisent déjà des UUID stricts ou une
    correspondance par code normalisé, sans bug. Le troisième (`lib/accountsImport.js#loadCountriesByName`)
    n'indexait les pays que par **nom** normalisé ("france"), jamais par **code** ("fr") — un fichier
    d'import (Dolibarr ou autre) utilisant des codes pays plutôt que des noms complets voyait donc
    **chaque ligne concernée rejetée** à l'import ("Pays inconnu : FR"), au lieu d'être simplement mal
    classée. Corrigé : indexation par nom ET par code dans la même table de correspondance. N'affecte
    pas le moteur de remise lui-même (qui ne consulte jamais cette fonction), mais fait partie du même
    effort de fiabilisation demandé par la fiche.
  - **"Régressions" bouton "Nouvelle commande" et sélection multi-catalogue — non reproduites dans le
    code actuel :** la fiche décrit ces deux fonctionnalités comme ayant disparu après une reconnexion.
    Script Playwright dédié rejouant précisément le scénario décrit (premier chargement, après
    déconnexion/reconnexion, après rafraîchissement de la page, depuis le Dashboard ET depuis la fiche
    client) : 6/6 assertions passent, les deux fonctionnalités sont présentes et survivent à chaque
    scénario testé. Ces deux sujets avaient déjà été traités par le lot précédent ("Correctifs P0 —
    Profil Représentant", ci-dessus), livré le même jour sous forme d'archive à déployer manuellement sur
    Render (le déploiement de cette application se fait par import de fichiers sur render.com, jamais par
    déploiement automatique depuis Git) — l'hypothèse la plus probable est que le site bêta testé par
    l'utilisateur reflétait encore une version antérieure à cette livraison au moment du test. Aucun code
    modifié pour ces deux points ; à revérifier directement sur Render après mise à jour du déploiement.
  - Non-régression vérifiée sur les quatre tests explicitement demandés par la fiche (section "Test de
    non-régression obligatoire") : création d'utilisateurs avec rôle + pays (Représentant France, Master
    Rep France, Représentant Espagne — rôles et territoires confirmés par l'API après création), bouton
    "Nouvelle commande" (Dashboard + fiche client), catalogues Optics26/SUN26/SUN27 sélectionnables en
    multi-sélection, remise France de bout en bout (catalogue → panier → récapitulatif → commande envoyée
    au front desk). Ainsi que sur la création Front Desk/Administrateur depuis le même écran désormais
    unifié (mot de passe temporaire toujours auto-généré, aucune régression du comportement existant).

- **Correctifs prioritaires — Visualisation des commandes + Export Dolibarr (2026-09-16, fiche corrective
  "CORRECTIFS PRIORITAIRES — VISUALISATION DES COMMANDES + EXPORT DOLIBARR", fichier de référence joint
  `exemple_export_pour_Doli.xlsx`)** : deux sujets, tous deux P0 selon la fiche — unifier l'affichage
  d'une commande dans tout le CRM, et corriger le format du fichier d'export Dolibarr pour qu'il colle
  strictement au fichier exemple fourni.
  - **Un seul composant de visualisation de commande, réutilisé partout (gap comblé) :** jusqu'ici,
    "Visualiser la commande" pouvait afficher un contenu différent du récapitulatif présenté au moment de
    la validation du panier, et chaque écran de consultation (liste des commandes, Front Desk, fiche
    client) avait sa propre présentation. Créé un composant de présentation unique en lecture seule,
    `frontend/src/components/OrderSummary.jsx`, réutilisé à l'identique par `OrdersList.jsx` (vue
    Représentant/Master Rep/Directeur), `FrontDesk.jsx` et `AccountDetail.jsx` (fiche client) — mêmes
    classes CSS et mêmes clés de traduction que le récapitulatif du panier (`NewOrder.jsx`), pour un rendu
    visuellement indiscernable. Choix d'ingénierie assumé et documenté dans le code : plutôt que de
    fusionner ce composant avec le panier interactif de `NewOrder.jsx` (récemment corrigé et testé en
    profondeur), la fiche panier reste un composant séparé, non modifié — seul l'affichage en lecture
    seule des commandes déjà enregistrées a été unifié, ce qui couvre l'objectif fonctionnel réel de la
    fiche (section 19 : comparer la vue Représentant/Master Rep/Directeur/Front Desk/Admin avec le
    récapitulatif initial) sans reprendre le risque de régression sur la création de commande. Vérifié par
    scripts Playwright dédiés pour chacun des trois écrans (Représentant/Master Rep/Directeur via
    `OrdersList.jsx`, Front Desk via `FrontDesk.jsx`, fiche client via `AccountDetail.jsx`) sur une même
    commande réelle multi-produits avec remise : 12/12 assertions, contenu identique dans les trois vues
    (produit, remise 20 %, total commande, statut Exportée).
  - **Une commande historique reflète l'état à la validation, jamais le catalogue actuel (gap comblé) :**
    `GET /api/orders/:id` réécrit pour renvoyer, en plus des lignes, un bloc `totals` recalculé
    uniquement à partir des valeurs déjà enregistrées sur la commande (`backend/src/routes/orders.js`,
    nouvelle fonction `computeSavedOrderTotals`) — jamais depuis les règles de remise ou les prix catalogue
    en vigueur au moment de la consultation. La réponse inclut aussi désormais le nom du compte, le nom du
    représentant et les catalogues de chaque ligne, nécessaires à l'affichage unifié.
  - **Commande exportée : conservée et re-téléchargeable (gap comblé) :** une commande passée au statut
    "Exportée" restait déjà en base (aucune suppression), mais le bouton d'export devenait définitivement
    désactivé ("Déjà exportée"), sans aucun moyen de récupérer à nouveau le fichier. Ajout d'une route
    dédiée `GET /api/dolibarr/orders/:id/export-file` qui régénère à l'identique le fichier Dolibarr à
    partir des données historiques de la commande (mêmes lignes, mêmes prix, mêmes remises — sans jamais
    retoucher le statut, la date ou l'auteur de l'export d'origine), et un bouton "Retélécharger l'export
    Dolibarr" dans Front Desk pour toute commande déjà exportée. Nouvelle colonne `orders.exported_by`
    (migration `021_orders_exported_by.sql`) pour tracer qui a déclenché l'export, en plus de la date déjà
    enregistrée.
  - **Format du fichier d'export Dolibarr entièrement réécrit pour coller au fichier de référence (bug
    fonctionnel majeur corrigé) :** le format précédent ne correspondait pas à celui attendu par l'import
    Dolibarr. Le fichier exemple joint à la fiche (`exemple_export_pour_Doli.xlsx`) a été ouvert et ses
    en-têtes copiés à l'identique, comme exigé par la fiche ("le fichier joint prime sur toute
    interprétation") : colonnes `fk_product, qty, label, remise_percent, tva_tx, subprice`, dans cet ordre
    exact, une ligne par ligne de commande. `fk_product` provient désormais strictement de l'identifiant
    Dolibarr enregistré sur la fiche produit CRM (champ `products.dolibarr_ref`, préexistant), jamais de
    l'identifiant interne CRM ni de la référence/SKU utilisée comme repli. `label` reprend la référence
    produit telle qu'enregistrée sur la commande (pas le nom marketing, conformément au fichier exemple).
    `remise_percent`, `tva_tx` et `subprice` proviennent tous des valeurs historiques réellement appliquées
    à la ligne de commande au moment de la validation, jamais recalculées avec les règles ou prix en
    vigueur au moment de l'export (`backend/src/lib/dolibarrExport.js`).
  - **Blocage strict si l'identifiant Dolibarr manque sur une référence (gap comblé) :** le contrôle
    pré-export exigeait auparavant un identifiant Dolibarr *ou à défaut* la référence CRM — ce repli a été
    supprimé, conformément à la fiche ("ne pas utiliser le SKU à la place de l'ID Dolibarr"). L'export est
    désormais bloqué avec un message explicite et exact
    (`"Impossible d'exporter la commande : identifiant produit Dolibarr manquant pour la référence
    XXXXX."`) si une seule ligne de la commande porte sur un produit sans identifiant Dolibarr enregistré ;
    le taux de TVA applicable est lui aussi désormais un contrôle bloquant (colonne obligatoire du nouveau
    format, plus de repli silencieux). Vérifié par script Playwright dédié (2/2) : le message exact
    apparaît bien dans l'interface Front Desk au clic sur "Exporter vers Dolibarr". À noter : 159 des 415
    références catalogue réelles n'ont pas encore d'identifiant Dolibarr renseigné — comportement attendu,
    ces commandes seront bloquées à l'export tant qu'un administrateur n'aura pas complété l'identifiant
    Dolibarr de la référence concernée (fiche produit ou import catalogue).
  - **Aucune intégration API Dolibarr — confirmé conforme à la demande explicite de l'utilisateur en cours
    de fiche** ("pas d'API level export, on reste sur du FTP tradi avec un dépôt de fichier ; une fois
    l'export récupéré par le front desk il sera manuellement déposé dans la fiche client présente sur
    Dolibarr") : le fonctionnement était déjà, avant comme après ce correctif, une pure génération de
    fichier téléchargeable, sans aucun appel à une API Dolibarr — aucune modification de code nécessaire
    sur ce point, uniquement une vérification qu'aucun appel API n'a été introduit.
  - Non-régression vérifiée sur la suite de tests des lots précédents (création de commande, remise
    catalogue/Premium/France, gestion des utilisateurs Directeur/Front Desk) : tous les scripts
    précédemment écrits continuent de passer intégralement après ce correctif.

- **Correctif urgent — Profil Représentant : bouton "Nouvelle commande" manquant sur l'onglet Commandes
  (2026-09-16, fiche "CORRECTIF URGENT — PROFIL REPRÉSENTANT")** : la fiche signalait trois boutons
  disparus (Dashboard, Clients & prospects, Commandes). Vérification en conditions réelles (connexion
  Représentant, script Playwright) : les boutons du Dashboard ("Nouvelle commande") et de Clients &
  prospects ("Nouveau compte") sont bien présents et fonctionnels dans le code actuel — le même scénario
  que pour les "régressions" déjà rapportées dans le lot précédent, très probablement un écart entre le
  code livré ici et la version encore déployée sur le site bêta Render au moment du test (déploiement
  manuel, jamais automatique — voir plus haut). Le troisième, en revanche, était un **vrai gap** :
  l'onglet Commandes (`OrdersList.jsx`) n'a, à aucun moment dans l'historique de ce projet, comporté de
  bouton "Nouvelle commande" — corrigé en ajoutant le même composant partagé `NewOrderQuickAccess`
  (déjà utilisé par le Dashboard) en haut à droite de cet écran, réservé au rôle Représentant (l'écran
  Commandes est également utilisé en lecture seule par le Master Rep — cf. `App.jsx` — qui ne doit pas
  se voir accorder cette capacité, décision produit distincte non concernée par ce correctif). Les trois
  parcours d'entrée (Dashboard, fiche client "Nouvelle commande", Commandes) convergent bien vers le même
  moteur de création (`/clients/:id/commande`, `NewOrder.jsx`) — aucun second moteur créé, conformément à
  l'exigence explicite de la fiche. Vérifié par script Playwright dédié couvrant exactement le test
  obligatoire demandé (section 6) : présence des 3 boutons à la première connexion, après déconnexion/
  reconnexion, et après rafraîchissement navigateur sur chacun des trois écrans (9 assertions), plus la
  convergence des 3 parcours vers le même écran de commande (5 assertions) — 14/14 au total ; non-régression
  confirmée sur le Master Rep (toujours sans bouton de création, comme avant) et sur l'ensemble de la
  suite de tests des lots précédents (commande, remises, Front Desk, fiche client, export Dolibarr).
  Aucun autre élément du Dashboard, de Clients & prospects, des fiches client, du catalogue, du panier,
  des règles de remise, de la Data, de l'Agenda, des tâches, des rendez-vous, du Front Desk ou des droits
  déjà en place n'a été modifié.

- **Habillage visuel de l'écran de connexion (2026-09-16, demande directe : "rajoute sur l'intro de
  l'appli ce visuel en responsive. tout doit etre visible. log in au milieu")** : le visuel fourni
  (poster Moken "Now, Let's make millions. (So we can surf a million waves together.)", fond jaune pâle,
  accroche en grande empattée sombre, logo Moken en bas) habille désormais l'écran de connexion et les
  deux écrans qui en dépendent (mot de passe oublié, réinitialisation) — jamais affiché une fois connecté,
  le reste de l'application (AppShell, en-tête, navigation) reste inchangé.
  - **Reconstruit en HTML/CSS plutôt qu'inséré comme image figée :** couleurs échantillonnées directement
    sur le visuel fourni (fond `#FDEE93`, encre `#042D13`), police d'accroche/tagline "Fraunces" (Google
    Fonts, proche de l'empattée du visuel d'origine, ajoutée à `index.html`), logo Moken existant du
    projet (`assets/moken-logo.png`, doré à l'origine) recoloré en noir par filtre CSS pour rester lisible
    sur le fond jaune (l'encre du visuel d'origine, très sombre, en est visuellement indissociable à
    cette taille). Un texte plutôt qu'une image reste net à toute résolution et se redimensionne
    proprement (`clamp()` sur les polices et les espacements) — une image plein cadre se serait soit
    recadrée, soit aurait laissé des bandes vides selon le ratio d'écran, ce qui aurait contredit
    l'exigence explicite "tout doit être visible".
  - **Formulaire de connexion au milieu (exigence explicite) :** le formulaire (carte `.login-shell`,
    inchangée) est centré verticalement et horizontalement dans la zone naturellement vide du visuel
    d'origine, entre l'accroche en haut et le logo en bas — exactement la disposition du visuel fourni.
  - **Repli responsive si l'écran est vraiment trop court** (mobile en paysage, petite fenêtre desktop) :
    la page défile plutôt que de couper un élément — "tout doit être visible" prime sur "tout tient sans
    défiler". Vérifié par capture d'écran à plusieurs largeurs (mobile 375px, mobile paysage très bas,
    tablette 810px, desktop 1440px) et par script Playwright (accroche, tagline et formulaire tous
    présents et fonctionnels, connexion réelle toujours opérationnelle de bout en bout, poster absent une
    fois connecté) — 6/6 assertions.
  - **Non-régression :** la classe `.login-shell` réutilisée par `ChangePassword.jsx` (écran interne de
    changement de mot de passe forcé, hors intro) n'a reçu aucune modification de son style de base — le
    nouvel habillage n'agit que sur les instances imbriquées dans le nouveau conteneur du poster, jamais
    en dehors.
  - **Ajustement (2026-09-16, demande directe : "centre moi toutes les écriture du visuel au milieu de la
    page... ne change pas la typo et ne change pas la couleur") :** l'accroche et la tagline, jusqu'ici
    calées à gauche (fidèles à la mise en page du visuel fourni), sont désormais centrées horizontalement
    au-dessus et en dessous de la carte de connexion — seul l'alignement a changé, police (Fraunces),
    graisse et couleur (`#042D13`) strictement identiques. Vérifié visuellement (mobile et desktop).

- **Gros bug corrigé — prix Export ne s'appliquait pas hors de France (2026-09-16, remontée directe :
  "Quand un représentant est dans un pays autre que la France, (Autre Prix) le prix export ne s'applique
  pas")** : reproduit et corrigé. `resolveUnitPrice` (`backend/src/lib/pricing.js`, seule source de vérité
  du prix — jamais celui envoyé par le client) faisait bénéficier les comptes en Espagne du prix France
  (`price_fr`) au lieu du prix Export (`price_export`) — comportement qui remontait en fait du handoff
  d'origine lui-même ("France et Espagne partagent la même grille tarifaire", section 5), mais qui n'est
  pas la règle commerciale réelle. Règle confirmée par l'utilisateur et désormais appliquée strictement :
  en Europe et DOM-TOM, seule la France a le prix France ; tous les autres pays (Espagne comprise) ont le
  prix Export ; la Suisse garde son propre prix Suisse. Basée sur le pays du **compte client**
  (`account.country_code`, déjà présent sur la fiche client — champ pays déjà disponible, aucun ajout de
  schéma nécessaire), jamais celui du représentant, un représentant pouvant avoir des clients dans
  plusieurs pays. Même correction reportée dans l'aperçu panier côté représentant
  (`unitPriceFor`, `frontend/src/pages/NewOrder.jsx`) pour rester cohérente avec le calcul serveur —
  l'aperçu reste un aperçu, le serveur recalcule toujours le prix réel à l'enregistrement.
  - **Vérifié de bout en bout** sur les trois cas via l'API réelle (commande créée puis nettoyée) : compte
    espagnol (Tienda Madrid) → 40,00 € (prix Export, corrigé, était 30,00 € avant), compte suisse
    (Lunettes Geneve) → 45,00 € (prix Suisse, inchangé), compte français (4G Optique) → 30,00 € (prix
    France, inchangé — non-régression). Aperçu panier représentant également vérifié pour le compte
    espagnol (40,00 € affiché, plus jamais 30,00 €).
  - **Écrans de catalogue de référence non concernés, volontairement non touchés :** `Catalogue.jsx` et
    `CatalogueConsult.jsx` affichent le prix France comme prix de référence générique lors d'une simple
    consultation du catalogue (hors sélection de client, donc hors calcul par pays) — ce n'est pas le même
    calcul que la prise de commande et ça n'était pas concerné par le bug signalé ; conformément à la
    demande ("Pour le reste du dev tu ne touches à rien"), rien n'y a été modifié.
  - Non-régression vérifiée sur la suite de tests des lots précédents (remise catalogue/Premium/France,
    parcours de création de commande, boutons du profil Représentant).

- **Ajustements visuel de connexion (2026-09-16, demande directe : "change la typo par Cooper BOLD et
  ecrit la phrase entre parenthese plus grosse et plus éloignée du logo Moken. Ca c'est pour la page
  d'entrée. Le reste tu ne touches pas")** : deux changements, strictement limités à l'écran de connexion
  (et aux deux écrans qui en dépendent, mot de passe oublié/réinitialisation) — rien d'autre modifié.
  - **Police remplacée par "Bevan" :** "Cooper Black"/"Cooper BT" est une police commerciale, non
    disponible sur Google Fonts (seul fournisseur de polices déjà utilisé par le projet, cf. Manrope) et
    donc non redistribuable ici sans achat de licence. Remplacée par **Bevan**, l'alternative gratuite la
    plus proche dans le même registre (empattée épaisse, formes arrondies, habituellement citée comme
    équivalent libre de Cooper Black) — appliquée à l'accroche et à la tagline (`index.html`,
    `styles.css`). Si une vraie police Cooper Black est disponible sous licence côté client, elle peut
    être déposée dans le projet et substituée en une ligne (`font-family` dans `.auth-poster-headline` /
    `.auth-poster-tagline`).
  - **Tagline agrandie et éloignée du logo :** taille de police doublée (`clamp(18px, 4.2vw, 30px)` contre
    `clamp(12.5px, 2.6vw, 17px)` avant) et écart avec le logo nettement augmenté (`clamp(28px, 7vh, 56px)`
    contre `clamp(10px, 2.5vh, 18px)` avant) — l'espacement au-dessus (entre la carte de connexion et la
    tagline) n'a pas bougé, seul l'écart tagline ↔ logo a changé.
  - **Limite de vérification à noter :** le bac à sable où tourne cet environnement de développement
    bloque les requêtes sortantes vers Google Fonts (comme vers la plupart des domaines externes non
    listés) — impossible d'y capturer un aperçu avec la vraie police Bevan chargée (le rendu y retombe
    silencieusement sur la police de repli, Georgia). Le code est correctement configuré (balise
    `<link>` + `font-family` vérifiés) et se comportera normalement dans un navigateur réel avec accès
    Internet, exactement comme Manrope déjà utilisée partout ailleurs dans l'application — à confirmer
    visuellement une fois ce zip déployé sur Render. Le changement de taille/espacement de la tagline,
    lui, ne dépend pas de la police et a été vérifié visuellement (captures mobile/tablette/desktop).

- **Écran de connexion — mise en conformité stricte avec le visuel de référence fourni (2026-09-16,
  demande directe : "juste pour la partie Login Tablet, sur la premiere page de Login. reprend
  exactement le modele de reference, ne fait pas d'interprétation. place le carré de login au
  mileu")** : cette fois une image de référence précise a été fournie (et non plus une description
  verbale) — elle prime, conformément à la demande explicite de ne "pas faire d'interprétation", sur
  les ajustements faits juste avant sur la seule foi du texte ("Cooper BOLD", "plus grosse et plus
  éloignée du logo"), qui se sont révélés contredits une fois l'image réelle en main. Analyse pixel du
  visuel de référence (bandes de luminance, centrage, proportions) plutôt qu'une appréciation visuelle
  approximative, pour ne prendre aucune liberté :
  - **Accroche ramenée à "Let's make millions." seule** — la ligne "Now," du premier jet (habillage
    initial de l'écran de connexion, avant qu'une référence précise n'existe) n'apparaît pas dans le
    visuel de référence et a été retirée.
  - **Tagline sans parenthèses ni italique** ("So we can surf a million waves together.", texte brut) —
    les parenthèses et l'italique du premier jet, absentes du visuel de référence, ont été retirées.
  - **Police ramenée à Fraunces** (empattée à fort contraste, fidèle au visuel de référence) — le
    remplacement par Bevan fait sur la seule foi du mot "Cooper BOLD" au tour précédent est annulé
    puisque le visuel réel ne correspond pas à cette police.
  - **Taille et écart de la tagline ramenés à leurs valeurs d'origine** (`clamp(12.5px, 2.6vw, 17px)`,
    écart tagline↔logo `clamp(8px, 2vh, 16px)` dans `.auth-poster-bottom`) — l'agrandissement +
    éloignement fait au tour précédent sur la seule foi du mot "éloignée" est annulé : la mesure des
    proportions du visuel de référence montre une tagline petite et proche du logo (hauteur ≈2,2 % de
    l'image, à peine 2,4–3,6 % au-dessus du logo), donc l'exact inverse de l'interprétation verbale
    précédente.
  - **Centrage du carré de connexion** ("place le carré de login au milieu") : déjà en place depuis
    l'ajustement de centrage précédent — confirmé conforme, aucun changement nécessaire ici.
  - Vérifié par capture d'écran (mobile/tablette/desktop) comparée point par point au visuel de
    référence fourni ; non-régression sur la connexion réelle, le mot de passe oublié/réinitialisation
    et le reste de l'application (aucun autre écran touché).
  - **Même limite d'environnement déjà notée plus haut** : ce bac à sable de développement bloque les
    requêtes sortantes vers Google Fonts, donc impossible d'y capturer un aperçu avec la vraie police
    Fraunces chargée (repli silencieux sur Georgia) — configuration vérifiée dans le code, à confirmer
    visuellement une fois ce zip déployé sur Render.

- **Amendement Direction Commerciale — gestion des objectifs et des territoires depuis l'onglet Équipe
  (2026-09-16, demande directe : "Concernant la fiche Direction Commerciale, voici les ajustements à
  apporter")** : cinq ajustements, tous cantonnés à la fiche Direction Commerciale (Tableau de bord et
  Équipe du Directeur) — rien d'autre modifié, conformément à "Aucune autre modification n'est
  nécessaire. Tout le reste est validé en l'état."
  - **Bouton "Fixer un objectif" désormais accessible aussi depuis Équipe**, pas seulement depuis le
    Tableau de bord : le bouton et son formulaire ont été extraits dans un hook partagé
    (`hooks/useObjectiveForm.jsx`) afin que les deux écrans utilisent exactement le même moteur de
    création (même formulaire, même validation, même appel `POST /objectives`) — aucun second moteur
    dupliqué, même principe déjà appliqué au parcours "Nouvelle commande"
    (`NewOrderQuickAccess.jsx`).
  - **Récapitulatif des objectifs sous Territoires**, dans Équipe : nouvelle section listant TOUS les
    objectifs de l'entreprise — représentants et Master Reps confondus, actifs ou non (contrairement au
    bloc "Performance de l'équipe" juste au-dessus, qui ne garde que les objectifs de la période en
    cours) — avec titulaire, type, période et montant cible pour chacun.
  - **Icône poubelle sur chaque objectif du récapitulatif** ("afin de pouvoir revenir en arrière et
    modifier les éléments si nécessaire") : supprime l'objectif (nouvelle route
    `DELETE /api/objectives/:id`, réservée au Directeur comme la création) pour permettre de le refixer
    avec les bonnes valeurs — pas d'édition champ par champ, suppression puis recréation, plus simple et
    cohérent avec le reste de l'écran (aucune boîte de confirmation `window.confirm` nulle part ailleurs
    dans l'application : action directe suivie d'un message de confirmation, même principe ici).
  - **Icône poubelle sur chaque territoire**, dans le panneau Territoires ("il doit être possible de
    sélectionner un territoire et de le supprimer") : nouvelle route
    `DELETE /api/team/territories/:id`, transactionnelle — détache d'abord les références dépendantes
    (le pays qui pointait vers ce territoire, les représentants qui l'avaient coché) avant de supprimer
    le territoire lui-même, pour ne jamais laisser de référence orpheline ni faire échouer la suppression
    sur une contrainte de clé étrangère.
  - **Vérifié de bout en bout** (script Playwright + appels API directs) : bouton "Fixer un objectif"
    présent et fonctionnel à la fois sur le Tableau de bord et sur Équipe ; création d'un objectif depuis
    Équipe bien reflétée dans le récapitulatif ; suppression d'un objectif retire bien la ligne et
    affiche la confirmation ; suppression d'un territoire testé avec un pays et un représentant qui lui
    étaient rattachés — le pays et le représentant sont bien nettoyés en base sans erreur, et le
    territoire disparaît du panneau. Non-régression confirmée sur le reste de l'écran Équipe
    (hiérarchie Master Reps/représentants, activation/désactivation, rattachement, territoires par
    membre) et sur le Tableau de bord Directeur (indicateurs, performance d'équipe, rendez-vous/tâches
    du jour, carte).

- **Ajustements sur les remises (2026-09-16, demande directe : "changement concernant les remises,
  dans la partie direction commerciale. Le niveau de remise peut avoir deux decimale et dans la
  partie representant, le niveau de remise (bouton) est par défaut non enclanché. Le représentant
  l'enclenchera lui meme manuellement si il veut l'enclencher")** : deux changements distincts.
  - **Taux de remise catégorie saisi par le Directeur (Règles commerciales) : deux décimales
    désormais réellement utilisables.** La colonne base `business_rules.rate_pct` (`NUMERIC(5,2)`) et
    le schéma serveur (`ratePct: z.number().min(0).max(100)`, `backend/src/routes/business-rules.js`)
    acceptaient déjà les décimales — le vrai verrou était le champ de saisie côté écran
    (`frontend/src/pages/BusinessRules.jsx`), dont l'attribut `step="0.1"` faisait échouer
    silencieusement la validation native du navigateur dès qu'un deuxième chiffre après la virgule
    était saisi (ex. 12,34), bloquant l'envoi du formulaire avant même d'atteindre le serveur. Corrigé
    en passant ce `step` à `0.01`. Vérifié : la saisie "12.34" est désormais acceptée par la
    validation native du champ (`checkValidity()` renvoie vrai), alors qu'elle échouait avec
    l'ancien `step`.
  - **Bouton "Remise" du Représentant désormais désactivé par défaut sur une commande.** Jusqu'ici,
    dès qu'une règle de remise catégorie active existait pour le représentant/pays/catégorie
    concernés, la remise était appliquée automatiquement à l'ouverture du panier — le bouton n'avait
    qu'à être décoché pour la retirer. Inversé : le bouton part maintenant toujours décoché (aucune
    remise appliquée par défaut), et c'est au représentant de l'activer lui-même, catégorie par
    catégorie, s'il souhaite l'appliquer à cette commande (`frontend/src/pages/NewOrder.jsx` —
    logique de lecture de l'état du bouton inversée à trois endroits : calcul du total affiché dans le
    panier, construction des lignes envoyées au serveur, et rendu visuel du bouton lui-même ; le
    serveur, qui reste la seule source de vérité du taux réellement appliqué
    (`backend/src/lib/pricing.js`), n'a pas eu besoin d'être modifié — il continue de respecter
    fidèlement ce que le client lui envoie, qu'il s'agisse d'un 0 explicite ou d'un taux calculé).
    Vérifié de bout en bout, remise réelle activée pour ce représentant sur la catégorie Premium
    (25 %) : commande envoyée sans toucher au bouton → remise à 0 % appliquée sur la ligne ; même
    commande avec le bouton activé manuellement → remise à 25 % bien appliquée sur la ligne — les deux
    commandes de test ont été supprimées après vérification pour ne pas polluer la file du front desk.
  - Non-régression vérifiée sur le reste de l'écran de commande (ajout au panier, cadeaux, franco de
    port, reliquats) et sur l'ensemble des parcours Représentant/Master Rep/Directeur déjà testés.

- **Config (Directeur) — modification et suppression des règles commerciales (2026-09-16, demande
  directe : "pour établir des regle de remise chez le directeur, dans configurer - rajouter la
  possibilité de modifier la regle ou de la supprimer")** : jusqu'ici une règle (remise catégorie,
  frais de port...) ne pouvait qu'être activée/désactivée depuis cet écran — corrigé, sans toucher à
  ce bouton existant, conservé tel quel.
  - **Modifier** : chaque règle de la liste a désormais un bouton "Edit" qui rouvre le même formulaire
    que "Nouvelle règle", pré-rempli avec ses valeurs actuelles (type, portée, pays/représentants,
    catégories, taux/montant/seuil) ; la validation et l'enregistrement (`PATCH /business-rules/:id`)
    existaient déjà côté serveur (chantier remise catégorie multi-représentants, migration 013) — seul
    l'écran ne les exposait pas encore. Le statut actif/inactif n'est volontairement jamais touché par
    cette édition, pour ne jamais réactiver une règle désactivée simplement en la modifiant.
  - **Supprimer** : icône poubelle sur chaque règle, nouvelle route `DELETE /api/business-rules/:id`
    (réservée au directeur, comme la création) — `business_rule_reps` (ciblage représentant) a une
    contrainte `ON DELETE CASCADE` vers cette table, donc aucun nettoyage manuel n'est nécessaire ; les
    commandes déjà passées ne référencent jamais l'id d'une règle (seul le taux calculé au moment de la
    commande est recopié sur la ligne), donc supprimer une règle n'affecte jamais l'historique déjà
    enregistré.
  - Vérifié de bout en bout par script Playwright : création d'une règle de test, modification (valeur
    bien pré-remplie, mise à jour bien reflétée dans la liste), puis suppression (ligne bien retirée) —
    9/9 assertions ; non-régression confirmée sur le reste de l'écran Config (réglages Dolibarr,
    activation/désactivation existante) et sur l'ensemble des parcours déjà testés.

- **Rapprochement des photos mokenvision.com en production (2026-09-16, demande directe : "dans ce
  cas là note que aucune photo publiée en ligne www.mokenvision.com n'apparait dans le catalogue",
  puis confirmation "oui go,")** : opération de données uniquement, **aucun changement de code**.
  - **Constat** : le script `backend/scripts/mokenvision-photos/match-photos-to-catalog.mjs`
    (rapprochement fiche produit ↔ photo mokenvision.com par modèle/couleur, à partir du fichier
    `moken_photos_map.json`) n'avait jusqu'ici été exécuté que contre la base de développement locale
    de ce sandbox — jamais contre la base de production Render, qui est une base entièrement séparée
    (le déploiement se fait par upload manuel de fichiers sur GitHub, sans base partagée ni CI/CD).
    Résultat : 0 photo mokenvision.com n'était jamais apparue dans le catalogue en ligne, confirmé par
    absence totale de requête réseau vers mokenvision.com et par `photoUrl: null` sur les fiches
    interrogées directement en production.
  - **Action, après accord explicite** : la même logique de rapprochement (normalisation du nom de
    modèle, puis correspondance de couleur si possible, jamais de correspondance approximative/devinée)
    a été rejouée manuellement contre les 406 fiches produit de production sans photo, via l'API du CRM
    (`POST /api/products/:id/photos/url`, comme le fait le script lui-même) — exécutée depuis le
    navigateur du poste relié à la session (le sandbox n'a pas d'accès réseau direct au site de
    production), en session authentifiée Administrateur.
  - **Résultat** : **278 fiches rapprochées et mises à jour** (aucun échec sur les 278 appels), les
    **128 fiches restantes n'ont aucun modèle correspondant dans `moken_photos_map.json`** et n'ont
    donc jamais été touchées (toujours sans photo, à traiter manuellement si de nouvelles photos sont
    scrapées). Vérifié après coup : la fiche AARON 54-18-150 (citée en exemple) affiche désormais sa
    photo réelle, chargée avec succès (280×280) depuis mokenvision.com.
  - **Important à savoir** : les photos ne sont pas dupliquées/hébergées côté Moken — la fiche produit
    stocke l'URL mokenvision.com et l'image est chargée en direct depuis leur site à chaque affichage.
    Si mokenvision.com retire ou déplace une image plus tard, la photo casserait aussi côté CRM.
  - La fonctionnalité distincte d'**import de photos en masse par l'Administrateur** (upload de zip/
    fichiers multiples, stockage S3/R2 dédié) reste **volontairement non développée** : aucun espace de
    stockage fichiers n'est configuré dans le projet à ce jour, et conformément à la demande explicite
    ("dis-le-moi avant de commencer plutôt que d'improviser une solution temporaire... qui ne tiendrait
    pas en production"), rien n'a été improvisé. À reprendre si besoin, une fois un espace de stockage
    S3-compatible provisionné.

Ce qui reste, au global : l'application couvre désormais l'intégralité des rôles et fonctionnalités
métier décrits dans le handoff d'origine, plus les demandes formulées depuis. La suite serait un
passage d'hébergement en production (voir la note sur l'absence de Prisma plus haut, et la section
Environnement de développement vs production) — à engager quand vous le déciderez.
