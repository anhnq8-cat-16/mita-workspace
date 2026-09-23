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

**Cách A – bằng dòng lệnh (khuyến nghị, cần Node.js 22):**
```bash
npx supabase login                       # mở trình duyệt để đăng nhập
npx supabase link --project-ref <ref>    # nhập Database password ở bước 1
npx supabase db push                     # chạy mọi file trong supabase/migrations
```

**Cách B – bằng tay:** Dashboard → **SQL Editor → New query**, lần lượt dán nội dung từng file trong `supabase/migrations/` **theo thứ tự tên file** và bấm **Run**.

## 3. Bật đăng nhập Google
1. **Authentication → Sign In / Providers → Google** → bật **Enable Sign in with Google**.
2. Dán **Client ID** và **Client Secret** (lấy ở `docs/setup-google.md` mục 3.3).
3. Sao chép **Callback URL** hiển thị ở đây (dạng `https://<ref>.supabase.co/auth/v1/callback`) → dán vào **Authorized redirect URIs** của OAuth Client trên Google Cloud.
4. Bấm **Save**.
5. **Authentication → URL Configuration:**
   - **Site URL:** `https://work.[DOMAIN]`
   - **Redirect URLs:** thêm `https://work.[DOMAIN]/auth/callback` (và `http://localhost:5173/auth/callback` nếu chạy local).
6. **Authentication → Sign In / Providers → mục User Signups:** để **bật** "Allow new users to sign up" (hệ thống tự chặn người ngoài domain và người chưa được mời bằng trigger trong database).

## 4. Khai báo domain + danh sách nhân sự (bắt buộc trước lần đăng nhập đầu tiên)
1. Mở `supabase/roster.example.sql`, thay `[DOMAIN]` và các email thật (mục 2.4 SPEC).
2. Dashboard → **SQL Editor → New query**, dán nội dung đã sửa → **Run**.
3. Kiểm tra: `select * from invitations;` phải thấy danh sách.

> Nếu chưa khai báo `allowed_email_domains`, **không ai đăng nhập được** (báo lỗi "Chỉ tài khoản Google của công ty…"). Đây là chủ ý để an toàn.

## 5. Secrets cho Edge Functions (từ M1)
Dashboard → **Edge Functions → Secrets** (hoặc `npx supabase secrets set TEN=giatri`):

| Tên | Giá trị |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | toàn bộ nội dung file key JSON (docs/setup-google.md mục 4) |
| `GOOGLE_SYSTEM_USER` | `[SYSTEM_USER]@[DOMAIN]` |
| `APP_ORIGIN` | `https://work.[DOMAIN]` |
| `CRON_SECRET` | chuỗi ngẫu nhiên dài (tạo bằng `openssl rand -hex 32`) |

## 6. Bật pg_cron + pg_net (từ M1)
Dashboard → **Database → Extensions** → tìm `pg_cron` → bật; tìm `pg_net` → bật. Lịch chạy được tạo bằng migration ở M1.

## 7. Khuyến nghị
Khi cả team dùng thật, nâng lên gói **Pro** (Settings → Billing) để có backup tự động hằng ngày và không bị tạm dừng khi ít truy cập. Backup hằng đêm lên Drive (M6) vẫn giữ.
