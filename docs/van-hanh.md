# Vận hành Mita Workspace

> Tài liệu được bổ sung theo từng milestone. Bản hiện tại: M3.

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

## Công việc & mục tiêu tuần (M2)
- **Bảng Kanban** (`/viec`): 5 cột Cần làm · Đang làm · Chờ duyệt · Hoàn thành · Bị chặn. Kéo thẻ để đổi trạng thái (trên điện thoại: giữ ngón tay ~0,3 giây rồi kéo). Thay đổi của người khác hiện ngay không cần tải lại.
- Chế độ xem: Bảng, Danh sách, Việc của tôi, Theo người (trưởng nhóm/quản lý), Lịch (theo hạn). Lọc theo team, người, mục tiêu, ưu tiên, quá hạn. Việc quá hạn có viền đỏ và số ngày trễ.
- **Duyệt việc:** khi `task_require_review` = `true`, nhân viên chỉ kéo được đến *Chờ duyệt*; trưởng nhóm/quản lý mở việc → *Duyệt → Hoàn thành* hoặc *Trả lại*. Tắt duyệt: đặt `false` trong Thông số.
- **Việc nhạy cảm** (ví dụ đánh giá hiệu suất cá nhân): trưởng nhóm/quản lý tích *Việc nhạy cảm* khi tạo/sửa. Chỉ người được giao, người giao, trưởng nhóm team và quản lý xem được; @nhắc tên người khác cũng không gửi thông báo cho họ.
- **Giao việc hàng loạt:** nút *Giao việc* → chọn team, chọn nhiều người, nhập nhiều dòng việc → tạo mỗi việc cho từng người.
- **Bình luận:** gõ `@` để chọn người cần nhắc; người đó nhận thông báo (chuông + email).
- Việc *Hoàn thành* chỉ hiện trên bảng 30 ngày; cũ hơn vẫn được lưu.
- **Mục tiêu tuần** (`/muc-tieu`): trưởng nhóm/quản lý tạo mục tiêu cho team hoặc 1 người, chọn cách tính thực tế: *Nhập tay*, *Số việc gắn mục tiêu đã xong*; *Doanh số đơn hàng* / *Số lead mới* có số liệu từ M3. Gắn việc vào mục tiêu trong chi tiết việc (ô *Mục tiêu tuần*).
- Sáng thứ Hai (`weekly_kickoff_time`, mặc định 08:00): hệ thống chốt mục tiêu tuần trước (Đạt/Trượt) và nhắc trưởng nhóm Sale/Marketing chưa lập mục tiêu tuần mới.

## Sales (M3)
- **Chủ dữ liệu Sales:** admin vào **Cài đặt → Người dùng → Chủ dữ liệu Sales**, chọn Trang. Người này nhận thông báo lead mới chờ phân công và lead quá SLA. Để trống thì mọi trưởng nhóm Sale cùng nhận.
- **Quyền:** Sale thấy/sửa lead được giao hoặc do mình tạo, khách và đơn của mình (tên khách của người khác vẫn hiện khi kiểm tra trùng). Trưởng nhóm Sale sửa tất cả, phân công, gộp trùng. Quản lý chỉ xem. Marketing tạo lead và chỉ thấy trạng thái lead mình gửi; khi lead đã giao cho Sale thì SĐT/email bị ẩn với Marketing.
- **Tạo lead:** hệ thống kiểm tra trùng theo SĐT (bỏ khoảng trắng, +84 = 0), email, tên công ty trên toàn bộ lead + khách và cảnh báo trước khi lưu. Hạn liên hệ lần đầu = lúc tạo + `lead_sla_hours` (24h).
- **Hàng chờ:** lead do Marketing tạo (hoặc Sale bỏ tích *Giao cho tôi*) vào tab *Hàng chờ* của trưởng nhóm Sale để phân công.
- **Hoạt động:** ghi Gọi/Zalo/Gặp/Gửi mẫu/Báo giá… Hoạt động đầu tiên đánh dấu *đã liên hệ*; Gửi mẫu/Báo giá tự chuyển giai đoạn tương ứng.
- **Chốt đơn:** nút *Chốt đơn* tạo (hoặc gắn) khách hàng + 1 đơn nháp. *Mất lead* bắt buộc ghi lý do.
- **Nhắc tự động:** mỗi giờ 8h–18h (`lead_sla_check_hours`) báo lead quá SLA (mỗi lead 1 lần); 08:00 (`followup_time`) nhắc lead có hẹn follow-up hôm nay.
- **Đơn hàng:** tab *Đơn hàng* – doanh số tháng (đơn *Đã xác nhận* + *Đã giao*) so với `kpi_monthly_revenue_vnd`. Số Sale tự báo, số kế toán là nguồn chuẩn.
- **Check-in:** `/check-in` → nút lớn *Check-in* → lấy GPS → chụp ảnh (bắt buộc, tự nén ≤1600px) → chọn khách/lead hoặc *Điểm mới* (tạo lead nhanh) → *Lưu*. Ảnh vào Drive `MITA Sales Private/CheckIns/<năm-tháng>`. Check-in tại khách chưa có vị trí sẽ lưu vị trí cho khách (hiện trên bản đồ khách hàng).
- **Quản lý xem check-in:** `/check-in` → tab *Team*: chọn ngày/người → bản đồ + dòng thời gian, so với *Lịch trình dự kiến* trong kế hoạch sáng.
- **Báo cáo cuối ngày của Sale** tự điền: số điểm đã gặp (check-in), lead mới, lead đã liên hệ, báo giá đã gửi, đơn chốt, doanh số – vẫn sửa được trước khi nộp.

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
| Check-in báo "Chưa cấu hình thư mục CheckIns" | Nhập `drive.folders` = `{"checkins": "<ID thư mục>"}` (xem `docs/setup-google.md` mục 2). |
| Check-in báo lỗi Drive 403/404 | `sale05@mitaexport.com` chưa là *Người quản lý nội dung* của `MITA Sales Private`, hoặc chưa ủy quyền scope `drive` (domain-wide delegation). |
| Không lấy được GPS | Điện thoại bật Vị trí; trình duyệt cho phép truy cập vị trí cho `work.mitaexport.com` (Safari: Cài đặt → Quyền riêng tư → Dịch vụ định vị → Safari). |
| Cần sửa báo cáo đã nộp | Không sửa được (chủ ý). Nhân viên thêm *Bổ sung* dưới báo cáo. |
