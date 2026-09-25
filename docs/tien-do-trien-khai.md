# Tiến độ triển khai (cập nhật 25/09/2026)

Ghi chú để phiên làm việc sau tiếp tục đúng chỗ. Code M0–M6 đã xong, CI xanh; `main` = `454f6e9`.

**Web đang chạy tại:** `https://mita-workspace.anhnq8-cat.workers.dev` (Cloudflare Worker, build `main` thành công 25/09).

## Đã xong ✅

| Hạng mục | Chi tiết |
|---|---|
| Supabase project | `mita-workspace`, ref `ufomfswokkqzlwhowtlx`, vùng Singapore |
| Bảng + hàm | Workflow **Cài đặt / cập nhật Supabase** chạy thành công: 13/13 migration, 6 Edge Function |
| GitHub secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` |
| Extensions | `pg_cron`, `pg_net` đã bật |
| Vault | `project_url` = `https://ufomfswokkqzlwhowtlx.supabase.co`, `cron_secret` (64 ký tự) |
| Edge Function secrets | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SYSTEM_USER` = `sale05@mitaexport.com`, `CRON_SECRET` |
| Google Cloud | Project "My First Project"; service account `mita-system` + key JSON; đã bật lại chặn tạo key; đã bật Gmail API + Google Drive API |
| Tài khoản | Admin cài đặt: `sale@mitaexport.com`. Tài khoản hệ thống gửi mail/Drive: `sale05@mitaexport.com` (không cần admin) |
| Cloudflare | Đã tạo **Worker** `mita-workspace` (tài khoản anhnq8.cat), 4 biến build đã nhập. Repo đã có `wrangler.jsonc`, `.node-version`, bỏ `_redirects`. Build `main` + nhánh phát triển đều ✅ |
| Supabase URL Configuration | Site URL = `https://mita-workspace.anhnq8-cat.workers.dev`; Redirect URL = `https://mita-workspace.anhnq8-cat.workers.dev/**` |
| `APP_ORIGIN` | `https://mita-workspace.anhnq8-cat.workers.dev` (Edge Function secret) |

## Cần kiểm tra lại ⚠️

- [ ] Đã làm **domain-wide delegation** (Unique ID của `mita-system`, scope `drive,gmail.send`) chưa.
- [ ] Lịch tự động: `select jobname, schedule, active from cron.job;` phải có `mita-tick`.

## Việc tiếp theo ⏭️

1. **Đăng nhập Google (đang làm):** tạo OAuth Client (Internal, Web application) → *Authorized JavaScript origins* = `https://mita-workspace.anhnq8-cat.workers.dev`, *Redirect URI* = Callback URL lấy ở Supabase → Authentication → Providers → Google → dán Client ID/secret vào Supabase (`docs/setup-google.md` mục 3).
2. **Danh sách nhân viên:** gửi `Họ tên | email | team | vai trò` → tạo SQL roster (`supabase/roster.example.sql`).
3. Đăng nhập thử bằng tài khoản `@mitaexport.com`.
4. Nhóm Google (`all@`, `sales@`, `mkt@`, `managers@`) + 3 Shared Drive, thêm `sale05@` làm Người quản lý nội dung; gửi ID 2 drive để điền `drive.folders`.
5. Sao lưu: secrets cho workflow backup (`docs/backup.md`).
6. Nghiệm thu theo `docs/van-hanh.md`.
7. (Tùy chọn, sau này) Đổi sang `work.mitaexport.com`: Cloudflare Pages + 1 bản ghi CNAME `work` ở **Nhân Hòa** (không đụng MX), rồi cập nhật lại Site URL, Redirect URL, `APP_ORIGIN`, Google OAuth origin.
