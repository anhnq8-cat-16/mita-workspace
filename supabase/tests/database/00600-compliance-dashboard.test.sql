-- M5: điểm tuân thủ (3 kịch bản mẫu đối chiếu dữ liệu thô), leo thang, dashboard, báo cáo tuần
begin;
set local search_path = public, extensions, tests;
select plan(29);

select tests.seed_roster();
update profiles set activated_at = '2026-01-01';
-- Tuần 05/10 (thứ Hai) – 10/10 (thứ Bảy): 6 ngày làm việc. Đánh giá vào thứ Hai tuần sau.
select tests.set_now('2026-10-12 10:00+07');

-- ---------------------------------------------------------------------------
-- Kịch bản A – Long: kế hoạch + báo cáo đúng giờ cả 6 ngày, 2 việc đúng hạn → 100
-- ---------------------------------------------------------------------------
insert into daily_plans (user_id, plan_date, is_late)
select get_user_id('long@mita.test'), d::date, false from generate_series('2026-10-05'::date, '2026-10-10', '1 day') d;
insert into daily_plan_items (plan_id, title)
select dp.id, 'Việc ' || g from daily_plans dp cross join generate_series(1, 3) g
where dp.user_id = get_user_id('long@mita.test');
insert into daily_reports (user_id, report_date, submitted_at, status)
select get_user_id('long@mita.test'), d::date, now(), 'on_time' from generate_series('2026-10-05'::date, '2026-10-10', '1 day') d;
insert into tasks (title, team_id, assignee_id, status, due_date, completed_at) values
  ('L1', 'sales_domestic', get_user_id('long@mita.test'), 'done', '2026-10-06', '2026-10-06 15:00+07'),
  ('L2', 'sales_domestic', get_user_id('long@mita.test'), 'done', '2026-10-07', '2026-10-07 23:30+07');

select is(
  fn_compliance_calc(get_user_id('long@mita.test'), '2026-10-05', '2026-10-11') ->> 'score', '100.0',
  'Kịch bản A: đúng giờ tất cả → 100'
);

-- ---------------------------------------------------------------------------
-- Kịch bản B – Kiên: KH 3 đúng/3 trễ; BC 2 đúng/2 trễ/2 bỏ lỡ; việc 1/2 đúng hạn;
--   18 việc trong kế hoạch, 3 ngoài kế hoạch.
--   plan 50 · report (2×100+2×50)/6 = 50 · tasks 50 · off_plan 100−min(100, 200×3/18)=66,7
--   score = (50×30 + 50×30 + 50×30 + 66,7×10)/100 = 51,7
-- ---------------------------------------------------------------------------
insert into daily_plans (user_id, plan_date, is_late)
select get_user_id('kien@mita.test'), d::date, extract(day from d) > 7
from generate_series('2026-10-05'::date, '2026-10-10', '1 day') d;
insert into daily_plan_items (plan_id, title, is_off_plan)
select dp.id, 'Việc ' || g, dp.plan_date = '2026-10-06' from daily_plans dp cross join generate_series(1, 3) g
where dp.user_id = get_user_id('kien@mita.test');
insert into daily_reports (user_id, report_date, submitted_at, status) values
  (get_user_id('kien@mita.test'), '2026-10-05', now(), 'on_time'),
  (get_user_id('kien@mita.test'), '2026-10-06', now(), 'on_time'),
  (get_user_id('kien@mita.test'), '2026-10-07', now(), 'late'),
  (get_user_id('kien@mita.test'), '2026-10-08', now(), 'late'),
  (get_user_id('kien@mita.test'), '2026-10-09', null, 'missed'),
  (get_user_id('kien@mita.test'), '2026-10-10', null, 'missed');
insert into tasks (title, team_id, assignee_id, status, due_date, completed_at) values
  ('K1', 'marketing', get_user_id('kien@mita.test'), 'done', '2026-10-06', '2026-10-06 10:00+07'),
  ('K2', 'marketing', get_user_id('kien@mita.test'), 'done', '2026-10-07', '2026-10-09 10:00+07');

select is(
  fn_compliance_calc(get_user_id('kien@mita.test'), '2026-10-05', '2026-10-11'),
  '{"plan": 50.0, "tasks": 50.0, "score": 51.7, "report": 50.0, "off_plan": 66.7, "plan_days": 6, "tasks_due": 2, "plan_items": 18, "report_days": 6, "off_plan_items": 3, "tasks_done_on_time": 1}'::jsonb,
  'Kịch bản B: các thành phần khớp dữ liệu thô'
);

