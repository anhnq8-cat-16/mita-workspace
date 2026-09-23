#!/usr/bin/env bash
# Khôi phục file backup vào 1 database TRỐNG (project Supabase mới hoặc project test).
#   TARGET_DB_URL=postgresql://... bash scripts/backup/restore.sh 2026-10-05.sql.gz
# Chạy trong 1 transaction: lỗi ở bất kỳ đâu → không ghi gì.
set -euo pipefail
FILE="${1:?Cần file .sql.gz}"
: "${TARGET_DB_URL:?Thiếu TARGET_DB_URL (database đích)}"

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "Sẽ ghi dữ liệu vào: ${TARGET_DB_URL%%@*}@…"
  read -r -p "Database đích là project MỚI/TEST (không phải bản đang dùng)? Gõ yes: " ans
  [ "$ans" = "yes" ] || { echo "Đã hủy."; exit 1; }
fi

gunzip -c "$FILE" | psql "$TARGET_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -q
echo "Khôi phục xong. Kiểm tra nhanh:"
psql "$TARGET_DB_URL" -At -c "select 'profiles', count(*) from public.profiles
  union all select 'daily_reports', count(*) from public.daily_reports
  union all select 'tasks', count(*) from public.tasks
  union all select 'leads', count(*) from public.leads
  union all select 'orders', count(*) from public.orders"
