# Vận hành Mita Workspace

> Tài liệu được bổ sung theo từng milestone. Bản hiện tại: M1.

## Thêm người dùng mới
1. Đăng nhập bằng tài khoản admin → **Cài đặt → Người dùng → Mời người dùng**.
2. Nhập email công ty, họ tên, vai trò, chọn team (bấm ★ cạnh team để đặt làm trưởng nhóm) → **Mời người dùng**.
3. Báo người đó mở `https://work.mitaexport.com` và bấm **Đăng nhập bằng Google** – tài khoản được kích hoạt ngay.

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

## Kỷ luật ngày (M1) – cách hoạt động
- **Kế hoạch ngày:** lead/staff mở app vào ngày làm việc mà chưa nộp kế hoạch sẽ thấy màn hình *Kế hoạch hôm nay* và không vào được màn khác (chỉ đăng xuất hoặc khai báo nghỉ). Nộp sau `plan_deadline` (09:00) bị ghi **Trễ** và trưởng nhóm nhận thông báo.
- Trước hạn chót được bỏ/sửa việc; sau hạn chót chỉ **thêm**, việc thêm bị gắn **Ngoài kế hoạch**.
- **Báo cáo cuối ngày:** mở từ `report_open_time` (16:00). Nộp trước `report_deadline` (17:30) là Đúng giờ, sau đó là Trễ; đến `report_missed_at` (23:59) chưa nộp → **Bỏ lỡ**. Đã nộp thì khóa, chỉ thêm *Bổ sung*.
- **Việc tồn:** việc *Một phần / Chưa làm* (hoặc cả kế hoạch nếu hôm đó bỏ lỡ báo cáo) tự hiện ở kế hoạch ngày làm việc tiếp theo; muốn bỏ phải ghi lý do.
- **Nghỉ:** nhân viên khai báo ở cổng kế hoạch hoặc **Báo cáo → Nghỉ phép**; khai báo xong là vào app được ngay. Trưởng nhóm/quản lý duyệt hoặc từ chối ở **Báo cáo → Team**. Chỉ ngày nghỉ **đã duyệt** mới không bị tính vào điểm tuân thủ (M5).
- **Xem & phản hồi:** trưởng nhóm/quản lý vào **Báo cáo → Team**, chọn ngày, bấm vào từng người → *Đã xem* + phản hồi (nhân viên nhận thông báo).

## Đổi giờ, ngày lễ, ngày làm bù
- Giờ hạn chót/nhắc: **Cài đặt → Thông số** (`plan_deadline`, `plan_reminder_time`, `report_open_time`, `report_reminder_time`, `report_deadline`, `report_missed_at`, `summary_evening_time`). Có hiệu lực ngay, không cần sửa gì khác.
- Thứ làm việc hằng tuần: `workdays` (mặc định `[1,2,3,4,5,6]` = thứ Hai → thứ Bảy).
- Ngày lễ: **Cài đặt → Lịch làm việc → Ngày lễ**.
- Chủ nhật có sự kiện: **Cài đặt → Lịch làm việc → Ngày làm bù**, chọn team tham gia (để trống = cả công ty). Người thuộc team đó phải nộp kế hoạch/báo cáo hôm ấy.
- Tắt toàn bộ email (vẫn giữ thông báo trong app): `email_enabled` = `false`.
- Google Chat: dán URL webhook vào `google_chat_webhook` (có ngoặc kép).

## Xử lý sự cố thường gặp
| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Đăng nhập báo *"Chỉ tài khoản Google của công ty…"* | Email không thuộc domain, hoặc chưa khai báo `allowed_email_domains` (xem `docs/setup-supabase.md` mục 4). |
| Google báo *"Access blocked / org_internal"* | Đang dùng Gmail cá nhân – OAuth loại Internal chỉ cho tài khoản công ty. |
| Đăng nhập xong quay lại trang đăng nhập | Kiểm tra Supabase → Authentication → URL Configuration đã có `https://work.mitaexport.com/auth/callback`. |
| *redirect_uri_mismatch* | Callback URL của Supabase chưa có trong **Authorized redirect URIs** của OAuth Client. |
| Màn hình trắng sau deploy | Thiếu biến `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` trên Cloudflare → thêm rồi Retry deployment. |
| Người dùng đúng quyền nhưng không thấy dữ liệu | Tài khoản chưa kích hoạt hoặc chưa có team. Kiểm tra ở Cài đặt → Người dùng. |
| Không có email nhắc việc | SQL Editor: `select status, last_error from outbox order by created_at desc limit 10;`. `pending` mãi → kiểm tra Vault (`project_url`, `cron_secret`) và function `notify` đã deploy. `failed` + lỗi `unauthorized_client` → domain-wide delegation chưa có hiệu lực/sai Client ID hoặc scope. |
| Nhắc sai giờ / không nhắc | `select * from cron.job;` phải có `mita-tick`. `select * from cron_runs order by ran_at desc;` xem job đã chạy và lỗi (cột `error`). Giờ trong Thông số là giờ Việt Nam. |
| Nhân viên bị chặn ở màn Kế hoạch dù đang nghỉ | Nhân viên bấm *Hôm nay tôi nghỉ / đi công tác* ngay trên màn hình đó. Nếu ngày nghỉ đã bị từ chối thì vẫn phải nộp kế hoạch. |
| Cần sửa báo cáo đã nộp | Không sửa được (chủ ý). Nhân viên thêm *Bổ sung* dưới báo cáo. |
