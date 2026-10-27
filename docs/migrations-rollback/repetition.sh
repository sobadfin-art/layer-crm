#!/usr/bin/env bash
# Répétition des migrations en attente (celles du dépôt pas encore appliquées
# à la base) sur une COPIE LOCALE de la base de production, restaurée depuis l'export Render
# (fichier *.dir.tar.gz, onglet Recovery → Create export).
#
# Ce script ne se connecte JAMAIS à la production : il crée une base locale
# neuve (localhost) et n'utilise qu'elle. Rien n'est envoyé nulle part.
#
# Usage (depuis la racine du dépôt, branche claude/clever-noether-0cnu1z) :
#   bash docs/migrations-rollback/repetition.sh ~/Sauvegardes/2026-10-25T18_23Z.dir.tar.gz
#
# Prérequis : PostgreSQL 16 (ou plus récent) installé et démarré en local,
# Node.js 20+ ; `npm install` déjà fait dans backend/.
set -euo pipefail

ARCHIVE="${1:?Usage : bash docs/migrations-rollback/repetition.sh <export.dir.tar.gz>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DBNAME="moken_repetition_${STAMP//-/_}"
PGHOST_LOCAL="${PGHOST_LOCAL:-localhost}"
LOCAL_URL="postgres://${PGUSER:-$USER}${PGPASSWORD:+:$PGPASSWORD}@${PGHOST_LOCAL}:${PGPORT:-5432}/${DBNAME}"
OUT="${HOME}/moken-repetition-$STAMP"
mkdir -p "$OUT"

case "$PGHOST_LOCAL" in
  localhost|127.0.0.1) ;;
  *) echo "✗ Refus : ce script ne travaille que sur une base locale (localhost)."; exit 1 ;;
esac

echo "1/8  Extraction de l'export…"
WORK="$(mktemp -d)"
tar -xzf "$ARCHIVE" -C "$WORK"
DUMPDIR="$(dirname "$(find "$WORK" -name toc.dat | head -n 1)")"
[ -f "$DUMPDIR/toc.dat" ] || { echo "✗ toc.dat introuvable : l'archive n'est pas un export Render lisible."; exit 1; }

echo "2/8  Restauration dans la base locale $DBNAME…"
createdb -h "$PGHOST_LOCAL" "$DBNAME"
pg_restore -h "$PGHOST_LOCAL" -d "$DBNAME" --no-owner --no-acl "$DUMPDIR" 2> "$OUT/restauration.log" || true
if grep -qi "error" "$OUT/restauration.log"; then
  echo "  (avertissements de restauration dans $OUT/restauration.log — à vérifier)"
fi

count() { psql "$LOCAL_URL" -tA -F' | ' -f "$HERE/comptages.sql"; }

echo "3/8  Comptages AVANT migration…"
count > "$OUT/1-avant.txt"
psql "$LOCAL_URL" -tA -F' | ' -c "SELECT ref, label FROM products WHERE price_ch IS NULL ORDER BY ref" > "$OUT/references-sans-prix-suisse.txt"

echo "4/8  Migrations en attente…"
applied() { psql "$LOCAL_URL" -tA -c "SELECT name FROM schema_migrations ORDER BY name"; }
applied > "$OUT/migrations-avant.txt"
( cd "$REPO/backend" && DATABASE_URL="$LOCAL_URL" npm run migrate ) | tee "$OUT/migration.log"
# Migrations appliquées par CETTE exécution, de la plus récente à la plus
# ancienne : ce sont les seules dont le retour arrière est testé ensuite.
NEW_MIGRATIONS="$(applied | comm -13 "$OUT/migrations-avant.txt" - | sort -r)"
if [ -z "$NEW_MIGRATIONS" ]; then
  echo "  (aucune migration en attente : rien à répéter)"
fi

echo "5/8  Comptages APRÈS migration…"
count > "$OUT/2-apres.txt"

echo "6/8  Test du retour arrière ($(echo $NEW_MIGRATIONS | tr '\n' ' '))…"
for m in $NEW_MIGRATIONS; do
  RB="$HERE/${m%.sql}.rollback.sql"
  [ -f "$RB" ] || { echo "✗ Procédure de retour arrière introuvable pour $m ($RB)"; exit 1; }
  psql "$LOCAL_URL" -q -v ON_ERROR_STOP=1 -f "$RB"
done
count > "$OUT/3-apres-retour-arriere.txt"

echo "7/8  Ré-application des migrations…"
( cd "$REPO/backend" && DATABASE_URL="$LOCAL_URL" npm run migrate ) >> "$OUT/migration.log"
count > "$OUT/4-apres-reapplication.txt"

echo "8/8  Vérifications…"
VERDICT=0
# Avant / après : seule la ligne "migrations appliquées" doit changer.
if diff <(grep -v "^migrations appliquées" "$OUT/1-avant.txt") <(grep -v "^migrations appliquées" "$OUT/2-apres.txt") > /dev/null; then
  echo "  ✓ Après migration : toutes les données identiques (seul le nombre de migrations change)"
else
  echo "  ✗ ÉCART après migration :"; diff "$OUT/1-avant.txt" "$OUT/2-apres.txt" || true; VERDICT=1
fi
if diff "$OUT/1-avant.txt" "$OUT/3-apres-retour-arriere.txt" > /dev/null; then
  echo "  ✓ Retour arrière : base strictement identique à l'état d'avant"
else
  echo "  ✗ ÉCART après retour arrière :"; diff "$OUT/1-avant.txt" "$OUT/3-apres-retour-arriere.txt" || true; VERDICT=1
fi
if diff "$OUT/2-apres.txt" "$OUT/4-apres-reapplication.txt" > /dev/null; then
  echo "  ✓ Ré-application : identique à la première migration"
else
  echo "  ✗ ÉCART après ré-application"; VERDICT=1
fi
NB_SANS_CH="$(wc -l < "$OUT/references-sans-prix-suisse.txt" | tr -d ' ')"
echo "  • $NB_SANS_CH référence(s) sans prix Suisse : $OUT/references-sans-prix-suisse.txt"
echo
echo "Tableau AVANT / APRÈS :"
paste -d'|' "$OUT/1-avant.txt" "$OUT/2-apres.txt" \
  | awk -F' [|] |[|]' '{ printf "  %-42s %14s %14s\n", $1, $2, $4 }' \
  | tee "$OUT/tableau-avant-apres.txt"
echo
echo "Résultats complets : $OUT"
echo "Base locale conservée pour inspection : $DBNAME (à supprimer ensuite : dropdb $DBNAME)"
rm -rf "$WORK"
[ "$VERDICT" -eq 0 ] && echo "✓ RÉPÉTITION RÉUSSIE" || { echo "✗ RÉPÉTITION EN ÉCHEC — ne rien déployer"; exit 1; }
