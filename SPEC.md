# MITA WORKSPACE — Đặc tả sản phẩm & kỹ thuật (v1.0 – bản đầy đủ)

> Đặt file này ở thư mục gốc repo với tên `SPEC.md`, rồi dán **Prompt khởi động (mục 0)** vào Claude Code.
> Các chỗ `[...]` là thông tin Quý Anh cần điền trước hoặc trong lúc build.

---

## 0. Prompt khởi động (dán vào Claude Code)

```
Bạn là senior full-stack engineer. Nhiệm vụ: build ứng dụng web nội bộ "Mita Workspace" theo đúng SPEC.md ở gốc repo.

Quy tắc làm việc:
1. Đọc toàn bộ SPEC.md trước khi viết code. Nếu có điểm mâu thuẫn hoặc thiếu, liệt kê câu hỏi trước, không tự đoán.
2. Build đúng thứ tự Milestone ở mục 12. Hết mỗi milestone: dừng lại, tóm tắt đã làm gì, hướng dẫn tôi test từng tiêu chí nghiệm thu, chờ tôi xác nhận rồi mới sang milestone tiếp.
3. Mọi thay đổi database bằng migration SQL trong supabase/migrations. Mọi bảng bật RLS và có policy theo mục 6. Viết test RLS cho từng vai trò.
4. Không hardcode secret. Dùng biến môi trường, liệt kê đầy đủ trong .env.example.
5. Giao diện 100% tiếng Việt, múi giờ Asia/Ho_Chi_Minh, tiền VNĐ dạng 1.250.000đ, ngày dd/MM/yyyy.
6. Mobile-first: nhân viên Sale dùng chủ yếu trên điện thoại.
7. Mọi con số nghiệp vụ (giờ hạn chót, ngưỡng, trọng số) đọc từ bảng settings, không hardcode.
8. Những bước cần làm thủ công trên Google Admin / Google Cloud / Supabase / Cloudflare: viết hướng dẫn từng bước cho người không chuyên, kèm chỗ bấm cụ thể.
9. Viết README: cài đặt local, deploy, vận hành, xử lý sự cố thường gặp.

Bắt đầu bằng: (a) tóm tắt hiểu biết của bạn về hệ thống trong 10 dòng, (b) danh sách câu hỏi nếu có, (c) kế hoạch chi tiết Milestone 0.
```

---

## 1. Bối cảnh & mục tiêu

**Công ty:** CTCP XNK MITAFOOD (VP Lĩnh Nam, Hà Nội). Xuất khẩu nông sản & cà phê; nội địa bán cà phê đóng gói thương hiệu DALAC, phụ kiện, bộ quà tặng, hoa quả.

**Người dùng:** Team Nội địa (Sale) + Team Marketing, ~6–10 người, còn non. Quản lý (Quý Anh) làm hybrid, không có mặt hằng ngày. Công ty đã có **Google Workspace**.

**Vấn đề cần giải:**
- Việc triển khai manh mún, không có luồng làm việc, không có kho tư liệu chung.
- Tư liệu phân mảnh nhiều file, khó tìm sản phẩm – giá – tài liệu bán hàng.
- Không có công cụ giao việc, theo dõi tiến độ, báo cáo cuối ngày.
- Quản lý không nắm tiến độ từ xa.

**Mục tiêu v1:** một ứng dụng web nội bộ gồm:
1. Kế hoạch ngày bắt buộc + báo cáo cuối ngày (thực thi kỷ luật).
2. Giao việc, Kanban, mục tiêu tuần.
3. Lead / khách hàng / đơn hàng cho Sale + check-in thị trường.
4. Thư viện tư liệu trên Google Shared Drive (upload, duyệt, tải xuống).
5. Sản phẩm & bảng giá chuẩn (một nguồn sự thật).
6. Dashboard quản lý + điểm tuân thủ + leo thang.

**Nguyên tắc thiết kế:**
- Kỷ luật được thực thi bằng luồng sản phẩm (không có đường tránh), nhưng **không chặn người dùng làm việc**.
- Báo cáo cuối ngày điền ≤ 3 phút, kế hoạch ngày ≤ 2 phút.
- Một cổng duy nhất; thư viện có link riêng để chia sẻ (`/thu-vien`).
- Quản lý nhìn 1 màn hình là biết hôm nay ai đang ở đâu, làm gì, trễ gì.

---

## 2. Người dùng, vai trò, team

### 2.1 Vai trò (enum `role`)

| Vai trò | Mô tả | Ví dụ |
|---|---|---|
| `admin` | Toàn quyền, cài đặt hệ thống, quản lý người dùng | Quý Anh |
| `manager` | Xem toàn bộ, duyệt, giao việc, xem dashboard | TP Kinh doanh |
| `lead` | Trưởng nhóm: duyệt kế hoạch/báo cáo của team mình, giao việc trong team | Trang, Mai |
| `staff` | Nhân viên triển khai | Kiên, Long, Quý |

### 2.2 Team (nhiều-nhiều, 1 người có thể thuộc nhiều team)

`sales_domestic` (Sale nội địa), `marketing`, `export` (chỉ dùng thư viện + sản phẩm ở v1).

### 2.3 Chủ sở hữu dữ liệu
- **Chủ hệ thống:** Quý Anh (admin).
- **Chủ dữ liệu Sales:** Trang. Có quyền sửa/gộp/chuyển giao mọi lead, khách hàng, đơn; dọn trùng lặp.

### 2.4 Danh sách khởi tạo (seed — xác nhận trước khi chạy)

