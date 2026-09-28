-- Tạm ẩn Kế hoạch/Báo cáo ngày (settings.daily_enabled = false)
begin;
set local search_path = public, extensions, tests;
select plan(11);

select tests.seed_roster();
update profiles set activated_at = '2026-01-01';

select is(
  (select value from settings where key = 'daily_enabled'), 'true'::jsonb,
  'Test mặc định chạy với tính năng đang bật'
);
update settings set value = 'false' where key = 'daily_enabled';
select tests.set_now('2026-09-29 08:31+07');

select ok(not fn_plan_required(get_user_id('long@mita.test'), '2026-09-29'),
  'Tắt → không ai bị cổng kế hoạch chặn');
select is((select count(*)::int from fn_required_users('2026-09-29')), 0,
  'Tắt → không có người phải nộp');

select is(fn_run_job('remind_plan', '2026-09-29') ->> 'reminded', '0', 'Tắt → không nhắc kế hoạch');
select is(fn_run_job('summary_morning', '2026-09-29') ->> 'recipients', '0', 'Tắt → không tóm tắt buổi sáng');
select is(fn_run_job('remind_report', '2026-09-29') ->> 'reminded', '0', 'Tắt → không nhắc báo cáo');
select is(fn_run_job('close_day', '2026-09-29') ->> 'missed', '0', 'Tắt → không gán Bỏ lỡ');
select is((select count(*)::int from outbox), 0, 'Tắt → không có email nào trong hàng đợi');

-- Dữ liệu cũ: kế hoạch trễ + báo cáo bỏ lỡ; 1 việc đúng hạn
insert into daily_plans (user_id, plan_date, is_late) values (get_user_id('kien@mita.test'), '2026-09-22', true);
insert into daily_reports (user_id, report_date, submitted_at, status)
values (get_user_id('kien@mita.test'), '2026-09-22', null, 'missed');
insert into tasks (title, team_id, assignee_id, status, due_date, completed_at) values
  ('K1', 'marketing', get_user_id('kien@mita.test'), 'done', '2026-09-23', '2026-09-23 10:00+07');

select is(
  fn_compliance_calc(get_user_id('kien@mita.test'), '2026-09-21', '2026-09-27')
    - array['plan_items', 'off_plan_items', 'tasks_done_on_time', 'tasks_due', 'plan_days', 'report_days'],
  '{"plan": null, "report": null, "tasks": 100.0, "off_plan": null, "score": 100.0}'::jsonb,
  'Tắt → điểm chỉ tính Việc đúng hạn'
);
select is(fn_violation_count(get_user_id('kien@mita.test'), '2026-09-01'), 0, 'Tắt → không đếm vi phạm');

update settings set value = 'true' where key = 'daily_enabled';
select ok(fn_plan_required(get_user_id('long@mita.test'), '2026-09-29'), 'Bật lại → chạy như cũ');

select * from finish();
rollback;
