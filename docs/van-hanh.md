# Vận hành Mita Workspace

> Tài liệu được bổ sung theo từng milestone. Bản hiện tại: M0.

## Thêm người dùng mới
1. Đăng nhập bằng tài khoản admin → **Cài đặt → Người dùng → Mời người dùng**.
2. Nhập email công ty, họ tên, vai trò, chọn team (bấm ★ cạnh team để đặt làm trưởng nhóm) → **Mời người dùng**.
3. Báo người đó mở `https://work.[DOMAIN]` và bấm **Đăng nhập bằng Google** – tài khoản được kích hoạt ngay.

Nếu người đó đã đăng nhập trước khi được mời (đang thấy màn hình *"Tài khoản đang chờ quản trị kích hoạt"*): vào **Cài đặt → Người dùng → lọc "Chờ kích hoạt"**, chọn vai trò/team rồi bấm **Kích hoạt** (hoặc mời bằng email như trên – hệ thống kích hoạt luôn). Người đó bấm **Kiểm tra lại**.

## Khóa / mở khóa, đổi vai trò, đổi team
**Cài đặt → Người dùng** → mỗi người có ô chọn vai trò, các nút team (★ = trưởng nhóm) và nút **Khóa/Mở khóa**. Thay đổi có hiệu lực ngay (người dùng tải lại trang).
Không thể khóa hoặc hạ quyền quản trị viên cuối cùng.

## Đổi giờ hạn chót, ngày làm việc, trọng số…
**Cài đặt → Thông số**. Giá trị viết dạng JSON:
- Giờ: `"09:00"` (có ngoặc kép)
- Số: `3`
- Danh sách: `[1,2,3,4,5]` (thứ làm việc, 1 = thứ Hai)
- Bật/tắt: `true` / `false`

Mọi thay đổi được ghi vào nhật ký (audit_log).

## Xử lý sự cố thường gặp
| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Đăng nhập báo *"Chỉ tài khoản Google của công ty…"* | Email không thuộc domain, hoặc chưa khai báo `allowed_email_domains` (xem `docs/setup-supabase.md` mục 4). |
| Google báo *"Access blocked / org_internal"* | Đang dùng Gmail cá nhân – OAuth loại Internal chỉ cho tài khoản công ty. |
| Đăng nhập xong quay lại trang đăng nhập | Kiểm tra Supabase → Authentication → URL Configuration đã có `https://work.[DOMAIN]/auth/callback`. |
| *redirect_uri_mismatch* | Callback URL của Supabase chưa có trong **Authorized redirect URIs** của OAuth Client. |
| Màn hình trắng sau deploy | Thiếu biến `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` trên Cloudflare → thêm rồi Retry deployment. |
| Người dùng đúng quyền nhưng không thấy dữ liệu | Tài khoản chưa kích hoạt hoặc chưa có team. Kiểm tra ở Cài đặt → Người dùng. |