| Họ tên | Email | Vai trò | Team | Ghi chú |
|---|---|---|---|---|
| Nguyễn Quý Anh | [EMAIL] | admin | sales_domestic, marketing | Chủ hệ thống |
| [Tên chị Hà] | [EMAIL] | manager | tất cả | TP Kinh doanh |
| Trang | [EMAIL] | lead | sales_domestic, marketing, export | Chủ dữ liệu Sales |
| Mai | [EMAIL] | lead | sales_domestic | [XÁC NHẬN còn trong team] |
| Kiên | [EMAIL] | staff | marketing, sales_domestic | |
| Long | [EMAIL] | staff | sales_domestic | |
| Quý | [EMAIL] | staff | sales_domestic | |
| Huệ | [EMAIL] | staff | export | |

---

## 3. Tech stack

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS, shadcn/ui | Nhanh, phổ biến, dễ bảo trì |
| State/data | TanStack Query, Supabase JS client | Cache, realtime |
| Kanban | dnd-kit | Kéo-thả mượt trên cả mobile |
| Bản đồ | Leaflet + OpenStreetMap tiles | Miễn phí |
| Form | react-hook-form + zod | Validate chặt |
| PWA | vite-plugin-pwa | Cài lên màn hình điện thoại |
| Backend | Supabase: Postgres, Auth (Google), RLS, Realtime, Edge Functions (Deno), pg_cron + pg_net | Không phải quản lý server |
| File | Google Shared Drive qua Drive API (domain-wide delegation) | File thuộc công ty, dùng dung lượng Workspace |
| Email | Gmail API (domain-wide delegation) gửi từ tài khoản hệ thống | Gửi trong domain, không cần dịch vụ ngoài |
| Hosting | Cloudflare Pages, domain `work.[DOMAIN]` | Miễn phí, cho phép dùng thương mại |
| CI | GitHub (repo private) + GitHub Actions | Build, test, backup DB hằng đêm |

Supabase region: Singapore.

---

## 4. Kiến trúc & tích hợp Google Workspace

```
[Trình duyệt / PWA]
   │  đăng nhập Google (chỉ tài khoản @[DOMAIN])
   ▼
[Cloudflare Pages: React app] ──► [Supabase: Auth + Postgres (RLS) + Realtime]
                                        │
                                        ├─ Edge Functions (Deno) ──► Google Drive API (Shared Drives)
                                        │                         └► Gmail API (gửi nhắc việc)
                                        └─ pg_cron ──► gọi Edge Functions theo lịch
```

### 4.1 Đăng nhập
- Supabase Auth, provider Google. OAuth consent screen loại **Internal** (chỉ người trong tổ chức Workspace đăng nhập được).
- Truyền thêm `hd=[DOMAIN]` khi gọi OAuth.
- Trigger `on auth.users insert`: nếu email không thuộc `[DOMAIN]` thì từ chối. Nếu email không có trong `profiles` được mời trước thì tạo profile `is_active = false` và hiện màn hình "Tài khoản đang chờ quản trị kích hoạt".
- Mọi RLS policy yêu cầu `is_active = true`.

### 4.2 Google Drive
- Dùng **service account + domain-wide delegation**, impersonate tài khoản hệ thống `[SYSTEM_USER]@[DOMAIN]` (là Content manager của các Shared Drive bên dưới). Scope: `https://www.googleapis.com/auth/drive`.
- 3 Shared Drive:

| Shared Drive | Thành viên (Google Group) | Nội dung |
|---|---|---|
| `MITA Library` | all@ = Viewer; mkt@ + managers@ = Content manager; SYSTEM_USER = Content manager | Tư liệu chung |
| `MITA Sales Private` | sales@ + managers@; SYSTEM_USER = Content manager | Tài liệu bán hàng nội bộ, ảnh check-in |
| `MITA Backup` | managers@; SYSTEM_USER = Content manager | Backup DB hằng đêm |

- Cấu trúc thư mục `MITA Library`:
  - `00_Cho-duyet`
  - `01_San-pham/<Dòng SP>/{Anh, Video, Mo-ta}`
  - `02_Ban-hang` (catalogue, profile, bảng giá PDF)
  - `03_Thuong-hieu` (logo, font, template)
  - `04_Su-kien/<YYYY-MM Tên sự kiện>`
- Cấu trúc `MITA Sales Private`: `CheckIns/<YYYY-MM>`, `Bao-gia`, `Hop-dong`.
- ID các folder lưu trong bảng `settings` (key `drive.folders`), không hardcode.

**Luồng upload (file lớn, resumable):**
1. Client gọi Edge Function `drive-upload-init` với `{filename, mimeType, size, category, productId?, tags[]}`.
2. Function kiểm tra quyền, lấy access token của service account, gọi
   `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true`
   với metadata `{name, parents:[<folder 00_Cho-duyet>]}` và header `Origin: <app origin>`. Trả về session URI.
3. Client `PUT` file theo chunk thẳng lên session URI (có thanh tiến độ, cho phép hủy).
4. Client gọi `drive-upload-complete` với `fileId`. Tạo `library_items` trạng thái `pending`.
5. Người duyệt bấm Duyệt thì Function `drive-move` chuyển file vào thư mục đích (`addParents`/`removeParents`, `supportsAllDrives=true`).

**Xem / tải:**
- Mở `webViewLink`. Quyền do thành viên Shared Drive quyết định.
- Thumbnail qua Edge Function `drive-thumb` (proxy `thumbnailLink`, cache 24h).

**Video:**
- Loại item `youtube`: chỉ lưu link YouTube (chế độ không công khai).
- File video gốc chỉ upload khi thật cần.