-- ---------------------------------------------------------------------------
-- Kịch bản C – Huệ: nghỉ đã duyệt 2 ngày (không tính), 4 ngày KH đúng giờ,
--   BC 3 đúng + 1 bỏ lỡ → 75, không có việc đến hạn (bỏ khỏi trọng số)
--   score = (100×30 + 75×30 + 100×10)/70 = 89,3
-- ---------------------------------------------------------------------------
insert into leaves (user_id, date, type, approved_at) values
  (get_user_id('hue@mita.test'), '2026-10-05', 'om', now()),
  (get_user_id('hue@mita.test'), '2026-10-06', 'om', now());
insert into leaves (user_id, date, type) values (get_user_id('hue@mita.test'), '2026-10-07', 'nghi_phep');  -- chờ duyệt: vẫn tính
insert into daily_plans (user_id, plan_date, is_late)
select get_user_id('hue@mita.test'), d::date, false from generate_series('2026-10-07'::date, '2026-10-10', '1 day') d;
insert into daily_plan_items (plan_id, title)
select dp.id, 'Việc ' || g from daily_plans dp cross join generate_series(1, 3) g
where dp.user_id = get_user_id('hue@mita.test');
insert into daily_reports (user_id, report_date, submitted_at, status)
select get_user_id('hue@mita.test'), d::date, now(), 'on_time' from generate_series('2026-10-07'::date, '2026-10-09', '1 day') d;
insert into daily_reports (user_id, report_date, submitted_at, status) values (get_user_id('hue@mita.test'), '2026-10-10', null, 'missed');

select is(
  fn_compliance_calc(get_user_id('hue@mita.test'), '2026-10-05', '2026-10-11') - array['plan_items','off_plan_items','tasks_done_on_time'],
  '{"plan": 100.0, "tasks": null, "score": 89.3, "report": 75.0, "off_plan": 100.0, "plan_days": 4, "tasks_due": 0, "report_days": 4}'::jsonb,
  'Kịch bản C: nghỉ đã duyệt không tính; không có việc → bỏ khỏi trọng số'
);
select is(
  (select count(*)::int from fn_compliance_days(get_user_id('hue@mita.test'), '2026-10-05', '2026-10-11') where not counted),
  3, 'Không tính: 2 ngày nghỉ đã duyệt + Chủ nhật'
);

-- Hôm nay: kế hoạch chỉ tính sau hạn chót, báo cáo chưa tính
select tests.set_now('2026-10-12 08:30+07');
select is(
  (select plan_counted from fn_compliance_days(get_user_id('long@mita.test'), '2026-10-12', '2026-10-12')), false,
  'Hôm nay trước 09:00 chưa tính kế hoạch'
);
select tests.set_now('2026-10-12 10:00+07');
select is(
  (select array[plan_counted, report_counted] from fn_compliance_days(get_user_id('long@mita.test'), '2026-10-12', '2026-10-12')),
  array[true, false], 'Sau 09:00 tính kế hoạch hôm nay; báo cáo hôm nay chưa tính'
);

-- ---------------------------------------------------------------------------
-- Quyền xem điểm
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select lives_ok($$ select fn_compliance_score(auth.uid(), '2026-10-05', '2026-10-11') $$, 'Nhân viên xem điểm của mình');
select throws_ok(
  $$ select fn_compliance_score(tests.get_user_id('kien@mita.test'), '2026-10-05', '2026-10-11') $$,
  '42501', null, 'Nhân viên không xem điểm người khác'
);
select throws_ok($$ select * from fn_dashboard_people() $$, '42501', null, 'Nhân viên không mở dashboard');
select throws_ok($$ select fn_dashboard_sales('2026-10-05', '2026-10-11') $$, '42501', null, 'Nhân viên không xem số liệu Sales tổng');

select tests.authenticate_as('mai@mita.test');
select is(
  (select array_agg(email order by email) from fn_compliance_scores('2026-10-05', '2026-10-11')),
  array['kien@mita.test', 'long@mita.test', 'mai@mita.test', 'trang@mita.test'],
  'Lead Sale thấy điểm team Sale (gồm chính mình), không thấy Huệ'
);
select is(
  (select score from fn_compliance_scores('2026-10-05', '2026-10-11') where email = 'kien@mita.test'), 51.7::numeric,
  'Bảng điểm khớp kịch bản B'
);
select is((select count(*)::int from fn_dashboard_people('2026-10-10') where email = 'hue@mita.test'), 0,
  'Dashboard lead không có người team khác');
select is(
  (select plan_is_late from fn_dashboard_people('2026-10-08') where email = 'kien@mita.test'), true,
  'Dashboard ngày 08/10: Kiên nộp kế hoạch trễ'
);
select is(
  (select count(*)::int from fn_compliance_trend(4, '2026-10-11') where user_id = tests.get_user_id('kien@mita.test')), 4,
  'Xu hướng 4 tuần'
);

