-- =============================================================================
-- Dữ liệu tham chiếu bắt buộc: team + giá trị mặc định của settings (mục 8 SPEC).
-- Mọi con số nghiệp vụ đọc từ bảng settings, sửa tại /cai-dat.
-- =============================================================================

insert into public.teams (id, name) values
  ('sales_domestic', 'Sale nội địa'),
  ('marketing', 'Marketing'),
  ('export', 'Xuất khẩu')
on conflict (id) do nothing;

insert into public.settings (key, value, description) values
  ('allowed_email_domains', '[]'::jsonb,
    'Domain email được phép đăng nhập, ví dụ ["mitafood.vn"]. Để trống thì không ai đăng nhập được.'),
  ('workdays', '[1,2,3,4,5,6]'::jsonb, 'Thứ làm việc (1 = thứ Hai … 7 = Chủ nhật)'),
  ('plan_required_roles', '["lead","staff"]'::jsonb, 'Vai trò phải qua cổng kế hoạch ngày'),
  ('plan_deadline', '"09:00"'::jsonb, 'Hạn nộp kế hoạch ngày'),
  ('plan_min_items', '3'::jsonb, 'Số việc tối thiểu trong kế hoạch ngày'),
  ('plan_reminder_time', '"08:30"'::jsonb, 'Giờ nhắc nộp kế hoạch'),
  ('report_open_time', '"16:00"'::jsonb, 'Giờ mở nhận báo cáo cuối ngày'),
  ('report_reminder_time', '"17:00"'::jsonb, 'Giờ nhắc báo cáo'),
  ('report_deadline', '"17:30"'::jsonb, 'Hạn nộp báo cáo đúng giờ'),
  ('report_missed_at', '"23:59"'::jsonb, 'Quá giờ này chưa nộp thì tính Bỏ lỡ'),
  ('carry_over_enabled', 'true'::jsonb, 'Tự chuyển việc tồn sang ngày làm việc tiếp theo'),
  ('task_require_review', 'true'::jsonb, 'Task phải qua bước Chờ duyệt'),
  ('lead_sla_hours', '24'::jsonb, 'Số giờ tối đa để liên hệ lần đầu với lead mới'),
  ('kpi_monthly_revenue_vnd', '150000000'::jsonb, 'KPI doanh số tháng Team Nội địa (VNĐ)'),
  ('compliance_weights', '{"plan":30,"report":30,"tasks":30,"off_plan":10}'::jsonb,
    'Trọng số điểm tuân thủ'),
  ('escalation_thresholds', '{"level1":3,"level2":5}'::jsonb,
    'Số lần trễ/bỏ lỡ trong tháng để leo thang'),
  ('lead_sources',
    '["Hội chợ","Website DALAC","Fanpage","TikTok","Giới thiệu","Sale tự tìm","Khác"]'::jsonb,
    'Nguồn lead'),
  ('lead_segments',
    '["Quán cà phê","Đại lý","Cửa hàng bán lẻ","Quà tặng doanh nghiệp","Khách du lịch","Cá nhân","B2B hoa quả","Khác"]'::jsonb,
    'Phân khúc lead'),
  ('library_channels', '["Website","Fanpage","TikTok","Hội chợ","Bán hàng"]'::jsonb,
    'Kênh sử dụng tư liệu thư viện'),
  ('report_templates', '{
      "sales_domestic": [
        {"key":"visits","label":"Số điểm/khách đã gặp","type":"number","auto":"check_ins"},
        {"key":"new_leads","label":"Lead mới","type":"number","auto":"leads_created"},
        {"key":"contacted_leads","label":"Lead đã liên hệ","type":"number","auto":"leads_contacted"},
        {"key":"quotes_sent","label":"Báo giá đã gửi","type":"number","auto":"quotes"},
        {"key":"orders_closed","label":"Đơn chốt","type":"number","auto":"orders"},
        {"key":"revenue_vnd","label":"Doanh số (VNĐ)","type":"money","auto":"revenue"}
      ],
      "marketing": [
        {"key":"content_done","label":"Nội dung hoàn thành","type":"number"},
        {"key":"posts_published","label":"Bài đã đăng (kèm link)","type":"links"},
        {"key":"leads_collected","label":"Lead thu về","type":"number","auto":"leads_created"},
        {"key":"pending_approval","label":"Việc đang chờ duyệt","type":"number","auto":"tasks_review"}
      ]
    }'::jsonb,
    'Chỉ số báo cáo cuối ngày theo team'),
  ('drive.folders', '{}'::jsonb, 'ID thư mục Google Drive (Shared Drive)'),
  ('google_chat_webhook', '""'::jsonb, 'Webhook Google Chat cho tóm tắt 9h15 và 18h (để trống = tắt)'),
  ('app_origin', '""'::jsonb, 'Địa chỉ ứng dụng, ví dụ https://work.mitafood.vn (dùng trong link email)')
on conflict (key) do nothing;