### 4.3 Email & thông báo
- Edge Function `notify` gửi email qua Gmail API (impersonate `[SYSTEM_USER]`, scope `https://www.googleapis.com/auth/gmail.send`). Tiêu đề có tiền tố `[Mita Workspace]`.
- Đồng thời ghi vào bảng `notifications` (chuông trong app).
- Tùy chọn: webhook Google Chat vào 1 space team cho bản tóm tắt 9h15 và 18h (URL lưu trong settings; để trống thì bỏ qua).

### 4.4 Lịch tự động
Dùng `pg_cron` + `pg_net` gọi Edge Function `cron-runner?job=<tên>`. Mọi giờ tính theo Asia/Ho_Chi_Minh; bỏ qua ngày nghỉ (`holidays`) và ngày không làm việc (`settings.workdays`).

### 4.5 Backup
GitHub Action chạy 01:00 mỗi đêm: `pg_dump` → nén → upload vào `MITA Backup/db/<YYYY-MM-DD>.sql.gz`. Giữ 30 bản gần nhất.

---

## 5. Mô hình dữ liệu (Postgres)

Mọi bảng có `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` (trigger) trừ khi ghi khác.

```
profiles(id = auth.users.id, email unique, full_name, phone, avatar_url,
         role role_enum, is_active bool default false, title)

teams(id text pk, name)                        -- sales_domestic | marketing | export
user_teams(user_id, team_id, is_lead bool, pk(user_id, team_id))

settings(key text pk, value jsonb, updated_by, updated_at)
holidays(date pk, name)
leaves(id, user_id, date, type enum(nghi_phep, cong_tac, om, khac), note,
       approved_by, approved_at)               -- ngày nghỉ: bỏ qua cổng kế hoạch & không tính tuân thủ

weekly_goals(id, week_start date, team_id, owner_id null, title, metric, target numeric,
             unit, actual numeric null, actual_source enum(manual, auto_orders, auto_leads, auto_tasks),
             status enum(open, achieved, missed), created_by)

tasks(id, title, description, team_id, assignee_id, created_by, weekly_goal_id null,
      status enum(todo, doing, review, done, blocked), priority enum(low, normal, high, urgent),
      start_date null, due_date null, estimate_minutes null, position numeric,
      is_off_plan bool default false, carried_over_count int default 0,
      completed_at null, approved_by null, blocked_reason null)
task_checklist_items(id, task_id, text, done bool, position)
task_comments(id, task_id, author_id, body)
task_links(id, task_id, library_item_id null, url null, label)
task_status_history(id, task_id, from_status, to_status, changed_by, changed_at)

daily_plans(id, user_id, plan_date date, submitted_at, is_late bool,
            route_plan text null,              -- Sale: lịch trình dự kiến
            note null, reviewed_by null, reviewed_at null, review_comment null,
            unique(user_id, plan_date))
daily_plan_items(id, plan_id, task_id null, title, kind enum(task, visit, meeting, content, other),
                 estimate_minutes null, is_carried_over bool default false,
                 removed_reason null, position)

daily_reports(id, user_id, report_date date, submitted_at null,
              status enum(on_time, late, missed), metrics jsonb,
              blockers text null, need_decision text null, tomorrow_note text null,
              reviewed_by null, reviewed_at null, review_comment null,
              unique(user_id, report_date))
daily_report_items(id, report_id, plan_item_id null, task_id null,
                   result enum(done, partial, not_done), reason text null)
report_amendments(id, report_id, author_id, body)          -- chỉ thêm, không sửa/xóa

leads(id, name, company null, contact_name null, phone null, email null, zalo null,
      address null, district null, source text, segment text, product_interest text[],
      stage enum(new, contacted, consulting, sample_sent, quoted, won, lost),
      lost_reason null, assigned_to null, created_by,
      first_contact_due_at, first_contacted_at null, next_follow_up_at null,
      est_value_vnd numeric null, notes null, customer_id null)
lead_activities(id, lead_id, user_id, type enum(call, zalo, meeting, visit, email, sample, quote, note),
                content, happened_at)

customers(id, name, type enum(cafe, agent, retail_store, corporate_gift, individual, fruit_b2b, other),
          contact_name, phone, email, address, district, lat null, lng null,
          owner_id, status enum(active, inactive), notes)

orders(id, customer_id, sales_id, order_date, total_value_vnd numeric, items_summary text,
       status enum(draft, confirmed, delivered, cancelled), note)
       -- số Sale tự báo để theo dõi KPI; số kế toán là nguồn chuẩn

check_ins(id, user_id, customer_id null, lead_id null, checked_in_at, lat, lng, accuracy_m,
          photo_drive_file_id null, note, checked_out_at null)

products(id, sku unique, name, line, category enum(coffee, accessory, gift_set, fruit),
         origin null, flavor_notes null, pack_size_g int null,
         retail_price_vnd numeric null, wholesale_price_vnd numeric null,
         is_active bool default true, description null, updated_by)
product_price_history(id, product_id, old_retail, new_retail, old_wholesale, new_wholesale,
                      changed_by, changed_at)

library_items(id, title, description null, kind enum(image, video, document, design, youtube),
              drive_file_id null, youtube_url null, mime_type null, size_bytes null,
              shared_drive enum(library, sales_private), folder_path text,
              product_id null, tags text[], channels text[],
              status enum(pending, approved, rejected), reject_reason null,
              uploaded_by, approved_by null, approved_at null)

escalations(id, user_id, period_month date, level int, reason, created_at,
            resolved_by null, resolved_at null, resolved_note null)
notifications(id, user_id, type, title, body, link, read_at null)
audit_log(id, table_name, row_id, action enum(insert, update, delete), actor_id, diff jsonb, at)
```

