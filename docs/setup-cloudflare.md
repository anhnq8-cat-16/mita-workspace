# Deploy lên Cloudflare Pages (`work.mitaexport.com`)

## 1. Kết nối repo
1. Vào <https://dash.cloudflare.com> → đăng nhập/tạo tài khoản (miễn phí).
2. Menu trái **Workers & Pages → Create → tab Pages → Connect to Git**.
3. Chọn **GitHub**, cấp quyền cho repo `mita-workspace` → **Begin setup**.
4. Cấu hình build:
   | Mục | Giá trị |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `React (Vite)` (hoặc None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
5. Mở **Environment variables (advanced)** và thêm:
   | Tên | Giá trị |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `VITE_SUPABASE_URL` | Project URL của Supabase |
   | `VITE_SUPABASE_ANON_KEY` | khóa anon/publishable |
   | `VITE_GOOGLE_HD` | `mitaexport.com` |
6. Bấm **Save and Deploy**. Sau ~1–2 phút có địa chỉ tạm `https://mita-workspace.pages.dev`.

File `public/_redirects` đã cấu hình để mọi đường dẫn (ví dụ `/thu-vien`) trả về ứng dụng.

### Nếu Cloudflare tạo thành **Worker** thay vì Pages
Giao diện mới của Cloudflare hay mặc định tạo *Worker* (biểu tượng ◇, có chữ "Workers build minutes"). Vẫn dùng được – repo đã có sẵn `wrangler.jsonc` (đưa thư mục `dist` lên, mọi đường dẫn trả về ứng dụng):
1. Mở ứng dụng → **Settings → Build**:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Branch control → Production branch:** `main`
2. Cũng trong **Settings → Build**, mục **Variables and secrets** (biến *lúc build* – **không** phải mục Variables ở phần Runtime): thêm `NODE_VERSION`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_HD` như bảng trên.
3. **Deployments → Retry build** (hoặc đẩy commit mới). Địa chỉ tạm có dạng `https://mita-workspace.<tên-tài-khoản>.workers.dev`.
4. Gắn tên miền: **Settings → Domains & Routes → Add → Custom domain** → `work.mitaexport.com`.

## 2. Gắn tên miền `work.mitaexport.com`
1. Trong project Pages → tab **Custom domains → Set up a custom domain** → nhập `work.mitaexport.com` → **Continue**.
2. **Nếu domain đang quản lý DNS tại Cloudflare:** bấm **Activate domain**, xong.
3. **Nếu DNS ở nơi khác** (Mắt Bão, PA Việt Nam, GoDaddy…): Cloudflare hiển thị 1 bản ghi cần thêm. Đăng nhập trang quản lý domain → **Quản lý DNS** → thêm:
   | Loại | Tên (Host) | Giá trị |
   |---|---|---|
   | `CNAME` | `work` | `mita-workspace.pages.dev` |
   Lưu lại, quay về Cloudflare chờ trạng thái **Active** (vài phút đến vài giờ).
4. Nhớ thêm `https://work.mitaexport.com` vào Google OAuth Client (**Authorized JavaScript origins**) và `https://work.mitaexport.com/auth/callback` vào Supabase **Redirect URLs**.

## 3. Deploy lần sau
Mỗi lần merge vào `main`, Cloudflare tự build và deploy. Nhánh khác có bản xem trước (preview) riêng.
Đổi biến môi trường: **Settings → Variables and Secrets** → sửa → **Deployments → Retry deployment** của bản mới nhất.
