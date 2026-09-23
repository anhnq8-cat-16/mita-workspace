#!/usr/bin/env bash
# Chạy migration + test RLS trên Postgres cục bộ (không cần Docker/Supabase CLI).
# Yêu cầu: psql, pg_prove, extension pgtap. Biến môi trường: PGHOST, PGUSER, PGPASSWORD...
# CI cũng chạy script này (Postgres 16 của runner). Supabase đầy đủ: `supabase start && supabase test db`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${TEST_DB:-mita_test}"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$ROOT/scripts/local-db/auth-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "create extension if not exists pgtap with schema extensions"
pg_prove -d "$DB" --ext .sql -r "$ROOT/supabase/tests/database"