**View / hàm:**
- `v_compliance_daily(user_id, date, plan_status, report_status, tasks_due, tasks_done_on_time, off_plan_count)`
- `fn_compliance_score(user_id, from, to)` trả về điểm 0–100 và các thành phần.
- `fn_is_workday(date)`, `fn_today_vn()`.

**Trigger:** `audit_log` cho tasks, daily_plans, daily_reports, leads, customers, orders, products, library_items, profiles, settings. Ghi `task_status_history` và `product_price_history` tự động.

---

## 6. Phân quyền (RLS)

Ký hiệu: R = đọc, W = tạo/sửa, D = xóa, — = không. "Team" = cùng team với người đó.

| Bảng | staff | lead | manager | admin |
|---|---|---|---|---|
| profiles | R tất cả (tên, team); W của mình (phone, avatar) | như staff | R | RWD |
| settings, holidays | R | R | R | RW |
| leaves | RW của mình | R team; duyệt team | R, duyệt | RWD |
| weekly_goals | R team mình | RW team mình | RW | RWD |
| tasks | R: được giao + do mình tạo + task team (không nhạy cảm); W: task của mình (đổi trạng thái, checklist, comment); tạo task cho chính mình | RW team; giao việc trong team | RW tất cả | RWD |
| daily_plans / items | RW của mình (sửa được đến hạn chót; sau hạn chỉ thêm item) | R team, review | R tất cả, review | R tất cả |
| daily_reports / items | W của mình trước khi nộp; sau khi nộp chỉ thêm amendment | R team, review | R tất cả, review | R tất cả |
| leads, lead_activities | Sale: RW lead được giao hoặc do mình tạo. MKT: tạo lead; chỉ R stage của lead mình tạo (ẩn SĐT/email sau khi đã giao) | Lead Sales: RW tất cả lead | R tất cả | RWD |
| customers, orders | Sale: RW khách của mình, R tên các khách khác (tránh trùng) | RW tất cả (Trang = chủ dữ liệu) | R | RWD |
| check_ins | W của mình, R của mình | R team | R | R |
| products | R | R | RW giá | RWD |
| library_items | R approved theo `shared_drive` và team; W tạo (pending) | Duyệt team mình | Duyệt | RWD |
| escalations | R của mình | R team, resolve | R, resolve | RWD |
| audit_log | — | — | R | R |

Không ai được xóa `daily_reports`, `report_amendments`, `audit_log` (kể cả admin: chỉ qua SQL trực tiếp).

---

## 7. Module & màn hình

### 7.1 Điều hướng
Route:
- `/` Hôm nay
- `/viec` Công việc
- `/muc-tieu` Mục tiêu tuần
- `/khach` Lead & khách
- `/check-in`
- `/thu-vien` (link chia sẻ riêng được)
- `/san-pham`
- `/bao-cao`
- `/quan-ly` (dashboard, chỉ lead/manager/admin)
- `/cai-dat` (admin)

Mobile: thanh tab dưới cùng, hiển thị theo vai trò/team (Sale thấy Khách + Check-in; MKT thấy Việc + Thư viện).

### 7.2 Cổng kế hoạch ngày (Daily Gate) — tính năng cốt lõi
- Áp dụng cho vai trò trong `settings.plan_required_roles` (mặc định: `lead`, `staff`) vào ngày làm việc, trừ khi có `leaves` đã duyệt.
- Mở app lần đầu trong ngày mà chưa có `daily_plans` của hôm nay thì hiện **màn hình toàn trang "Kế hoạch hôm nay"**. Không truy cập được màn hình khác (chỉ đăng xuất hoặc khai báo nghỉ).
- Form gồm:
  - Danh sách item. Tự điền sẵn: (a) việc chuyển từ hôm qua (`is_carried_over`, không xóa được nếu không ghi lý do), (b) task đến hạn hôm nay hoặc quá hạn, (c) task đang `doing`.
  - Người dùng thêm item mới: chọn task có sẵn hoặc gõ nhanh (tạo task mới).
  - Sale: ô "Lịch trình dự kiến" (khu vực, khách/điểm dự kiến ghé).
  - Tối thiểu `settings.plan_min_items` item (mặc định 3).
- Nộp trước `settings.plan_deadline` (mặc định 09:00) thì `is_late = false`. Nộp sau vẫn được nhưng `is_late = true`, gắn nhãn **Trễ** và thông báo cho lead team.
- Sau khi nộp: sửa được đến hạn chót. Sau hạn chót chỉ **thêm** item; item thêm sau hạn chót và task mới bắt đầu trong ngày mà không có trong kế hoạch thì đánh dấu `is_off_plan = true`.
- Lead/manager xem, bấm "Đã xem" và bình luận.

### 7.3 Báo cáo cuối ngày
- Mở nhận báo cáo từ `settings.report_open_time` (mặc định 16:00).
- Form tự sinh từ kế hoạch sáng: mỗi item chọn Hoàn thành / Một phần / Chưa làm (+ lý do bắt buộc nếu không Hoàn thành).
- Chỉ số theo team (template lấy từ `settings.report_templates`):
  - **Sale:** số điểm/khách đã gặp, lead mới, lead đã liên hệ, báo giá đã gửi, đơn chốt, doanh số (VNĐ). Tự điền sẵn từ dữ liệu trong ngày (check-in, lead, order) và cho sửa.
  - **Marketing:** nội dung hoàn thành, bài đã đăng (kèm link), lead thu về, việc đang chờ duyệt.
