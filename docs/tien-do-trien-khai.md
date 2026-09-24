# Tiến độ triển khai (cập nhật 24/09/2026)

Ghi chú để phiên làm việc sau tiếp tục đúng chỗ. Code M0–M6 đã xong, CI xanh; `main` = `454f6e9`.

## Đã xong ✅

| Hạng mục | Chi tiết |
|---|---|
| Supabase project | `mita-workspace`, ref `ufomfswokkqzlwhowtlx`, vùng Singapore |
| Bảng + hàm | Workflow **Cài đặt / cập nhật Supabase** chạy thành công: 13/13 migration, 6 Edge Function |
| GitHub secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` |
| Extensions | `pg_cron`, `pg_net` đã bật |
| Vault | `project_url` = `https://ufomfswokkqzlwhowtlx.supabase.co`, `cron_secret` (64 ký tự) |
| Edge Function secrets | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SYSTEM_USER` = `sale05@mitaexport.com`, `CRON_SECRET` |
| Google Cloud | Project "My First Project"; service account `mita-system` + key JSON (đã tắt tạm chặn tạo key) |
| Tài khoản | Admin cài đặt: `sale@mitaexport.com`. Tài khoản hệ thống gửi mail/Drive: `sale05@mitaexport.com` (không cần admin) |
| Cloudflare | Đã tạo **Worker** `mita-workspace` (tài khoản anhnq8.cat), 4 biến build đã nhập. Repo đã có `wrangler.jsonc`, `.node-version`, bỏ `_redirects` |

## Cần kiểm tra lại ⚠️

- [ ] Bật lại chặn tạo key: Organization Policies → `iam.managed.disableServiceAccountKeyCreation` → **Inherit parent's policy**.
- [ ] Đã bật **Gmail API** + **Google Drive API** chưa.
- [ ] Đã làm **domain-wide delegation** (Unique ID của `mita-system`, scope `drive,gmail.send`) chưa.
- [ ] Lịch tự động: `select jobname, schedule, active from cron.job;` phải có `mita-tick`.
- [ ] Worker Cloudflare: bản `main` mới (`454f6e9`) **chưa được tự build** – nếu vẫn chưa có, vào Deployments bấm build cho nhánh `main`, hoặc chuyển sang Pages (bước 1 bên dưới).

## Việc tiếp theo ⏭️

1. **Chọn địa chỉ web** (đang dừng ở đây). Người dùng nghiêng về cách nhanh, ít cài đặt:
   - *Nhanh nhất:* giữ địa chỉ `…workers.dev` của Worker hiện có (không cần làm thêm gì; có thể rút gọn phần tài khoản ở Workers & Pages → Subdomain).
   - *Đẹp, vẫn đơn giản:* `work.mitaexport.com` – tạo **Cloudflare Pages** (`docs/setup-cloudflare.md` mục 1) rồi thêm **1 bản ghi CNAME** `work` → `<project>.pages.dev` ở **Nhân Hòa** (nơi quản lý DNS `mitaexport.com`). Không đụng bản ghi MX (email Google).
   - Nếu dùng Pages: xóa Worker cũ sau khi Pages chạy (Settings → Danger zone).
2. Điền địa chỉ web đã chọn vào 3 chỗ:
   - Supabase → Authentication → URL Configuration: **Site URL** + **Redirect URLs** (`<địa chỉ>/**`).
   - Edge Functions → Secrets: `APP_ORIGIN` = `<địa chỉ>` (không có `/` cuối).
   - Google OAuth Client → **Authorized JavaScript origins**.
3. **Đăng nhập Google:** tạo OAuth Client (Internal) → dán Client ID/secret vào Supabase → Authentication → Providers → Google (`docs/setup-google.md` mục 3).
4. **Danh sách nhân viên:** gửi `Họ tên | email | team | vai trò` → tạo SQL roster (`supabase/roster.example.sql`).
5. Nhóm Google (`all@`, `sales@`, `mkt@`, `managers@`) + 3 Shared Drive, thêm `sale05@` làm Người quản lý nội dung; gửi ID 2 drive để điền `drive.folders`.
6. Sao lưu: secrets cho workflow backup (`docs/backup.md`).
7. Đăng nhập thử, nghiệm thu theo `docs/van-hanh.md`.
