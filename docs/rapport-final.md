# Rapport final — État de l'application Moken CRM

Rapport factuel de l'état actuel du CRM, à date. Il ne remplace pas le README (référence
technique détaillée, section par section, avec l'historique complet des décisions) ni le
handoff d'origine (`etat-final-prototype-handoff.md`, la spécification de départ) — il en est
le résumé, pensé pour une lecture rapide de ce qui existe, ce qui a été testé, et ce qui reste
honnêtement à faire.

---

## 1. Ce qui est construit et testé

**Les 6 lots du plan de développement initial** sont livrés : fondations (auth, cloisonnement
par rôle), CRM de base (fiches client, historique, pipeline, agenda/tâches), catalogue et prise
de commande (import en masse, remises, précommande), front desk et export Dolibarr (file de
validation, check-list, export CSV configurable, SAV), pilotage (objectifs CA ferme/précommande,
dashboard, gestion d'équipe), et finitions (audit, notifications temps réel, multilingue
FR/EN/ES, PWA installable avec mode hors-ligne partiel).

**Les quatre portails** sont construits et testés : Représentant, Master Rep, Directeur et
Administrateur. Chacun a sa navigation propre, son écran d'accueil, et n'accède qu'aux données
que son rôle autorise — le cloisonnement est appliqué côté serveur sur chaque route, jamais
laissé au seul frontend.

**Le chantier de durcissement authentification** est livré : bootstrap sécurisé du premier
compte DIRECTEUR, création encadrée des comptes FRONT_DESK/ADMINISTRATEUR, changement de mot de
passe forcé en première connexion, réinitialisation de mot de passe, désactivation de compte à
effet immédiat (revérifiée en base à chaque requête, pas seulement au login), session en cookie
httpOnly uniquement (plus de JWT en clair côté frontend), limitation de débit sur le login.

**L'import Dolibarr** couvre aujourd'hui deux volets, chacun avec son propre cahier des charges
champ par champ (`docs/cahier-des-charges-champs-import-*.md`) : les fiches client et le
catalogue produit, avec un socle obligatoire (9 colonnes) et des champs enrichis optionnels
(typologie, IBAN/BIC, mandat SEPA, collection, statut stock, date de réassort, etc.) reconnus
automatiquement par motif de nom de colonne, sans jamais rien inventer quand une valeur est
absente ou non reconnue.

**Les photos produit** disposent de deux voies indépendantes, utilisables à tout moment sur la
même fiche : le rapprochement automatique avec les photos publiées sur mokenvision.com (par nom
de modèle, jamais par référence interne, jamais de photo approximative) et — nouveau — le
téléversement direct d'un fichier JPEG/PNG/WebP depuis l'écran Catalogue produit, pour les
produits pas encore vendus en ligne. Le rapprochement automatique a été vérifié fonctionnel
(0 correspondance sur le catalogue actuel, qui est un catalogue de démonstration ne recouvrant
aucun modèle réel de la marque — comportement attendu, pas un défaut) ; le téléversement a été
vérifié de bout en bout, y compris à travers l'interface réelle.

## 2. Limites assumées, documentées plutôt que masquées

- **Pas d'ORM (Prisma)** : le téléchargement de ses binaires est bloqué par la politique réseau
  de cet environnement de développement. Le schéma est géré en SQL brut avec un petit runner de
  migrations — un choix viable, Prisma pourra être réintroduit une fois le projet hébergé
  ailleurs.
- **PWA / mode hors-ligne** : volontairement limité à l'app shell, à l'écran de connexion et à
  l'écran front desk (lecture seule de quelques endpoints). Aucune écriture n'est jamais
  interceptée hors-ligne — un clic sur une action qui modifie des données échoue proprement
  plutôt que de laisser croire à un succès.
- **Onglet Data du Représentant** : encore un écran générique « Bientôt disponible », non
  construit (seuls Directeur et Administrateur ont un module Data/import complet à ce stade).
- **Sessions JWT stateless** : pas de liste de révocation ni de refresh token. Un token émis
  reste valide jusqu'à expiration (8h) même après déconnexion ; ce que la déconnexion garantit
  réellement, c'est que le cookie du navigateur ne le renvoie plus, et qu'un compte désactivé
  est de toute façon bloqué à la requête suivante.
- **Import de photos en masse** (ZIP, bibliothèque d'images) : non couvert. Le téléversement
  actuel se fait référence par référence.
- **Environnement de développement actuel** : base de données et services tournent en local dans
  ce sandbox, pas en production. Un passage en hébergement réel (Railway/Render ou équivalent)
  reste à faire quand vous le déciderez.

## 3. Historique récent (cette session)

- Import Dolibarr enrichi (comptes et catalogue) vérifié de bout en bout, avec un bug corrigé
  (un champ à contrainte NOT NULL pouvait recevoir `null` depuis le chemin de mise à jour).
- Les deux cahiers des charges champ par champ rédigés, puis convertis en PDF à votre demande.
- Scraping de mokenvision.com (collection Solaires, 191 fiches/76 modèles) et mécanisme de
  rapprochement automatique construit, testé et vérifié fonctionnel — 0 rapprochement sur le
  catalogue actuel car ce sont des données de démonstration, pas des références réelles.
- Téléversement direct de photo produit ajouté (backend + interface), pour les produits pas
  encore vendus en ligne — vérifié de bout en bout via l'interface réelle.
- Calcul des objectifs : confirmé et re-vérifié que c'est bien la date de **validation** de la
  commande (`orders.validated_at`) qui détermine sa période, jamais sa date de création —
  comportement déjà en place, revérifié par un test de bout en bout dédié.
- README : passage de cohérence — plusieurs affirmations devenues fausses avec le temps ont été
  corrigées (le rôle Administrateur était encore décrit comme sans écran dédié, alors que deux
  écrans existent désormais ; l'agenda et la fiche client étaient décrits comme inexistants côté
  frontend, alors qu'ils sont construits ; la liste des documents de référence ne citait pas les
  quatre documents créés depuis).
- Un point du cahier des charges (préserver le Code Dolibarr existant sur une fiche quand la
  colonne est absente du fichier d'import) a été retiré de la liste des travaux : vous avez
  indiqué que vos futurs imports suivront systématiquement le cahier des charges fourni et
  incluront cette colonne, rendant le correctif inutile en pratique.

## 4. Suite possible

Au-delà d'un passage en hébergement de production, l'application couvre aujourd'hui l'intégralité
des rôles et fonctionnalités métier décrits dans le handoff d'origine, plus les demandes
formulées depuis. Sauf besoin exprimé de votre part, il n'y a pas de chantier ouvert en attente.