- 3 ô text ngắn: Vướng mắc · Cần quản lý quyết định gì · Ghi chú cho ngày mai.
- Nộp trước `settings.report_deadline` (mặc định 17:30) là `on_time`; sau đó là `late`; đến `settings.report_missed_at` (mặc định 23:59) chưa nộp thì cron gán `missed`.
- Đã nộp thì **khóa**. Chỉ thêm "Bổ sung" (`report_amendments`).
- Item Một phần / Chưa làm tự chuyển sang kế hoạch ngày làm việc tiếp theo (`is_carried_over`), tăng `tasks.carried_over_count`.
- Lead/manager: nút "Đã xem" + phản hồi. Nhân viên nhận thông báo khi có phản hồi.

### 7.4 Công việc (Kanban)
- Cột: Cần làm · Đang làm · Chờ duyệt · Hoàn thành · Bị chặn (cần lý do).
- Chế độ xem: Bảng (kéo-thả) · Danh sách · Việc của tôi · Theo người (lead/manager) · Lịch (theo due_date).
- Lọc: team, người, mục tiêu tuần, ưu tiên, quá hạn.
- Task: tiêu đề, mô tả (markdown), người thực hiện, hạn, ưu tiên, ước lượng thời gian, mục tiêu tuần liên kết, checklist, bình luận (@nhắc tên thì gửi thông báo), link tư liệu thư viện, lịch sử trạng thái.
- Chuyển sang Hoàn thành: nếu `settings.task_require_review` = true thì staff chỉ đẩy đến "Chờ duyệt"; lead/manager duyệt sang Hoàn thành.
- Quá hạn: viền đỏ, hiện số ngày trễ.
- Realtime: bảng cập nhật tức thì khi người khác thay đổi.
- Giao việc hàng loạt: lead/manager tạo nhiều task cho nhiều người trong một form.

### 7.5 Mục tiêu tuần
- Manager/lead tạo mục tiêu cho team hoặc cá nhân: chỉ số, mục tiêu, đơn vị, cách tính thực tế (thủ công / tự động từ orders, leads, tasks).
- Thanh tiến độ, danh sách task liên kết.
- Thứ Hai: nhắc lead tạo mục tiêu tuần nếu chưa có.

### 7.6 Lead & khách hàng
- Pipeline dạng bảng kéo-thả theo `stage` + dạng danh sách có lọc.
- Nguồn lead (`settings.lead_sources`, mặc định): Hội chợ, Website DALAC, Fanpage, TikTok, Giới thiệu, Sale tự tìm, Khác.
- Phân khúc (`settings.lead_segments`, mặc định): Quán cà phê, Đại lý, Cửa hàng bán lẻ, Quà tặng doanh nghiệp, Khách du lịch, Cá nhân, B2B hoa quả, Khác.
- Tạo lead:
  - Kiểm tra trùng theo SĐT/email/tên công ty, cảnh báo trước khi lưu.
  - `first_contact_due_at = created_at + settings.lead_sla_hours` (mặc định 24h).
- Lead chưa phân công: vào hàng chờ của lead Sales (Trang) để phân bổ.
- Hoạt động: ghi nhanh cuộc gọi / Zalo / gặp / gửi mẫu / báo giá. Hoạt động đầu tiên cập nhật `first_contacted_at`.
- Chuyển `won`: tạo/gắn `customers` + tạo `orders` nháp.
- Chuyển `lost`: bắt buộc lý do.
- Nhắc follow-up theo `next_follow_up_at`.
- Khách hàng: hồ sơ, lịch sử đơn, check-in, hoạt động; bản đồ khách (có lat/lng).
- Đơn hàng: danh sách, tổng doanh số tháng so với KPI (`settings.kpi_monthly_revenue_vnd`, mặc định 150.000.000).

### 7.7 Check-in thị trường (Sale, mobile)
- Nút lớn "Check-in": lấy GPS (Geolocation API, lưu độ chính xác), chụp ảnh bắt buộc (`<input capture>`), chọn khách/lead hoặc "Điểm mới" (tạo lead nhanh), ghi chú.
- Ảnh nén phía client (tối đa 1600px, JPEG ~80%) rồi upload vào `MITA Sales Private/CheckIns/<YYYY-MM>`.
- Check-out tùy chọn.
- Manager xem bản đồ + dòng thời gian check-in theo người/ngày, so với "lịch trình dự kiến" trong kế hoạch sáng.

### 7.8 Thư viện (`/thu-vien`)
- Duyệt theo: Sản phẩm · Loại (ảnh/video/tài liệu/thiết kế) · Kênh (Website, Fanpage, TikTok, Hội chợ, Bán hàng) · Tag. Tìm kiếm theo tiêu đề/tag.
- Lưới thumbnail; xem trước ảnh; nút "Mở trên Drive" và "Tải xuống".
- Upload (mọi người dùng): kéo-thả nhiều file, bắt buộc chọn sản phẩm/loại/kênh, tag tùy chọn. File vào `00_Cho-duyet`, trạng thái `pending`.
- Duyệt (mặc định: lead marketing, manager, admin): Duyệt (chọn thư mục đích, có gợi ý theo sản phẩm/loại) hoặc Từ chối (lý do).
- Thêm video bằng link YouTube.
- Item có `shared_drive = sales_private` chỉ hiện với team Sale + manager/admin.
- `/thu-vien` hoạt động như trang độc lập (layout gọn, không có menu công việc) để gửi link riêng; vẫn yêu cầu đăng nhập.

### 7.9 Sản phẩm & bảng giá
- Danh sách sản phẩm theo nhóm: Cà phê (dòng × quy cách), Phụ kiện, Bộ quà tặng, Hoa quả.
- Mỗi sản phẩm: thông tin, hương vị, vùng trồng, giá lẻ, giá buôn (để trống nếu chưa có), ảnh/tài liệu liên kết từ thư viện.
- Chỉ manager/admin sửa giá; mọi thay đổi ghi `product_price_history`, hiện "Cập nhật lần cuối: ngày – người".
- Nút "Xuất bảng giá PDF" (bản in đơn giản, có ngày hiệu lực).
- Seed dữ liệu theo mục 15.

