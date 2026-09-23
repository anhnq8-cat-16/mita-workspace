-- M1: quyền trên tasks (việc nhạy cảm, duyệt), cờ ngoài kế hoạch, lịch tự động
begin;
set local search_path = public, extensions, tests;
select plan(26);

select tests.seed_roster();
select tests.set_now('2026-09-29 08:00+07');

-- ---------------------------------------------------------------------------
-- Việc nhạy cảm (hiệu suất cá nhân)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mai@mita.test');
select lives_ok(
  $$ insert into tasks (title, team_id, assignee_id, is_sensitive)
     values ('Đánh giá hiệu suất tháng 9 – Long', 'sales_domestic', tests.get_user_id('long@mita.test'), true) $$,
  'Lead tạo việc nhạy cảm'
);
select lives_ok(
  $$ insert into tasks (title, team_id, assignee_id)
     values ('Chuẩn bị hội chợ', 'sales_domestic', tests.get_user_id('long@mita.test')) $$,
  'Lead giao việc thường'
);
select tests.authenticate_as('long@mita.test');
select is((select count(*)::int from tasks), 2, 'Người được giao thấy cả việc nhạy cảm của mình');
select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from tasks where is_sensitive), 0, 'Đồng nghiệp cùng team không thấy việc nhạy cảm');
select is((select count(*)::int from tasks where title = 'Chuẩn bị hội chợ'), 1, 'Đồng nghiệp cùng team thấy việc thường');
select tests.authenticate_as('hue@mita.test');
select is((select count(*)::int from tasks), 0, 'Staff team khác không thấy việc của team Sale');
select tests.authenticate_as('manager@mita.test');
select is((select count(*)::int from tasks), 2, 'Manager thấy tất cả');

select tests.authenticate_as('kien@mita.test');
select throws_ok(
  $$ insert into tasks (title, team_id, assignee_id, is_sensitive) values ('x', 'marketing', auth.uid(), true) $$,
  '42501', null, 'Staff không tạo việc nhạy cảm'
);
select throws_ok(
  $$ insert into tasks (title, team_id, assignee_id) values ('x', 'marketing', tests.get_user_id('mkt@mita.test')) $$,
  '42501', null, 'Staff không giao việc cho người khác'
);
select lives_ok(
  $$ insert into tasks (title, team_id, assignee_id) values ('Việc riêng của Kiên', 'marketing', auth.uid()) $$,
  'Staff tạo việc cho chính mình'
);

-- ---------------------------------------------------------------------------
-- Duyệt: staff chỉ đẩy đến Chờ duyệt
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select throws_ok(
  $$ update tasks set status = 'done' where title = 'Chuẩn bị hội chợ' $$,
  '42501', null, 'Staff không tự chuyển Hoàn thành'
);
select throws_ok(
  $$ update tasks set title = 'đổi tên' where title = 'Chuẩn bị hội chợ' $$,
  '42501', null, 'Staff không sửa nội dung việc được giao'
);
select throws_ok(
  $$ update tasks set is_sensitive = false where title like 'Đánh giá%' $$,
  '42501', null, 'Staff không bỏ cờ nhạy cảm'
);
select throws_ok(
  $$ update tasks set status = 'blocked' where title = 'Chuẩn bị hội chợ' $$,
  '23514', null, 'Bị chặn cần lý do'
);
select lives_ok(
  $$ update tasks set status = 'review' where title = 'Chuẩn bị hội chợ' $$,
  'Staff chuyển Chờ duyệt'
);
select tests.authenticate_as('mai@mita.test');
select lives_ok($$ update tasks set status = 'done' where title = 'Chuẩn bị hội chợ' $$, 'Lead duyệt Hoàn thành');
select is(
  (select approved_by from tasks where title = 'Chuẩn bị hội chợ'), tests.get_user_id('mai@mita.test'),
  'approved_by = lead'
);
select is(
  (select count(*)::int from task_status_history h join tasks t on t.id = h.task_id where t.title = 'Chuẩn bị hội chợ'),
  3, 'Lịch sử trạng thái: tạo → chờ duyệt → hoàn thành'
);

-- ---------------------------------------------------------------------------
-- Task bắt đầu ngoài kế hoạch
-- ---------------------------------------------------------------------------
select tests.authenticate_as('kien@mita.test');
select fn_submit_daily_plan('[{"title":"A"},{"title":"B"},{"title":"C"}]');
select lives_ok($$ update tasks set status = 'doing' where title = 'Việc riêng của Kiên' $$, 'Bắt đầu việc không có trong kế hoạch');
select is((select is_off_plan from tasks where title = 'Việc riêng của Kiên'), true, 'Gắn cờ ngoài kế hoạch');
select is((select is_off_plan from tasks where title = 'A'), false, 'Việc trong kế hoạch không gắn cờ');

-- Hàm nội bộ không gọi được qua API (tránh lộ settings như webhook)
select tests.authenticate_as('long@mita.test');
select throws_ok($$ select fn_setting_at('2026-09-29', 'google_chat_webhook', '00:00') $$, '42501', null,
  'Không gọi được fn_setting_at');
select throws_ok($$ select fn_cron_tick() $$, '42501', null, 'Không tự chạy cron được');

-- ---------------------------------------------------------------------------
-- Lịch tự động (giờ Việt Nam, chạy 1 lần/ngày)
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select tests.set_now('2026-09-29 08:29+07');
select is(fn_cron_tick(), '{}'::jsonb, 'Trước 08:30 chưa chạy nhắc');
select tests.set_now('2026-09-29 08:31+07');
select ok(fn_cron_tick() ? 'remind_plan', 'NT6: 08:30 giờ VN chạy nhắc kế hoạch');
select tests.set_now('2026-09-29 08:40+07');
select is(fn_cron_tick(), '{}'::jsonb, 'Không nhắc lại lần 2 trong ngày');

select * from finish();
rollback;
