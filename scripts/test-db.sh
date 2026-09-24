#!/usr/bin/env bash
# Applique les migrations + le seed sur une base PostgreSQL vide imitant Supabase,
# puis lance les tests de sécurité (RLS, quota, relance, cascade).
# Usage : DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis (base vide, jamais un vrai projet Supabase)}"
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }
run supabase/tests/supabase-stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rls_test.sql | grep -q "Tous les tests RLS sont passés"
echo "✅ Migrations, seed et tests RLS OK"