### 7.10 Dashboard quản lý (`/quan-ly`)
Mặc định là hôm nay, có chọn ngày/tuần/tháng. Khối:
1. **Hôm nay:** bảng từng người: kế hoạch (Đúng giờ/Trễ/Chưa nộp/Nghỉ), báo cáo, số task đến hạn, quá hạn, check-in gần nhất. Bấm vào người để xem chi tiết.
2. **Chờ tôi xử lý:** kế hoạch/báo cáo chưa xem, task Chờ duyệt, file thư viện chờ duyệt, mục "Cần quản lý quyết định", leo thang chưa xử lý.
3. **Tuân thủ tuần:** điểm theo người (xanh ≥ 90, vàng 70–89, đỏ < 70) + xu hướng 4 tuần.
4. **Sales:** lead mới, % lead liên hệ đúng SLA, pipeline theo stage, doanh số tháng so với KPI, top lý do mất lead.
5. **Mục tiêu tuần:** tiến độ từng mục tiêu.
6. **Bản đồ check-in hôm nay.**

Xuất CSV cho mọi bảng.

### 7.11 Cài đặt (admin)
- Người dùng: mời (nhập email), kích hoạt/khóa, đổi vai trò/team.
- Giờ làm & hạn chót, ngày làm việc, ngày lễ.
- Template báo cáo theo team.
- Nguồn lead/phân khúc.
- Trọng số điểm tuân thủ, ngưỡng leo thang.
- ID thư mục Drive, webhook Google Chat.
- Bật/tắt: duyệt task, chuyển việc tồn.

---

## 8. Quy tắc kỷ luật & giá trị mặc định (bảng `settings`)

| Key | Mặc định | Ý nghĩa |
|---|---|---|
| `workdays` | `[1,2,3,4,5,6]` [XÁC NHẬN có làm thứ 7 không] | Thứ làm việc (1 = thứ Hai) |
| `plan_required_roles` | `["lead","staff"]` | Ai phải qua cổng kế hoạch |
| `plan_deadline` | `09:00` | Hạn nộp kế hoạch |
| `plan_min_items` | `3` | Số item tối thiểu |
| `plan_reminder_time` | `08:30` | Nhắc nộp kế hoạch |
| `report_open_time` | `16:00` | Mở nhận báo cáo |
| `report_reminder_time` | `17:00` | Nhắc báo cáo |
| `report_deadline` | `17:30` | Hạn báo cáo đúng giờ |
| `report_missed_at` | `23:59` | Quá giờ này chưa nộp thì Bỏ lỡ |
| `carry_over_enabled` | `true` | Tự chuyển việc tồn sang ngày tiếp theo |
| `task_require_review` | `true` | Task phải qua Chờ duyệt |
| `lead_sla_hours` | `24` | Hạn liên hệ lần đầu với lead mới |
| `kpi_monthly_revenue_vnd` | `150000000` | KPI doanh số tháng Team Nội địa |
| `compliance_weights` | `{plan:30, report:30, tasks:30, off_plan:10}` | Trọng số điểm tuân thủ |
| `escalation_thresholds` | `{level1:3, level2:5}` | Số lần trễ/bỏ lỡ trong tháng |

**Điểm tuân thủ (theo khoảng thời gian, 0–100):**
```
plan     = % ngày làm việc nộp kế hoạch đúng giờ
report   = % ngày làm việc nộp báo cáo đúng giờ (missed = 0, late = 50%)
tasks    = % task đến hạn trong kỳ hoàn thành đúng hạn
off_plan = 100 − min(100, tỉ lệ item ngoài kế hoạch × 200)
score    = Σ(thành phần × trọng số) / Σ trọng số
```
Ngày nghỉ đã duyệt và ngày lễ không tính.

**Leo thang (cron cuối ngày):** đếm số lần (kế hoạch trễ + báo cáo trễ + báo cáo bỏ lỡ) trong tháng.
- Đạt `level1`: tạo `escalations` level 1, tạo task "Gặp 1-1 với <tên>" giao cho lead team, thông báo cho nhân viên.
- Đạt `level2`: level 2, thông báo manager + admin.

Mỗi level chỉ tạo 1 lần/tháng/người.

---

## 9. Thông báo & lịch tự động

| Giờ (ngày làm việc) | Job | Hành động |
|---|---|---|
| `plan_reminder_time` | `remind_plan` | Email + in-app cho người chưa nộp kế hoạch |
| `plan_deadline` + 15' | `summary_morning` | Gửi lead/manager: ai chưa nộp, ai trễ; post Google Chat (nếu có) |
| Mỗi giờ 8h–18h | `lead_sla_check` | Lead quá SLA chưa liên hệ: báo người được giao + Trang |
| `report_reminder_time` | `remind_report` | Nhắc người chưa nộp báo cáo |
| 18:00 | `summary_evening` | Tóm tắt ngày cho lead/manager: báo cáo, việc hoàn thành, "Cần quyết định" |
| `report_missed_at` | `close_day` | Gán missed, chuyển việc tồn, tính tuân thủ, kiểm tra leo thang |
| Thứ Hai 08:00 | `weekly_kickoff` | Nhắc lead tạo mục tiêu tuần; gửi điểm tuân thủ tuần trước |
| Thứ Hai 07:30 | `weekly_report` | Email manager/admin: tuần trước — doanh số vs KPI, lead, tuân thủ từng người, mục tiêu đạt/trượt |
| 08:00 hằng ngày | `followup_due` | Nhắc lead có `next_follow_up_at` hôm nay |