select tests.authenticate_as('manager@mita.test');
select is((select count(*)::int from fn_compliance_scores('2026-10-05', '2026-10-11')), 6, 'Manager thấy điểm mọi người phải nộp kế hoạch');

-- ---------------------------------------------------------------------------
-- NT2: leo thang – Kiên 3 KH trễ + 2 BC trễ + 2 bỏ lỡ = 7 lần trong tháng
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is(fn_violation_count(get_user_id('kien@mita.test'), '2026-10-01'), 7, 'Đếm vi phạm tháng khớp dữ liệu thô');
select is((fn_check_escalations('2026-10-10') ->> 'created')::int, 2, 'Tạo leo thang: Kiên cấp 1 + cấp 2; Huệ (1 lần) và Long không');
select is(
  (select count(*)::int from escalations where user_id = get_user_id('kien@mita.test')), 2,
  'Kiên có leo thang cấp 1 và cấp 2'
);
select ok(
  exists (select 1 from tasks t join escalations e on e.task_id = t.id
          where e.user_id = get_user_id('kien@mita.test') and t.title = 'Gặp 1-1 với kien' and t.is_sensitive
            and t.assignee_id in (get_user_id('trang@mita.test'), get_user_id('mai@mita.test'))),
  'NT2: tự tạo việc nhạy cảm "Gặp 1-1" giao cho trưởng nhóm'
);
select ok(exists (select 1 from notifications where user_id = get_user_id('manager@mita.test') and type = 'escalation'),
  'Cấp 2 báo quản lý');
select is((fn_check_escalations('2026-10-10') ->> 'created')::int, 0, 'Mỗi cấp chỉ tạo 1 lần/tháng');
select is((select count(*)::int from escalations where user_id = get_user_id('long@mita.test')), 0, 'Long không bị leo thang');

select tests.authenticate_as('mai@mita.test');
select cmp_ok(jsonb_array_length(fn_dashboard_inbox() -> 'escalations'), '>=', 2, 'Hộp "Chờ tôi xử lý" có leo thang');
select lives_ok(
  $$ select fn_resolve_escalation((select id from escalations where user_id = tests.get_user_id('kien@mita.test') and level = 1), 'Đã gặp, cam kết nộp đúng giờ') $$,
  'Lead xử lý leo thang'
);

-- ---------------------------------------------------------------------------
-- Sales + NT3 báo cáo tuần
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
insert into leads (name, first_contact_due_at, created_at, first_contacted_at, stage, lost_reason, source) values
  ('A', '2026-10-06 09:00+07', '2026-10-05 09:00+07', '2026-10-05 15:00+07', 'contacted', null, 'Fanpage'),
  ('B', '2026-10-07 09:00+07', '2026-10-06 09:00+07', '2026-10-08 09:00+07', 'contacted', null, 'Fanpage'),
  ('C', '2026-10-08 09:00+07', '2026-10-07 09:00+07', null, 'new', null, 'Hội chợ');
update leads set stage = 'lost', lost_reason = 'Giá cao' where name = 'B';
insert into customers (name, owner_id) values ('KH', get_user_id('long@mita.test'));
insert into orders (customer_id, sales_id, order_date, total_value_vnd, status) values
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-10-06', 10000000, 'confirmed'),
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-10-07', 5000000, 'draft');
select tests.authenticate_as('manager@mita.test');
select is(
  fn_dashboard_sales('2026-10-05', '2026-10-11') - array['pipeline', 'lost_reasons', 'by_source', 'lost', 'won', 'kpi_month'],
  '{"revenue": 10000000, "sla_due": 3, "new_leads": 3, "overdue_now": 1, "revenue_month": 10000000, "contacted_in_sla": 1}'::jsonb,
  'Số liệu Sales khớp dữ liệu thô (đơn nháp không tính doanh số)'
);
select is(
  fn_dashboard_sales('2026-10-01', '2026-10-31') -> 'lost_reasons', '[{"count": 1, "reason": "Giá cao"}]'::jsonb,
  'Top lý do mất lead'
);

select tests.clear_authentication();
select is((fn_job_weekly_report('2026-10-12') ->> 'recipients')::int, 2, 'NT3: email tuần gửi manager + admin');
select ok(
  exists (select 1 from outbox where recipient = 'manager@mita.test' and type = 'weekly_report'
          and body like '%Tuần 05/10 – 11/10/2026%' and body like '%10.000.000đ%'),
  'Email tuần có kỳ báo cáo và doanh số'
);

select * from finish();
rollback;
