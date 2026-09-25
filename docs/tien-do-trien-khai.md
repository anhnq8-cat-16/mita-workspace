# Tiến độ triển khai (cập nhật 25/09/2026)

Ghi chú để phiên làm việc sau tiếp tục đúng chỗ. Code M0–M6 đã xong, CI xanh; `main` = `bf9d2f5` (có phần cho phép Gmail được mời).

**Web đang chạy tại:** `https://mita-workspace.anhnq8-cat.workers.dev` (Cloudflare Worker, build `main` thành công 25/09; người dùng đã mở thử trang chủ và `/thu-vien` – chạy tốt).

## Đã xong ✅

| Hạng mục | Chi tiết |
|---|---|
| Supabase project | `mita-workspace`, ref `ufomfswokkqzlwhowtlx`, vùng Singapore |
| Bảng + hàm | Workflow **Cài đặt / cập nhật Supabase** chạy thành công: 14/14 migration, 6 Edge Function |
| GitHub secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` |
| Extensions | `pg_cron`, `pg_net` đã bật |
| Vault | `project_url` = `https://ufomfswokkqzlwhowtlx.supabase.co`, `cron_secret` (64 ký tự) |
| Edge Function secrets | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SYSTEM_USER` = `sale05@mitaexport.com`, `CRON_SECRET` |
| Google Cloud | Project "My First Project"; service account `mita-system` + key JSON; đã bật lại chặn tạo key; đã bật Gmail API + Google Drive API |
| Domain-wide delegation | Client ID `105711268843774965483` (`mita-system`), scope `drive` + `gmail.send` – đã cấp 25/09 |
| Google OAuth (đăng nhập) | Client `Supabase` (Web application, Client ID `1055501173426-4qs…`), origin workers.dev + redirect Supabase callback; đã dán vào Supabase → Providers → Google – xong 25/09 |
| Tài khoản | Admin cài đặt: `sale@mitaexport.com`. Tài khoản hệ thống gửi mail/Drive: `sale05@mitaexport.com` (không cần admin) |
| Cloudflare | Đã tạo **Worker** `mita-workspace` (tài khoản anhnq8.cat), 4 biến build đã nhập. Repo đã có `wrangler.jsonc`, `.node-version`, bỏ `_redirects`. Build `main` + nhánh phát triển đều ✅ |
| Supabase URL Configuration | Site URL = `https://mita-workspace.anhnq8-cat.workers.dev`; Redirect URL = `https://mita-workspace.anhnq8-cat.workers.dev/**` |
| `APP_ORIGIN` | `https://mita-workspace.anhnq8-cat.workers.dev` (Edge Function secret) |

## Cần kiểm tra lại ⚠️

- [x] Lịch tự động chạy (outbox đã được gửi đi tự động).

## Việc tiếp theo ⏭️

1. ~~Tạo admin + đăng nhập thử~~ – **xong 25/09**: admin đã đăng nhập, vào được Thư viện.
   - [x] Đã sửa `settings.app_origin` → `https://mita-workspace.anhnq8-cat.workers.dev`.
   - [x] **Email thử gửi thành công** (outbox `sent`, 25/09) → delegation + Vault + cron + function `notify` đều chạy.
2. **Cho phép Gmail cá nhân (cách A, 25/09 – hết license Workspace, đã dùng 5/5):** code đã sửa (migration `20261002000100_invited_personal_email.sql` + form mời). Người dùng cần làm:
   - [x] Cloudflare Worker: đã xóa `VITE_GOOGLE_HD`; build `main` `bf9d2f5` ✅ (25/09).
   - [x] Google Auth Platform → **Audience** → *Make external* – đang ở chế độ **Testing** (không chọn được In production). ⇒ Mỗi Gmail nhân viên phải thêm vào **Audience → Test users** (tối đa 100).
   - [x] Workflow **Cài đặt / cập nhật Supabase** trên `main` ✅ – 14/14 migration (gồm `20261002000100`).
   - [x] Thử: thêm 1 Gmail vào Test users + mời trong app → **đăng nhập thành công** (25/09).
   - [ ] (Nếu nhân viên cần mở file Drive) Admin → Ứng dụng → Drive và Tài liệu → Chia sẻ: cho phép chia sẻ ra ngoài tổ chức.
3. **Danh sách nhân viên (hoãn, người dùng bổ sung sau khi chạy):** gửi `Họ tên | email | team | vai trò` → tạo SQL roster (`supabase/roster.example.sql`), hoặc admin tự thêm trong app.
4. Nhóm Google (`all@`, `sales@`, `mkt@`, `managers@`) + 3 Shared Drive, thêm `sale05@` làm Người quản lý nội dung; gửi ID 2 drive để điền `drive.folders`.
5. Sao lưu: secrets cho workflow backup (`docs/backup.md`).
6. Nghiệm thu theo `docs/van-hanh.md`.
7. (Tùy chọn, sau này) Đổi sang `work.mitaexport.com`: Cloudflare Pages + 1 bản ghi CNAME `work` ở **Nhân Hòa** (không đụng MX), rồi cập nhật lại Site URL, Redirect URL, `APP_ORIGIN`, Google OAuth origin.
