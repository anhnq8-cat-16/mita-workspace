#!/usr/bin/env bash
# Sao lưu toàn bộ database Supabase thành 1 file .sql.gz khôi phục được bằng psql.
# Theo hướng dẫn chính thức của Supabase (roles → schema → data, tắt trigger khi nạp dữ liệu).
#   SUPABASE_DB_URL=postgresql://... bash scripts/backup/dump.sh backup.sql.gz
set -euo pipefail
OUT="${1:?Cần tên file đầu ra}"
: "${SUPABASE_DB_URL:?Thiếu SUPABASE_DB_URL}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$TMP/data.sql" --use-copy --data-only

bash "$(dirname "$0")/combine.sh" "$TMP/roles.sql" "$TMP/schema.sql" "$TMP/data.sql" | gzip -9 > "$OUT"
echo "Đã tạo $OUT ($(du -h "$OUT" | cut -f1))"
