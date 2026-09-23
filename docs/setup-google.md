# Cài đặt Google Workspace & Google Cloud

Hướng dẫn cho người không chuyên. Làm lần lượt từng bước. Cần tài khoản **quản trị Google Workspace** (Super Admin).

Thông tin công ty: domain `mitaexport.com`; tài khoản hệ thống `sale05@mitaexport.com` (gửi email nhắc việc, quản lý file trên Shared Drive). Ứng dụng chạy tại `https://work.mitaexport.com`.

> **Milestone 0 chỉ cần mục 3 (đăng nhập Google).** Các mục 1, 2, 4, 5 cần từ M1 (email) và M3/M4 (Drive), có thể làm sau.

---

## 1. Google Admin Console – nhóm & tài khoản hệ thống (cần từ M1)

1. Vào <https://admin.google.com> bằng tài khoản Super Admin.
2. **Tài khoản hệ thống:** dùng `sale05@mitaexport.com` (đã có). Lưu ý:
   - Email nhắc việc sẽ gửi **từ** địa chỉ này và nằm trong mục *Đã gửi* của hộp thư sale05.
   - Không đổi mật khẩu/xóa tài khoản này khi chưa đổi `GOOGLE_SYSTEM_USER` trong Supabase, nếu không email và Drive sẽ ngừng chạy.
   - Nếu sau này muốn tách riêng, tạo tài khoản mới rồi chỉ cần đổi secret `GOOGLE_SYSTEM_USER` + `settings.system_user_email`.
3. **Google Groups:** menu trái **Thư mục → Nhóm → Tạo nhóm**. Tạo 4 nhóm:
   | Email nhóm | Thành viên |
   |---|---|
   | `all@mitaexport.com` | Tất cả nhân viên dùng hệ thống |
   | `sales@mitaexport.com` | Team Sale nội địa |
   | `mkt@mitaexport.com` | Team Marketing |
   | `managers@mitaexport.com` | Quý Anh, chị Hà, Trang |

## 2. Shared Drive (cần từ M3/M4 – ảnh check-in, thư viện)

1. Mở <https://drive.google.com> bằng tài khoản admin → cột trái **Bộ nhớ dùng chung (Shared drives) → + Mới**.
2. Tạo 3 Shared Drive, rồi bấm tên drive → **Quản lý thành viên**:
   | Shared Drive | Thành viên → quyền |
   |---|---|
   | `MITA Library` | `all@` → Người xem; `mkt@`, `managers@` → Người quản lý nội dung; `sale05@mitaexport.com` → Người quản lý nội dung |
   | `MITA Sales Private` | `sales@`, `managers@` → Người quản lý nội dung; `sale05@mitaexport.com` → Người quản lý nội dung |
   | `MITA Backup` | `managers@` → Người quản lý nội dung; `sale05@mitaexport.com` → Người quản lý nội dung |
3. Thư mục bên trong sẽ được hướng dẫn tạo ở M4 (ID thư mục nhập vào **Cài đặt → Thông số → `drive.folders`**).

## 3. Google Cloud – đăng nhập Google (cần ngay cho M0)

### 3.1 Tạo project
1. Vào <https://console.cloud.google.com> **bằng tài khoản công ty** (không dùng Gmail cá nhân).
2. Thanh trên cùng bấm ô chọn project → **New Project**. Tên: `mita-workspace`. **Organization / Location**: chọn tổ chức `mitaexport.com`. Bấm **Create**.
3. Đảm bảo ô chọn project đang hiển thị `mita-workspace`.

### 3.2 Màn hình đồng ý OAuth (loại Internal)
1. Menu ☰ → **APIs & Services → OAuth consent screen** (giao diện mới gọi là **Google Auth Platform**). Bấm **Get started**.
2. **App name:** `Mita Workspace`. **User support email:** email của bạn. **Next**.
3. **Audience:** chọn **Internal** ← quan trọng: chỉ người trong tổ chức Workspace đăng nhập được. **Next**.
4. **Contact information:** email của bạn → **Next** → tích đồng ý → **Create**.

### 3.3 Tạo OAuth Client
1. Trong Google Auth Platform chọn **Clients → + Create client** (giao diện cũ: **Credentials → Create credentials → OAuth client ID**).
2. **Application type:** `Web application`. **Name:** `Supabase`.
3. **Authorized JavaScript origins:** thêm `https://work.mitaexport.com` (và `http://localhost:5173` nếu chạy thử trên máy).
4. **Authorized redirect URIs:** thêm `https://<project-ref>.supabase.co/auth/v1/callback`
   (lấy chính xác tại Supabase → **Authentication → Sign In / Providers → Google → Callback URL**, xem `docs/setup-supabase.md`).
5. Bấm **Create**. Sao chép **Client ID** và **Client secret** → nhập vào Supabase (mục 3 của `setup-supabase.md`). Không gửi secret qua chat/email.

## 4. Service account + domain-wide delegation (cần từ M1: email, M3/M4: Drive)

1. **Bật API:** Menu ☰ → **APIs & Services → Library**. Tìm và bấm **Enable** cho: `Google Drive API`, `Gmail API`.
2. **Tạo service account:** Menu ☰ → **IAM & Admin → Service Accounts → + Create service account**. Tên `mita-system`. Bấm **Create and continue** → bỏ qua phần quyền → **Done**.
3. **Tạo key JSON:** bấm vào service account vừa tạo → tab **Keys → Add key → Create new key → JSON → Create**. File `.json` tải về máy – **giữ bí mật**, chỉ nhập vào Supabase secrets.
   - Nếu báo lỗi *"Service account key creation is disabled"* (org policy `iam.disableServiceAccountKeyCreation`, tổ chức mới thường bật sẵn):
     1. Cần quyền **Organization Policy Administrator** (Super Admin tự cấp ở **IAM & Admin → IAM**, chọn cấp tổ chức, thêm vai trò này cho mình).
     2. Menu ☰ → **IAM & Admin → Organization Policies**, đảm bảo đang chọn project `mita-workspace`.
     3. Tìm `Disable service account key creation` → **Manage policy** → **Override parent's policy** → **Add rule → Enforcement: Off** → **Set policy**.
     4. Quay lại bước 3.
4. Mở tab **Details** của service account, sao chép **Unique ID / OAuth 2 Client ID** (dãy số dài).
5. **Domain-wide delegation:** vào <https://admin.google.com> → **Bảo mật → Truy cập và kiểm soát dữ liệu → Kiểm soát API → Quản lý ủy quyền trên toàn miền** (Security → Access and data control → API controls → Manage Domain Wide Delegation) → **Thêm mới**:
   - **Client ID:** dãy số ở bước 4.
   - **OAuth scopes:** `https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/gmail.send`
   - Bấm **Ủy quyền**. Có thể mất vài phút đến vài giờ để có hiệu lực.

## 5. Google Chat webhook (tùy chọn)

Trong Google Chat mở space của team → tên space → **Ứng dụng và tích hợp → Webhook → Thêm webhook**. Sao chép URL, dán vào **Cài đặt → Thông số → `google_chat_webhook`** (dạng `"https://chat.googleapis.com/..."`, có dấu ngoặc kép).
