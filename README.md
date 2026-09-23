# Mita Workspace

Ứng dụng web nội bộ của CTCP XNK MITAFOOD: kế hoạch ngày, báo cáo cuối ngày, giao việc, lead/khách hàng, thư viện tư liệu, sản phẩm & bảng giá, dashboard quản lý.
Đặc tả đầy đủ: [SPEC.md](SPEC.md).

**Trạng thái:**
- M0 Nền tảng: đăng nhập Google, lời mời/kích hoạt, phân quyền, layout theo vai trò.
- M1 Kỷ luật ngày: cổng kế hoạch ngày, báo cáo cuối ngày + bổ sung, review, nghỉ phép, ngày lễ/ngày làm bù, chuyển việc tồn, nhắc việc & tóm tắt tự động (email Gmail API + Google Chat).
- M3 Sales: lead (kiểm tra trùng, SLA, hàng chờ, phân công, pipeline kéo-thả, hoạt động, chốt/mất, gộp trùng), khách hàng + bản đồ, đơn hàng + KPI tháng, check-in GPS + ảnh lên Drive, báo cáo Sale tự điền.
- M2 Công việc & mục tiêu: Kanban kéo-thả realtime (5 chế độ xem, bộ lọc), chi tiết việc (Markdown, checklist, bình luận @nhắc tên, link tư liệu, lịch sử), việc nhạy cảm, giao việc hàng loạt, mục tiêu tuần.

## Công nghệ
React + Vite + TypeScript (strict), Tailwind CSS, TanStack Query, react-hook-form + zod · Supabase (Postgres + RLS, Auth Google, Realtime, Edge Functions, pg_cron) · Cloudflare Pages · GitHub Actions.

## Cấu trúc
```
src/app            router, layout, điều hướng
src/features       auth, home, settings, notifications… (mỗi module 1 thư mục)
src/components/ui  component giao diện dùng chung
src/lib            supabase client, giờ Việt Nam, định dạng tiền, quy tắc điều hướng
src/i18n/vi.ts     toàn bộ chuỗi tiếng Việt
supabase/migrations  SQL migration (mọi thay đổi DB)
supabase/tests       test RLS (pgTAP)
docs/              hướng dẫn cài đặt & vận hành
```

## Chạy trên máy (local)

Yêu cầu: Node.js 22, Docker (cho Supabase local).

```bash
npm install
cp .env.example .env.local        # điền giá trị (xem bên dưới)
npx supabase start                # Supabase local: API :54321, Studio :54323
npm run dev                       # http://localhost:5173
```

- `npx supabase start` in ra `API URL` và `anon key`: dán vào `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` trong `.env.local`.
- Đăng nhập Google ở local cần `SUPABASE_AUTH_GOOGLE_CLIENT_ID/SECRET` trong `.env` (OAuth Client có `http://localhost:5173` và redirect `http://127.0.0.1:54321/auth/v1/callback`).
- `supabase/seed.sql` đặt domain local là `mita.test`. Muốn dùng domain thật khi chạy local: sửa `allowed_email_domains` trong Studio.
- Tài khoản admin đầu tiên: chạy `supabase/roster.example.sql` (đã điền email) trong Studio → SQL Editor.

### Kiểm tra chất lượng
```bash
npm run lint           # ESLint
npm run format:check   # Prettier
npm run typecheck      # TypeScript
npm test               # Vitest (logic nghiệp vụ)
npx supabase test db   # test RLS trên Supabase local (pgTAP)
npm run test:rls       # hoặc: test RLS trên Postgres thường, không cần Docker (cần psql, pg_prove, pgtap)
npx deno test supabase/functions/_shared   # test Edge Functions (Deno)
```

### Lịch tự động hoạt động thế nào
`pg_cron` gọi `public.fn_cron_tick()` mỗi phút. Hàm này so giờ Việt Nam với các mốc trong `settings`, chạy mỗi job (`remind_plan`, `summary_morning`, `remind_report`, `summary_evening`, `close_day`; thứ Hai thêm `weekly_kickoff`; mỗi giờ `lead_sla_check`; sáng `followup_due`) đúng 1 lần/ngày (ghi vào `cron_runs`), tạo thông báo trong app và đưa email/Google Chat vào bảng `outbox`. Sau đó gọi Edge Function `notify` (qua `pg_net`) để gửi.
Khác SPEC một chút: logic job nằm trong SQL thay cho Edge Function `cron-runner`, để test được bằng pgTAP (giả lập giờ qua `app.now`) và đổi giờ trong Cài đặt không cần sửa cron.

## Deploy (lần đầu)
Làm theo thứ tự:
1. [docs/setup-google.md](docs/setup-google.md): OAuth Internal, OAuth Client (và service account, Shared Drive cho các milestone sau).
2. [docs/setup-supabase.md](docs/setup-supabase.md): project Singapore, migration, provider Google, domain + danh sách nhân sự.
3. [docs/setup-cloudflare.md](docs/setup-cloudflare.md): Cloudflare Pages + tên miền `work.mitaexport.com`.

Các lần sau: merge vào `main` thì Cloudflare tự deploy frontend; thay đổi DB chạy `npx supabase db push`.

## Vận hành & xử lý sự cố
Xem [docs/van-hanh.md](docs/van-hanh.md) (thêm người, khóa tài khoản, đổi giờ hạn chót, lỗi đăng nhập thường gặp).

## Nguyên tắc phát triển
- Mọi thay đổi database bằng migration trong `supabase/migrations`; mọi bảng bật RLS và có test RLS theo vai trò.
- Không hardcode secret hay con số nghiệp vụ: secret nằm ở Supabase secrets; giờ/ngưỡng/trọng số đọc từ bảng `settings`.
- Giao diện tiếng Việt, múi giờ `Asia/Ho_Chi_Minh`, tiền dạng `1.250.000đ`, ngày `dd/MM/yyyy`, ưu tiên mobile (360px, nút ≥ 44px).