Người dùng tắt được email (giữ in-app) cho các loại không bắt buộc. Nhắc kế hoạch/báo cáo không tắt được.

---

## 10. Yêu cầu phi chức năng
- **Hiệu năng:** trang chính tải < 2 giây trên 4G; thao tác Kanban phản hồi ngay (optimistic update).
- **Mobile:** mọi màn hình dùng được ở 360px; nút bấm ≥ 44px; check-in và báo cáo tối ưu một tay.
- **PWA:** cài được lên màn hình chính; icon và tên "Mita Workspace". Không yêu cầu offline ở v1.
- **Bảo mật:**
  - RLS là lớp bảo vệ chính, không dựa vào ẩn giao diện.
  - Secrets (service account JSON, OAuth) chỉ nằm trong Supabase secrets.
  - Edge Function luôn xác thực JWT người gọi và kiểm tra quyền.
- **Nhật ký:** audit_log cho mọi thay đổi quan trọng; trang xem nhật ký cho manager/admin.
- **Chất lượng code:** TypeScript strict; ESLint + Prettier; Vitest cho logic nghiệp vụ (tính giờ hạn chót, tuân thủ, chuyển việc tồn); Playwright smoke test cho luồng Cổng kế hoạch → Báo cáo; test RLS theo từng vai trò.
- **Ngôn ngữ:** chuỗi giao diện gom trong `src/i18n/vi.ts`.

---

## 11. Cấu trúc repo đề xuất
```
/SPEC.md
/README.md
/.env.example
/src
  /app            (routes, layout)
  /features       (daily, tasks, goals, sales, checkin, library, products, dashboard, settings)
  /components     (ui dùng chung, shadcn)
  /lib            (supabase client, date-vn, format, rules)
  /i18n/vi.ts
/supabase
  /migrations
  /functions      (drive-upload-init, drive-upload-complete, drive-move, drive-thumb, notify, cron-runner)
  /seed.sql
  /tests          (RLS tests)
/.github/workflows (ci.yml, backup.yml)
/docs             (setup-google.md, setup-supabase.md, setup-cloudflare.md, van-hanh.md)
```

---

## 12. Milestone & tiêu chí nghiệm thu

**M0 – Nền tảng**
- Repo, CI, Supabase migrations; bảng profiles/teams/user_teams/settings/holidays/leaves/notifications/audit_log.
- Đăng nhập Google Internal, whitelist, màn hình chờ kích hoạt.
- Layout + điều hướng theo vai trò. Deploy lên `work.[DOMAIN]`.
- Nghiệm thu:
  - (1) Tài khoản ngoài domain không đăng nhập được.
  - (2) Tài khoản trong domain chưa được mời vào màn hình chờ.
  - (3) Admin mời, kích hoạt, đổi vai trò/team.
  - (4) Menu hiện đúng theo vai trò.

**M1 – Kỷ luật ngày**
- Cổng kế hoạch, báo cáo cuối ngày, amendment, review, nghỉ phép, ngày lễ, chuyển việc tồn.
- Cron `remind_plan`, `summary_morning`, `remind_report`, `summary_evening`, `close_day`. Email qua Gmail API.
- Nghiệm thu:
  - (1) Staff chưa nộp kế hoạch không vào được màn khác.
  - (2) Nộp sau 09:00 bị gắn Trễ + lead nhận thông báo.
  - (3) Báo cáo đã nộp không sửa được, chỉ bổ sung.
  - (4) Item chưa xong tự xuất hiện trong kế hoạch hôm sau.
  - (5) Ngày nghỉ đã duyệt không bị chặn/không bị tính.
  - (6) Email nhắc đến đúng giờ Việt Nam.

**M2 – Công việc & mục tiêu**
- Kanban (5 cột, kéo-thả, realtime), task chi tiết, checklist, comment + @nhắc, lịch sử, giao hàng loạt, mục tiêu tuần, cờ ngoài kế hoạch.
- Nghiệm thu:
  - (1) Hai người mở cùng bảng thấy thay đổi của nhau tức thì.
  - (2) Staff không thấy task nhạy cảm của team khác.
  - (3) Staff chỉ đẩy đến Chờ duyệt; lead duyệt.
  - (4) Task bắt đầu ngoài kế hoạch bị gắn cờ.

**M3 – Sales**
- Lead (kiểm tra trùng, SLA, hoạt động, pipeline), khách hàng, đơn hàng, check-in có GPS + ảnh lên Drive, bản đồ, cron `lead_sla_check`, `followup_due`.
- Nghiệm thu:
  - (1) MKT tạo lead; sau khi giao, MKT không thấy SĐT.
  - (2) Lead quá 24h chưa liên hệ thì người được giao + Trang nhận thông báo.
  - (3) Check-in trên điện thoại lưu vị trí + ảnh, ảnh nằm đúng thư mục Drive.
  - (4) Báo cáo cuối ngày của Sale tự điền số liệu trong ngày.

**M4 – Thư viện & sản phẩm**
- Tích hợp Drive (upload resumable, duyệt, chuyển thư mục, thumbnail), trang `/thu-vien` độc lập, YouTube item, sản phẩm + bảng giá + lịch sử giá + xuất PDF, seed mục 15.
- Nghiệm thu:
  - (1) Upload file 200MB thành công có thanh tiến độ.
  - (2) File mới nằm ở `00_Cho-duyet`, duyệt xong nằm đúng thư mục và thuộc Shared Drive.
  - (3) Staff MKT không thấy item `sales_private`.
  - (4) Sửa giá tạo bản ghi lịch sử.

