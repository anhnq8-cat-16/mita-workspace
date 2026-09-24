# Cài đặt Supabase

## 1. Tạo project
1. Vào <https://supabase.com/dashboard> → đăng nhập (nên dùng tài khoản công ty) → **New project**.
2. **Name:** `mita-workspace`. **Database password:** bấm *Generate*, lưu vào trình quản lý mật khẩu. **Region:** `Southeast Asia (Singapore)`. Bấm **Create new project**, chờ ~2 phút.
3. Vào **Project Settings → API** (hoặc nút **Connect**) và ghi lại:
   - **Project URL** → biến `VITE_SUPABASE_URL`
   - khóa **anon / publishable** → biến `VITE_SUPABASE_ANON_KEY` (khóa công khai, dùng được ở trình duyệt)
   - **KHÔNG** dùng khóa `service_role` / secret ở frontend.
4. **Project ref** là phần `xxxx` trong `https://xxxx.supabase.co`.

## 2. Tạo bảng (chạy migration)

**Trước tiên:** Dashboard → **Database → Extensions** → tìm và bật `pg_cron` và `pg_net` (lịch tự động dùng 2 extension này).

**Cách A – bằng GitHub Actions (dễ nhất, không cần cài gì lên máy):**
1. Lấy 3 giá trị:
   - **Access token:** <https://supabase.com/dashboard/account/tokens> → **Generate new token** → đặt tên `github-deploy` → sao chép (chỉ hiện 1 lần).
   - **Project ref:** phần `xxxx` trong Project URL `https://xxxx.supabase.co`.
   - **Database password:** mật khẩu đặt ở bước 1.
2. Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**, tạo 3 secret:
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
3. Repo → **Actions → Cài đặt / cập nhật Supabase → Run workflow** → để mặc định `database-va-functions` → **Run workflow**.
4. Chờ ~2–4 phút, dấu ✓ xanh là xong. Kiểm tra: Supabase → **Table Editor** thấy các bảng `profiles`, `tasks`, `leads`, `campaigns`…
5. Các lần cập nhật sau (có migration mới): chạy lại workflow này.

**Cách B – bằng dòng lệnh (cần Node.js 22):**
```bash
npx supabase login                       # mở trình duyệt để đăng nhập
npx supabase link --project-ref <ref>    # nhập Database password ở bước 1
npx supabase db push                     # chạy mọi file trong supabase/migrations
```

**Cách C – bằng tay:** Dashboard → **SQL Editor → New query**, lần lượt dán nội dung từng file trong `supabase/migrations/` **theo thứ tự tên file** và bấm **Run**.

## 3. Bật đăng nhập Google
1. **Authentication → Sign In / Providers → Google** → bật **Enable Sign in with Google**.
2. Dán **Client ID** và **Client Secret** (lấy ở `docs/setup-google.md` mục 3.3).
3. Sao chép **Callback URL** hiển thị ở đây (dạng `https://<ref>.supabase.co/auth/v1/callback`) → dán vào **Authorized redirect URIs** của OAuth Client trên Google Cloud.
4. Bấm **Save**.
5. **Authentication → URL Configuration:**
   - **Site URL:** `https://work.mitaexport.com`
   - **Redirect URLs:** thêm `https://work.mitaexport.com/auth/callback` (và `http://localhost:5173/auth/callback` nếu chạy local).
6. **Authentication → Sign In / Providers → mục User Signups:** để **bật** "Allow new users to sign up" (hệ thống tự chặn người ngoài domain và người chưa được mời bằng trigger trong database).

## 4. Danh sách nhân sự (bắt buộc trước lần đăng nhập đầu tiên)
Domain `mitaexport.com` đã được migration khai báo sẵn (`settings.allowed_email_domains`).
1. Mở `supabase/roster.example.sql`, điền email thật của từng người (mục 2.4 SPEC).
2. Dashboard → **SQL Editor → New query**, dán nội dung đã sửa → **Run**.
3. Kiểm tra: `select * from invitations;` phải thấy danh sách.

> Người đăng nhập mà chưa có trong danh sách sẽ thấy màn hình *"Tài khoản đang chờ quản trị kích hoạt"*; admin kích hoạt ở **Cài đặt → Người dùng**.

## 5. Gửi email nhắc việc (Edge Function `notify`) – từ M1
Làm sau khi xong `docs/setup-google.md` mục 4 (service account + domain-wide delegation).

**5.1 Secrets** – Dashboard → **Edge Functions → Secrets → Add new secret** (hoặc `npx supabase secrets set TEN=giatri`):

| Tên | Giá trị |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | toàn bộ nội dung file key JSON (mở bằng Notepad, copy hết) |
| `GOOGLE_SYSTEM_USER` | `sale05@mitaexport.com` |
| `CRON_SECRET` | chuỗi ngẫu nhiên dài, ví dụ tạo tại terminal: `openssl rand -hex 32` |

(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` Supabase tự cấp, không cần nhập.)

**5.2 Deploy function** (máy có Node.js, đã `npx supabase link` ở mục 2):
```bash
npx supabase functions deploy notify
npx supabase functions deploy checkin-photo          # M3: ảnh check-in lên Drive
npx supabase functions deploy drive-upload-init      # M4: thư viện – mở phiên upload
npx supabase functions deploy drive-upload-complete  # M4: thư viện – ghi nhận file
npx supabase functions deploy drive-move             # M4: duyệt / chuyển thư mục
npx supabase functions deploy drive-thumb            # M4: ảnh thu nhỏ
```
(Hoặc deploy tất cả một lần: `npx supabase functions deploy`.)
File `supabase/config.toml` đã tắt kiểm tra JWT cho `notify` (function tự kiểm tra `x-cron-secret`). `checkin-photo` kiểm tra đăng nhập của người gọi.
Thêm secret `APP_ORIGIN` = `https://work.mitaexport.com`: trình duyệt được phép gọi các function (CORS) và phiên upload Drive chỉ nhận file từ đúng địa chỉ này.

**5.3 Cho database biết địa chỉ function** – SQL Editor, chạy 1 lần (thay giá trị thật):
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<giống hệt CRON_SECRET ở 5.1>', 'cron_secret');
```
Đổi giá trị sau này: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<mới>');`

## 6. Lịch tự động (pg_cron + pg_net) – từ M1
1. Dashboard → **Database → Extensions** → bật `pg_cron` và `pg_net` (nên bật **trước** khi chạy migration ở mục 2; nếu đã chạy migration rồi mới bật thì chạy thêm lệnh ở bước 3).
2. Kiểm tra lịch: SQL Editor → `select jobname, schedule, active from cron.job;` phải có `mita-tick` chạy `* * * * *` (mỗi phút).
3. Nếu chưa có: `select cron.schedule('mita-tick', '* * * * *', 'select public.fn_cron_tick()');`
4. Theo dõi:
   - Job đã chạy hôm nay: `select * from cron_runs order by ran_at desc limit 20;`
   - Email chờ/đã gửi/lỗi: `select status, recipient, subject, last_error from outbox order by created_at desc limit 20;`

Mọi mốc giờ (08:30 nhắc kế hoạch, 09:15 tóm tắt, 17:00 nhắc báo cáo, 18:00 tóm tắt, 23:59 chốt ngày) đọc từ **Cài đặt → Thông số** theo giờ Việt Nam; không cần sửa cron khi đổi giờ.

## 7. Khuyến nghị
Khi cả team dùng thật, nâng lên gói **Pro** (Settings → Billing) để có backup tự động hằng ngày và không bị tạm dừng khi ít truy cập. Backup hằng đêm lên Drive vẫn giữ – cài theo [backup.md](backup.md).
