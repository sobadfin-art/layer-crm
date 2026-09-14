# Plan de développement — CRM commercial Moken (via Claude Code)

Architecture confirmée : application web (PWA) installée localement sur le téléphone des représentants, données centralisées sur un serveur, accessible en simultané par représentants, front desk et direction commerciale.

---

## 1. Stack technique recommandée

Choisie pour être rapide à construire avec Claude Code, facile à héberger, et cohérente avec tout ce qui a été spécifié.

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | React + PWA (service worker) | Réutilise directement la logique/UX déjà validée dans le prototype |
| Backend | Node.js (Express ou Fastify) | Écosystème le plus rapide à faire avancer avec Claude Code, JS partagé avec le frontend |
| Base de données | PostgreSQL | Relationnel, robuste, gère bien le cloisonnement par rôle (RLS natif) |
| Authentification | JWT + bcrypt (mots de passe hashés) | Standard, simple à auditer |
| Hébergement | Railway, Render ou Fly.io pour démarrer | Déploiement en quelques clics, base Postgres incluse, migration facile vers un VPS/AWS plus tard si le volume grossit |
| Stockage fichiers (photos, pièces jointes) | Un bucket S3-compatible (Cloudflare R2, Scaleway Object Storage) | Moins cher que de stocker des fichiers en base, standard du marché |

---

## 2. Découpage en tickets — MVP d'abord

### Lot 1 — Fondations (rien ne fonctionne sans ça)
- [ ] Initialisation du repo (frontend + backend), configuration de base
- [ ] Base de données : schéma complet (users, roles, sales_reps, master_reps, countries, territories, customers, prospects, products, catalogs, orders, order_lines, objectives, business_rules)
- [ ] Authentification (login, hash des mots de passe, sessions JWT, déconnexion)
- [ ] Cloisonnement des données par rôle **appliqué côté serveur** (middleware de permission sur chaque route)

### Lot 2 — CRM de base
- [ ] CRUD fiches client/prospect (avec adresses structurées, typologie, secteur)
- [ ] Historique d'interactions
- [ ] Pipeline (changement de statut)
- [ ] Tâches et agenda (création, assignation, échéances)

### Lot 3 — Catalogue et commandes
- [ ] Import catalogue (mapping colonnes, création/mise à jour, gestion multi-catalogues)
- [ ] Écran catalogue de référence (lecture seule, stock, réassort)
- [ ] Écran prise de commande (panier, remises, offerts, précommande, reliquat)
- [ ] Envoi au front desk + notification

### Lot 4 — Front desk et export Dolibarr
- [ ] File de commandes, filtres, recherche
- [ ] Vérification avant export (check-list)
- [ ] Génération du fichier d'import Dolibarr (mapping configurable, cf. le cahier des charges déjà produit)
- [ ] Gestion SAV

### Lot 5 — Pilotage (directeur / Master Rep)
- [ ] Objectifs (assignation multi-secteur / multi-catégorie)
- [ ] Dashboard, Data (Bestsellers, Analytics, Extraction Excel)
- [ ] Gestion d'équipe (reps, Master Reps, territoires)

### Lot 6 — Finitions
- [ ] Multilingue (FR/EN/ES) complet
- [ ] PWA (installation, mode hors-ligne partiel)
- [ ] Notifications
- [ ] Audit / historique des modifications

---

## 3. Comment démarrer concrètement avec Claude Code

1. Installer Claude Code : `npm install -g @anthropic-ai/claude-code` (nécessite Node.js).
2. Créer un dossier de projet vide, lancer `claude` dedans.
3. Lui donner en premier message : la spec technique déjà produite + ce plan de tickets + le fichier du prototype (pour qu'il s'en inspire visuellement).
4. Avancer **lot par lot**, pas tout d'un coup : demander "Attaque le Lot 1" plutôt que "construis toute l'app" — Claude Code travaille mieux sur des tâches bornées, et toi tu peux vérifier à chaque étape.
5. Une fois le Lot 1 posé, tester en local avant de passer au suivant.

---

## 4. Après le développement

- Déploiement sur l'hébergeur choisi (Railway/Render en premier, migration possible plus tard).
- Chaque représentant/front desk/directeur reçoit une URL + ses identifiants, installe la PWA sur son téléphone comme prévu.
- Mise en place du ZDR avec Anthropic si tu actives la fonctionnalité d'itinéraire IA en production.
- Formation courte de l'équipe (l'app a été pensée pour ne pas en nécessiter, mais un premier tour guidé aide toujours).