**M5 – Dashboard & tuân thủ**
- `/quan-ly` đủ 6 khối, điểm tuân thủ, leo thang, `weekly_kickoff`, `weekly_report`, xuất CSV.
- Nghiệm thu:
  - (1) Số liệu dashboard khớp dữ liệu thô (kiểm tra bằng 3 kịch bản mẫu).
  - (2) Trễ 3 lần/tháng tự tạo task gặp 1-1 cho lead.
  - (3) Email tuần đến manager sáng thứ Hai.

**M6 – Hoàn thiện & bàn giao**
- PWA, backup hằng đêm, trang nhật ký, hiệu năng, test đầy đủ, tài liệu `docs/van-hanh.md` (thêm người, đổi giờ, khôi phục backup).
- Nghiệm thu:
  - (1) Cài được lên iPhone/Android.
  - (2) Backup xuất hiện trong `MITA Backup`.
  - (3) Khôi phục thử từ backup thành công trên project test.

---

## 13. Checklist cài đặt (Quý Anh làm, Claude Code viết hướng dẫn chi tiết)

1. **Google Admin Console:**
   - Xác nhận `[DOMAIN]`.
   - Tạo Google Groups `all@`, `sales@`, `mkt@`, `managers@`.
   - Tạo 3 Shared Drive (mục 4.2) và gán quyền.
   - Chọn tài khoản hệ thống `[SYSTEM_USER]` (tài khoản có license; có thể dùng tài khoản riêng hoặc tài khoản admin).
2. **Google Cloud (trong tổ chức Workspace):**
   - Tạo project `mita-workspace`; bật Drive API, Gmail API.
   - OAuth consent screen **Internal**; tạo OAuth Client (Web) với redirect URI của Supabase.
   - Tạo service account + key JSON. Nếu bị chặn do org policy `iam.disableServiceAccountKeyCreation` (tổ chức mới thường bật mặc định), admin tắt policy này riêng cho project.
   - Admin Console → Security → API controls → Domain-wide delegation: thêm Client ID của service account với 2 scope `drive` và `gmail.send`.
3. **Supabase:** tạo project (Singapore); bật Google provider; nhập Client ID/Secret; thêm secrets cho Edge Functions (service account JSON, SYSTEM_USER, APP_ORIGIN); bật `pg_cron`, `pg_net`.
4. **Cloudflare Pages:** kết nối repo GitHub; biến môi trường build; custom domain `work.[DOMAIN]` (thêm bản ghi DNS tại nơi quản lý domain).
5. **GitHub:** repo private; secrets cho Action backup.
6. **Dữ liệu:** điền email roster (mục 2.4), xác nhận `workdays`, giá sản phẩm (mục 15).

**Khuyến nghị:** khi bắt đầu dùng thật với cả team, nâng Supabase lên gói trả phí để có backup tự động và không bị tạm dừng. Backup hằng đêm (mục 4.5) vẫn giữ.

---

## 14. Ngoài phạm vi v1
- Công nợ, kế toán chính thức, kho, xuất hóa đơn (kế toán vẫn là nguồn chuẩn).
- Tính hoa hồng tự động.
- Chat nội bộ (dùng Google Chat).
- Offline, app native.
- Team xuất khẩu dùng pipeline (v1 chỉ dùng thư viện + sản phẩm).
- Ý tưởng v2: trợ lý hỏi đáp sản phẩm/giá dựa trên dữ liệu `products` + thư viện.

---

## 15. Dữ liệu seed sản phẩm (nguồn: Brief MITAFOOD — [XÁC NHẬN lại giá trước khi seed])

Giá lẻ (VNĐ). Giá buôn để trống (công ty chưa ban hành giá buôn chiết khấu).

| Dòng | Vùng trồng | Hương vị | 100g | 250g | 500g | 1kg |
|---|---|---|---|---|---|---|
| Arabica Natural | Cầu Đất, Lâm Đồng | Trái cây chín · Berry · Mật ong | 130.000 | 195.000 | 460.000 | 640.000 |
| Arabica Honey | Cầu Đất, Lâm Đồng | Mật ong nhẹ · Caramel · Ngọt hậu | 120.000 | 185.000 | 450.000 | 630.000 |
| Robusta Natural | M'Nông, Lâm Đồng | Cacao · Gỗ · Socola đậm | 100.000 | 160.000 | 290.000 | 330.000 |
| Robusta Honey | M'Nông, Lâm Đồng | Mật ong · Cacao · Caramel | 90.000 | 150.000 | 280.000 | 320.000 |
| Mix 80/20 | Robusta & Arabica | Trái cây chín · Socola · Cacao | 110.000 | 168.000 | 295.000 | 340.000 |
| Culi Robusta | M'Nông, Lâm Đồng | Hạt dẻ · Socola · Caramel cháy | 80.000 | 140.000 | 270.000 | 310.000 |
| Phin Truyền Thống | M'Nông, Lâm Đồng | Socola đen · Cacao rang · Caramel | 95.000 | 165.000 | 275.000 | 315.000 |

Cà phê: rang nguyên hạt hoặc rang xay theo yêu cầu (lưu dạng thuộc tính khi tạo đơn, không tách SKU).

| Phụ kiện / Bộ quà | Giá lẻ | Mô tả |
|---|---|---|
| Phin cà phê DALAC | 95.000 | Phin nhôm phủ màu |
| Túi thơm cà phê rang | 60.000 | Treo ô tô, phòng, tủ đồ |
| Combo Signature | 315.000 | Robusta Natural + Phin + Túi thơm |
| Combo Premium | 350.000 | Arabica Natural + Phin + Túi thơm |

Hoa quả: tạo danh mục sầu riêng, chanh dây (bán lẻ trái tươi) và nhóm B2B (IQF/đông lạnh, trái tươi, sấy/chế biến), giá để trống.
