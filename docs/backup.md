# Backup & khôi phục dữ liệu

Mỗi đêm **01:00 (giờ Việt Nam)** GitHub Actions sao lưu toàn bộ database Supabase thành 1 file
`MITA Backup/db/<YYYY-MM-DD>.sql.gz` trên Google Drive, giữ **30 bản gần nhất** (bản cũ hơn vào thùng
rác của Shared Drive, Drive tự xóa hẳn sau 30 ngày).

File backup gồm: vai trò, cấu trúc bảng + hàm + RLS, và **toàn bộ dữ liệu** (kể cả tài khoản đăng nhập
`auth.users`). Ảnh/tài liệu đã nằm sẵn trên Shared Drive nên không nằm trong file này.

> File backup chứa dữ liệu cá nhân và khách hàng. Chỉ `managers@` và tài khoản hệ thống được vào
> `MITA Backup`; không tải file về máy cá nhân khi không cần.

---

## 1. Cài đặt (làm 1 lần)

### 1.1 Shared Drive
Đã tạo ở [setup-google.md](setup-google.md) mục 2: `MITA Backup`, thành viên `managers@` và
`sale05@mitaexport.com` là **Người quản lý nội dung**. Mở drive → copy **ID** trên thanh địa chỉ
(phần sau `folders/`). Thư mục `db` hệ thống tự tạo.

### 1.2 Chuỗi kết nối database
Supabase Dashboard → nút **Connect** (trên cùng) → tab **Connection string** → chọn **Session pooler**
(GitHub Actions chỉ có IPv4; kiểu *Direct connection* sẽ không kết nối được) → copy chuỗi dạng
`postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
và thay `[YOUR-PASSWORD]` bằng mật khẩu database (Settings → Database → *Reset database password* nếu quên).

### 1.3 Secrets trên GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Tên | Giá trị |
|---|---|
| `SUPABASE_DB_URL` | chuỗi ở mục 1.2 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | giống secret cùng tên trên Supabase (toàn bộ file key JSON) |
| `GOOGLE_SYSTEM_USER` | `sale05@mitaexport.com` |
| `BACKUP_DRIVE_FOLDER_ID` | ID Shared Drive `MITA Backup` (mục 1.1) |
| `TEST_DB_URL` | *(tùy chọn, cho mục 3)* chuỗi Session pooler của project **test** |

Service account dùng scope `https://www.googleapis.com/auth/drive` – đã ủy quyền ở
[setup-google.md](setup-google.md) mục 4, không cần thêm.

### 1.4 Chạy thử ngay
Repo → **Actions → Backup DB hằng đêm → Run workflow**. Sau ~2 phút mở Drive `MITA Backup/db`
phải thấy file `<hôm nay>.sql.gz` (nghiệm thu M6-2).

## 2. Theo dõi hằng ngày
- Repo → **Actions → Backup DB hằng đêm**: dấu ✓ xanh mỗi đêm.
- Lỗi → GitHub gửi email cho người sửa file `backup.yml` gần nhất (và chủ repo). Mở lần chạy lỗi để xem bước nào đỏ:

| Bước lỗi | Nguyên nhân thường gặp |
|---|---|
| *Dump database* – `connection refused` / `timeout` | `SUPABASE_DB_URL` là *Direct connection* (IPv6) → đổi sang **Session pooler**; hoặc project Supabase gói Free đang **tạm dừng** (Dashboard → Restore). |
| *Dump database* – `password authentication failed` | Đổi mật khẩu database mà chưa cập nhật secret. |
| *Tải lên Google Drive* – `unauthorized_client` | Domain-wide delegation chưa có scope `drive` cho Client ID của service account. |
| *Tải lên Google Drive* – `404 File not found` | `BACKUP_DRIVE_FOLDER_ID` sai, hoặc `sale05@` chưa là thành viên `MITA Backup`. |

## 3. Thử khôi phục định kỳ (khuyến nghị mỗi quý – nghiệm thu M6-3)
1. Tạo 1 project Supabase **mới, trống** tên `mita-test` (miễn phí), region Singapore.
2. Lấy chuỗi **Session pooler** của project test → secret `TEST_DB_URL`.
3. Repo → **Actions → Thử khôi phục backup → Run workflow**. Workflow tải bản mới nhất từ Drive,
   khôi phục vào `mita-test` và in số dòng `profiles`, `daily_reports`, `tasks`, `leads`, `orders`.
4. So với project thật (SQL Editor: `select count(*) from profiles;` …) – khớp là đạt.
5. Xóa project test nếu không cần nữa (Settings → General → Delete project).

## 4. Khôi phục thật (khi mất dữ liệu / project hỏng)

**Luôn khôi phục vào project MỚI**, không ghi đè lên project đang chạy. Thao tác này ~30–60 phút.

### 4.1 Chuẩn bị
- Máy có `psql` (Windows: cài *PostgreSQL* bản 15+ và chỉ chọn *Command Line Tools*; macOS: `brew install libpq`).
- Tải file backup cần dùng từ Drive `MITA Backup/db/` (chọn ngày trước sự cố).

### 4.2 Tạo project mới và nạp dữ liệu
1. Tạo project Supabase mới (Singapore), đặt mật khẩu database, bật extension `pg_cron`, `pg_net`
   (Database → Extensions).
2. Lấy chuỗi **Session pooler** của project mới.
3. Chạy (trong thư mục repo):
   ```bash
   TARGET_DB_URL='postgresql://postgres.<ref-mới>:<mật khẩu>@...pooler.supabase.com:5432/postgres' \
     bash scripts/backup/restore.sh 2026-10-05.sql.gz
   ```
   Gõ `yes` khi được hỏi. Toàn bộ chạy trong 1 transaction: lỗi ở đâu thì không ghi gì, sửa rồi chạy lại.
   Cuối cùng script in số dòng các bảng chính để đối chiếu.

### 4.3 Việc cần làm lại trên project mới
Những thứ này không nằm trong database nên phải làm lại (theo [setup-supabase.md](setup-supabase.md)):
1. **Lịch tự động:** SQL Editor → `select cron.schedule('mita-tick', '* * * * *', 'select public.fn_cron_tick()');`
2. **Vault** (mục 5.3): `project_url` = địa chỉ project **mới**, `cron_secret`.
3. **Edge Functions + secrets** (mục 5.1–5.2): `npx supabase link --project-ref <ref-mới>` rồi
   `npx supabase functions deploy`, nhập lại các secret.
4. **Đăng nhập Google** (mục 3): bật provider Google với Client ID/Secret cũ, thêm redirect URL mới
   `https://<ref-mới>.supabase.co/auth/v1/callback` vào OAuth Client trên Google Cloud; URL Configuration
   thêm `https://work.mitaexport.com/auth/callback`.
5. **Lịch sử migration:** `npx supabase migration list` – nếu cột *Remote* trống, đánh dấu đã chạy để lần
   `db push` sau không chạy lại:
   `npx supabase migration repair --status applied $(ls supabase/migrations | cut -c1-14 | tr '\n' ' ')`
6. **Frontend:** Cloudflare Pages → Settings → Environment variables: đổi `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` sang project mới → **Retry deployment**.
7. **Backup:** cập nhật secret `SUPABASE_DB_URL` trên GitHub.
8. Đăng nhập thử bằng tài khoản admin, mở **Nhật ký → Hệ thống** xem job tự động chạy lại và email gửi được.

## 5. Chạy backup bằng tay trên máy (khi cần)
```bash
npx supabase db dump --help          # cần Docker Desktop đang chạy
SUPABASE_DB_URL='postgresql://...' bash scripts/backup/dump.sh backup.sql.gz
```
