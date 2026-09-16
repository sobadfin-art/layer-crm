# Import catalogue réel — 15/09/2026

Fichier source : `test_Claude.xlsx` (onglets **SUN 26** et **OPTICS 26**), fourni par le client.

## Résultat

| Onglet source | Catalogue CRM créé | Lignes retenues | Erreurs |
|---|---|---|---|
| SUN 26 | Sunglasses 2026 | **193** | 0 |
| OPTICS 26 | Optics 2026 | **150** | 0 |

Testé de bout en bout (preview → summary → commit) via le mécanisme d'import existant, en local, avant toute action sur la production. Catégories : 100% reconnues (Premium/Classic/Goggles/Accessories/Display/Merchandising/Kids/Optics → les 8 catégories officielles du CRM), aucune fiche en "Non classé".

## Règles appliquées (validées avec le client)

1. **Sous-lignes couleur des packs Sunglasses exclues.** 8 références vendues en pack (ex. `MKNI06-PACK`, 8 unités / 4 coloris) ont, dans le fichier, des lignes de détail par coloris (ex. `MKNI06-TORT-GRN`) sans prix France complet. Ces ~32 lignes ont été exclues : seule la référence `-PACK` (l'unité réellement commandable, avec un prix complet) est importée. Cas particulier traité à part : `MKNK22` et `MKNK21` répétaient la même référence 4 fois en colonne D (au lieu d'être vides) — sans cette exclusion, 3 fiches sur 4 auraient été écrasées silencieusement par le mécanisme d'import (référence non unique).
2. **Couleur : extraction automatique best-effort** depuis le suffixe de la référence (ex. `MKNF03-CRST-TORT-GRN` → couleur `CRST-TORT-GRN`). Le fichier n'a pas de colonne Couleur dédiée. **Non garanti fiable** — à vérifier fiche par fiche, notamment sur les accessoires/displays où le suffixe n'est pas une vraie couleur (ex. `AMKN05-CLIP` → couleur `CLIP`).
3. **Prix Optique.** L'onglet OPTICS n'a pas de colonnes France/Export/Suisse comme les Sunglasses — seulement RRP, « Marge 2,7 » et « Marge 2,9 ». Sur validation client, le prix **Marge 2,7** est utilisé à l'identique pour les 3 prix CRM (France = Export = Suisse = RRP / 2,7). Prix Suisse Optique donc arbitraire pour l'instant — pas une vraie donnée marché.
4. **Description conservée**, nettoyée de l'artefact de recopie Excel (« sold by pack of 8units. **4colors x 17** » → le suffixe « x N » était un bug de remplissage automatique dans le fichier source, supprimé). Sur l'onglet Optique, la taille de monture (colonne « Boxing ») est reprise en description (ex. « Taille monture : 47-21-140 »).

## Correctifs apportés au mécanisme d'import lui-même

- Ajout du champ **Description** à l'import en masse (colonne reconnue automatiquement : `description`/`note`/`notes`/`desc`) — absent du mapping jusqu'ici.
- Ajout du synonyme anglais **« Accessories »** à la reconnaissance de catégorie (seul « Accessoires »/« Access » était reconnu ; le fichier réel utilise l'anglais et serait tombé en « Non classé » sans ce correctif).

## Fichiers livrés

- `import-sunglasses-2026.csv`, `import-optics-2026.csv` — prêts à être importés tels quels via **Administrateur → Catalogue → Import** (mapping auto-détecté à 100%, vérifié).

## Bonus — rapprochement photos mokenvision.com

Le script de rapprochement automatique (`backend/scripts/mokenvision-photos/match-photos-to-catalog.mjs`), préparé plus tôt dans le projet mais resté à 0 correspondance faute de vrai catalogue, a été relancé en **dry-run** (aucune écriture) contre ce nouveau catalogue :

**115 correspondances trouvées sur 348 fiches** (catalogue collection Solaires uniquement — Optique, Enfants, Sport, Masques de ski et Accessoires du site ne sont pas encore couverts par l'extraction).

Pas encore appliqué — à confirmer avant d'écrire les URLs photo en base.

## Points restés en attente (non demandés, signalés pour info)

- Aucune quantité de stock réelle dans le fichier (colonne parasite ignorée) → toutes les fiches importées sont en statut « En stock », quantité 0 par défaut, à corriger manuellement ou via un futur fichier stock.
- 3 fiches produit de test pré-existantes (`MKN-003`, `MKN-TEST-DLB`, `MK-UI-PHOTO-001`) restent en catégorie « Non classé » dans la base de test locale — sans rapport avec cet import, à nettoyer séparément si besoin.
