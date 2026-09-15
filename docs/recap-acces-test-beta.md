# Récap des accès — Test de la version bêta

**URL de l'application** : https://moken-crm.onrender.com
(première ouverture parfois lente — jusqu'à 50-60 secondes — le service gratuit "se réveille" après une période sans trafic)

**Mot de passe unique pour tous les comptes de démo** : `moken1234`

Pour tester plusieurs profils sans te reconnecter/déconnecter à chaque fois, utilise une fenêtre de navigation privée par profil (Ctrl+Maj+N sur Chrome/Edge, Cmd+Maj+N sur Mac) — chacune garde sa propre session.

---

## Les comptes

| Profil | Email | Rattachement |
|---|---|---|
| Directeur | `directeur@moken.demo` | — |
| Administrateur | `admin@moken.demo` | — |
| Master Rep | `masterrep@moken.demo` | — |
| Représentant | `rep@moken.demo` | Rattaché au Master Rep ci-dessus |
| Représentant (2) | `rep2@moken.demo` | Non rattaché à un Master Rep |
| Front desk | `frontdesk@moken.demo` | — |

---

## Ce que chaque profil peut voir/faire

**Directeur** — vue globale sur toute l'entreprise :
Tableau de bord (CA, précommandes, objectifs), Clients & prospects (tous, avec réaffectation), Équipe (gestion complète, hiérarchie Master Rep/représentants), Front desk (validation des commandes), Data (Bestsellers, Performance client, Analytics, Extraction Excel), Config (règles commerciales, réglages Dolibarr), Utilisateurs (comptes front desk/administrateur), Agenda (toute l'équipe).

**Administrateur** — gestion catalogue et imports :
Catalogue produits (création, import en masse, photos), Import de fiches clients, Fiches clients (lecture/écriture, hors commandes/pipeline).

**Master Rep** — suivi de son équipe, lecture seule sur les objectifs :
Équipe (les représentants qui lui sont rattachés, avec leur progression), Clients & prospects (ceux de son équipe), Commandes, Agenda. Ne fixe jamais d'objectif lui-même.

**Représentant** — usage terrain au quotidien :
Tableau de bord personnel, Clients & prospects, Commandes, Catalogue (consultation pour prise de commande), Agenda avec badge de rendez-vous à venir. (Onglet Data encore "Bientôt disponible" pour ce profil.)

**Front desk** — traitement des commandes uniquement :
File des commandes à valider, check-list, export vers Dolibarr, SAV.

---

## Une idée de parcours de test

1. Se connecter en **Directeur**, créer un objectif pour un représentant, vérifier qu'il apparaît côté Master Rep/Représentant en lecture seule.
2. Se connecter en **Représentant**, créer un client, lui ajouter une interaction, passer une commande depuis sa fiche.
3. Se connecter en **Front desk**, retrouver cette commande dans la file, la valider.
4. Revenir en **Directeur**, vérifier qu'elle apparaît bien dans le CA du tableau de bord et dans Data/Analytics.
5. Se connecter en **Administrateur**, ajouter/modifier un produit au catalogue, vérifier qu'il apparaît côté Représentant.
