# Bàn giao Mita Workspace

Tài liệu cho người phụ trách hệ thống (Quý Anh) sau khi bàn giao. Đọc cùng
[van-hanh.md](van-hanh.md) (dùng hằng ngày) và [backup.md](backup.md) (sao lưu).

## 1. Hệ thống gồm những gì, nằm ở đâu

| Thành phần | Ở đâu | Dùng để |
|---|---|---|
| Mã nguồn | GitHub repo (private) | Frontend, migration database, Edge Functions, tài liệu, CI, backup |
| Database, đăng nhập, API | Supabase (Singapore) | Dữ liệu + phân quyền (RLS), job tự động (pg_cron), Edge Functions gửi email / Drive |
| Giao diện web | Cloudflare Pages → `work.mitaexport.com` | Tự deploy khi merge vào `main` |
| Đăng nhập Google, gửi email, Drive | Google Cloud project `mita-workspace` + Google Workspace | OAuth (Internal), service account ủy quyền cho `sale05@mitaexport.com` |
| File | Shared Drive `MITA Library`, `MITA Sales Private`, `MITA Backup` | Thư viện, ảnh check-in, báo giá, backup database |

**Secrets (không bao giờ đưa vào mã nguồn):**

| Nơi lưu | Tên |
|---|---|
| Supabase → Edge Functions → Secrets | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SYSTEM_USER`, `CRON_SECRET`, `APP_ORIGIN` |
| Supabase → SQL (Vault) | `project_url`, `cron_secret` |
| Cloudflare Pages → Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_HD` |
| GitHub → Settings → Secrets → Actions | `SUPABASE_DB_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SYSTEM_USER`, `BACKUP_DRIVE_FOLDER_ID`, (`TEST_DB_URL`) |

## 2. Checklist đưa vào dùng thật (theo thứ tự)
1. [ ] [setup-google.md](setup-google.md): nhóm `all@ sales@ mkt@ managers@`, 3 Shared Drive, OAuth Internal, service account + domain-wide delegation (scope `gmail.send`, `drive`).
2. [ ] [setup-supabase.md](setup-supabase.md): project, `npx supabase db push`, provider Google, `drive.folders`, secrets, `npx supabase functions deploy`, Vault, kiểm tra `cron.job`.
3. [ ] Điền **danh sách nhân sự thật** (`supabase/roster.example.sql`) – email thật của từng người, vai trò, team, trưởng nhóm.
4. [ ] [setup-cloudflare.md](setup-cloudflare.md): Pages + tên miền `work.mitaexport.com`.
5. [ ] [backup.md](backup.md): secrets GitHub → chạy tay *Backup DB hằng đêm* → thấy file trong `MITA Backup/db`.
6. [ ] Cài đặt → Thông số: kiểm tra giờ hạn chót, `workdays`, KPI tháng (`kpi_monthly_revenue_vnd`), trọng số/ngưỡng; Cài đặt → Lịch làm việc: ngày lễ cả năm.
7. [ ] Sản phẩm → **Sửa bảng giá**: nhập giá khi đã chốt.
8. [ ] Mỗi người đăng nhập 1 lần, cài app lên điện thoại ([van-hanh.md](van-hanh.md) – Cài ứng dụng).
9. [ ] Tuần đầu: trưởng nhóm xem **Báo cáo → Team** mỗi ngày; quản lý xem **Quản lý** và email thứ Hai.
10. [ ] Nâng Supabase lên gói **Pro** khi cả team dùng (không bị tạm dừng, có backup của Supabase).

## 3. Việc định kỳ
| Khi nào | Việc | Ai |
|---|---|---|
| Hằng ngày | Duyệt nghỉ phép, xem kế hoạch/báo cáo, xử lý *Chờ tôi xử lý* trên dashboard | Trưởng nhóm, quản lý |
| Thứ Hai | Đọc email báo cáo tuần; trưởng nhóm lập **Mục tiêu tuần** | Quản lý, trưởng nhóm |
| Hằng tuần | Actions → *Backup DB hằng đêm*: 7 dấu ✓ | Admin |
| Hằng tháng | Xử lý leo thang (gặp 1-1), xem **Nhật ký → Hệ thống** có lỗi email/job không | Trưởng nhóm, admin |
| Hằng quý | *Thử khôi phục backup* ([backup.md](backup.md) mục 3) | Admin |
| Tháng 12 | Khai báo ngày lễ năm sau (Cài đặt → Lịch làm việc) | Admin |
| Khi có người nghỉ việc | Cài đặt → Người dùng → **Khóa**; gỡ khỏi nhóm Google và Shared Drive | Admin |

## 4. Thay đổi hệ thống an toàn
- **Không cần sửa mã:** giờ hạn chót, ngày làm việc, trọng số điểm, ngưỡng leo thang, KPI, mẫu báo cáo, nguồn lead, kênh thư viện, webhook Google Chat, bật/tắt email → **Cài đặt → Thông số**. Mọi thay đổi có trong **Nhật ký**.
- **Sửa mã:** tạo nhánh → Pull Request → CI phải xanh (lint, typecheck, test logic, test RLS, E2E, build) → merge vào `main` (Cloudflare tự deploy). Thay đổi database luôn là file migration mới trong `supabase/migrations` kèm test RLS, rồi `npx supabase db push`.
- Lệnh kiểm tra trước khi đẩy mã: xem [README.md](../README.md) mục *Kiểm tra chất lượng*.

## 5. Phạm vi v1 và giới hạn đã biết
- Không dùng được khi mất mạng (PWA chỉ để cài lên màn hình và mở nhanh).
- Email gửi từ `sale05@mitaexport.com` – tài khoản này phải còn hoạt động và có license.
- Số liệu doanh số là số Sale tự nhập đơn; số kế toán vẫn là nguồn chuẩn.
- Supabase gói Free tạm dừng project sau 7 ngày không truy cập → backup và job tự động dừng theo. Dùng thật thì nâng gói Pro.
- Giao diện premium (nền slate, nhấn indigo) hiện áp dụng cho trang **Quản lý**; các trang khác giữ màu thương hiệu nâu.

## 6. Nghiệm thu các giai đoạn
Tiêu chí nghiệm thu từng giai đoạn M0–M6 nằm ở [SPEC.md](../SPEC.md) mục 12. Kiểm thử tự động tương ứng:
`supabase/tests/database/*.test.sql` (phân quyền, cổng kế hoạch, cron, điểm tuân thủ, leo thang…),
`src/**/*.test.ts` (logic giao diện), `e2e/*.spec.ts` (luồng Cổng kế hoạch → Báo cáo, quyền trang, PWA),
`scripts/backup/*.test.mjs` (backup).
