#!/usr/bin/env bash
# Génère les fichiers à coller dans le tableau de bord Supabase (installation sans terminal) :
#   supabase/dashboard/01_installation.sql        migrations + table des plats, en une transaction
#   supabase/dashboard/<fonction>/index.ts        chaque Edge Function regroupée en un seul fichier
# Usage : scripts/build-dashboard-files.sh [--check]   (--check échoue si les fichiers ne sont pas à jour)
# Prérequis : Deno 2 (https://deno.land).
set -euo pipefail

OUT=supabase/dashboard
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/analyze-meal" "$TMP/delete-account" "$TMP/create-checkout" "$TMP/chariow-webhook"

# --- SQL ---------------------------------------------------------------------
{
  echo "-- Calbasse : installation complète de la base (tables, RLS, quota, suivi des scans, 69 plats)."
  echo "-- GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/migrations et supabase/seed.sql."
  echo "-- À coller tel quel dans Supabase > SQL Editor, puis « Run ». À n'exécuter qu'UNE fois sur un projet neuf."
  echo "-- Si tu utilises plus tard la CLI Supabase, marque d'abord ces migrations comme appliquées :"
  for f in supabase/migrations/*.sql; do
    echo "--   npx supabase@latest migration repair --status applied $(basename "$f" | cut -d_ -f1)"
  done
  echo
  echo "begin;"
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ============================================================================"
    echo "-- $(basename "$f")"
    echo "-- ============================================================================"
    cat "$f"
  done
  echo
  echo "-- ============================================================================"
  echo "-- Table des plats (valeurs approximatives à vérifier, voir docs/FOODS_TODO.md)"
  echo "-- ============================================================================"
  cat supabase/seed.sql
  echo
  echo "commit;"
  echo
  echo "select 'Installation Calbasse terminée : ' || count(*) || ' plats chargés' as resultat from public.foods;"
} > "$TMP/01_installation.sql"

# --- Edge Functions ----------------------------------------------------------
for fn in analyze-meal delete-account create-checkout chariow-webhook; do
  deno bundle --quiet --no-config --platform=deno --external 'npm:@supabase/supabase-js@2' \
    -o "$TMP/$fn/bundle.js" "supabase/functions/$fn/index.ts"
  {
    echo "// Edge Function $fn : version en un seul fichier pour l'éditeur du tableau de bord Supabase."
    echo "// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/$fn. Ne pas modifier à la main."
    echo "// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code)."
    cat "$TMP/$fn/bundle.js"
  } > "$TMP/$fn/index.ts"
  rm "$TMP/$fn/bundle.js"
done

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -r "$TMP" "$OUT" >/dev/null; then
    echo "supabase/dashboard n'est pas à jour : lance scripts/build-dashboard-files.sh" >&2
    diff -r "$TMP" "$OUT" | head -20 >&2
    exit 1
  fi
  echo "supabase/dashboard à jour."
else
  rm -rf "$OUT"
  mkdir -p "$OUT"
  cp -r "$TMP"/. "$OUT"/
  echo "Fichiers générés dans $OUT :"
  find "$OUT" -type f | sort
fi
