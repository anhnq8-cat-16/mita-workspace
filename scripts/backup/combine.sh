#!/usr/bin/env bash
# Ghép roles + schema + data thành 1 script SQL (ghi ra stdout).
# session_replication_role = replica: nạp dữ liệu không chạy trigger/khóa ngoại theo thứ tự.
set -euo pipefail
ROLES="$1" SCHEMA="$2" DATA="$3"
echo "-- Mita Workspace backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "-- Khôi phục: xem docs/van-hanh.md (mục Khôi phục backup)"
cat "$ROLES"
cat "$SCHEMA"
echo "SET session_replication_role = replica;"
cat "$DATA"
echo "SET session_replication_role = DEFAULT;"
