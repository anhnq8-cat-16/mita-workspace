-- M2: checklist, bình luận + @nhắc tên, link, thông báo việc, mục tiêu tuần
begin;
set local search_path = public, extensions, tests;
select plan(32);

select tests.seed_roster();
select tests.set_now('2026-09-28 08:00+07');   -- thứ Hai

-- Lead giao việc → người được giao nhận thông báo
select tests.authenticate_as('mai@mita.test');
insert into tasks (title, team_id, assignee_id, due_date)
values ('Chào hàng 5 quán mới', 'sales_domestic', tests.get_user_id('long@mita.test'), '2026-10-02');
insert into tasks (title, team_id, assignee_id, is_sensitive)
values ('Đánh giá hiệu suất – Long', 'sales_domestic', tests.get_user_id('long@mita.test'), true);
select tests.clear_authentication();
select is(
  (select count(*)::int from notifications where user_id = get_user_id('long@mita.test') and type = 'task_assigned'),
  2, 'Người được giao nhận thông báo giao việc'
);

-- ---------------------------------------------------------------------------
-- Checklist
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select lives_ok(
  $$ insert into task_checklist_items (task_id, text) values ((select id from tasks where title = 'Chào hàng 5 quán mới'), 'Quán 1') $$,
  'Người được giao thêm checklist'
);
select lives_ok(
  $$ update task_checklist_items set done = true where text = 'Quán 1' $$,
  'Người được giao đánh dấu checklist'
);
select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from task_checklist_items), 1, 'Đồng nghiệp cùng team xem được checklist việc thường');
select throws_ok(
  $$ insert into task_checklist_items (task_id, text) values ((select id from tasks where title = 'Chào hàng 5 quán mới'), 'x') $$,
  '42501', null, 'Đồng nghiệp không sửa checklist việc của người khác'
);
select is_empty($$ update task_checklist_items set done = false returning id $$, 'Đồng nghiệp không đổi checklist');
select tests.authenticate_as('hue@mita.test');
select is((select count(*)::int from task_checklist_items), 0, 'Team khác không thấy checklist');

-- ---------------------------------------------------------------------------
-- Bình luận + @nhắc tên
-- ---------------------------------------------------------------------------
select tests.authenticate_as('kien@mita.test');
select lives_ok(
  $$ insert into task_comments (task_id, body, mentions)
     values ((select id from tasks where title = 'Chào hàng 5 quán mới'), '@Long nhớ mang mẫu', array[tests.get_user_id('long@mita.test')]) $$,
  'Người xem được việc bình luận được'
);
select throws_ok(
  $$ insert into task_comments (task_id, body, author_id)
     values ((select id from tasks where title = 'Chào hàng 5 quán mới'), 'giả mạo', tests.get_user_id('mai@mita.test')) $$,
  '42501', null, 'Không bình luận dưới tên người khác'
);
select throws_ok(
  $$ update task_comments set body = 'sửa' $$, '42501', null, 'Không sửa bình luận'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from notifications where user_id = get_user_id('long@mita.test') and type = 'task_mention'), 1,
  '@nhắc tên → người được nhắc nhận thông báo'
);
select is(
  (select count(*)::int from notifications where user_id = get_user_id('mai@mita.test') and type = 'task_comment'), 1,
  'Người giao việc nhận thông báo bình luận'
);
select is(
  (select count(*)::int from notifications where user_id = get_user_id('long@mita.test') and type = 'task_comment'), 0,
  'Đã được @nhắc thì không nhận trùng thông báo bình luận'
);

-- @nhắc người không xem được việc nhạy cảm → không báo
select tests.authenticate_as('mai@mita.test');
insert into task_comments (task_id, body, mentions)
values ((select id from tasks where is_sensitive), 'Trao đổi riêng', array[tests.get_user_id('kien@mita.test')]);
select tests.clear_authentication();
select is(
  (select count(*)::int from notifications where user_id = get_user_id('kien@mita.test') and type = 'task_mention'), 0,
  '@nhắc người không có quyền xem việc nhạy cảm → không gửi (không lộ tên việc)'
);
select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from task_comments where body = 'Trao đổi riêng'), 0, 'Không đọc được bình luận việc nhạy cảm');

-- ---------------------------------------------------------------------------
-- Link tư liệu
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select lives_ok(
  $$ insert into task_links (task_id, url, label) values ((select id from tasks where title = 'Chào hàng 5 quán mới'), 'https://drive.google.com/x', 'Catalogue') $$,
  'Người được giao thêm link tư liệu'
);
select throws_ok(
  $$ insert into task_links (task_id, label) values ((select id from tasks where title = 'Chào hàng 5 quán mới'), 'trống') $$,
  '23514', null, 'Link cần URL hoặc tư liệu thư viện'
);

-- ---------------------------------------------------------------------------
-- Duyệt: thông báo chờ duyệt / đã duyệt
-- ---------------------------------------------------------------------------
update tasks set status = 'review' where title = 'Chào hàng 5 quán mới';
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('mai@mita.test') and type = 'task_review'),
  'NT3: chuyển Chờ duyệt → người giao nhận thông báo');
select tests.authenticate_as('mai@mita.test');
update tasks set status = 'done' where title = 'Chào hàng 5 quán mới';
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('long@mita.test') and type = 'task_done'),
  'Lead duyệt → người thực hiện nhận thông báo');

-- ---------------------------------------------------------------------------
-- Mục tiêu tuần
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select throws_ok(
  $$ insert into weekly_goals (week_start, team_id, title, target) values ('2026-09-28', 'sales_domestic', 'x', 1) $$,
  '42501', null, 'Staff không tạo mục tiêu'
);
select tests.authenticate_as('mai@mita.test');
select throws_ok(
  $$ insert into weekly_goals (week_start, team_id, title, target) values ('2026-09-29', 'sales_domestic', 'x', 1) $$,
  '23514', null, 'week_start phải là thứ Hai'
);
select throws_ok(
  $$ insert into weekly_goals (week_start, team_id, title, target) values ('2026-09-28', 'marketing', 'x', 1) $$,
  '42501', null, 'Lead không tạo mục tiêu cho team khác'
);
select throws_ok(
  $$ insert into weekly_goals (week_start, team_id, owner_id, title, target)
     values ('2026-09-28', 'sales_domestic', tests.get_user_id('hue@mita.test'), 'x', 1) $$,
  '22023', null, 'Người phụ trách phải thuộc team'
);
select lives_ok(
  $$ insert into weekly_goals (week_start, team_id, title, metric, target, unit, actual_source)
     values ('2026-09-28', 'sales_domestic', 'Chào hàng quán mới', 'Số việc xong', 2, 'việc', 'auto_tasks') $$,
  'Lead tạo mục tiêu team (tự động từ việc)'
);
update tasks set weekly_goal_id = (select id from weekly_goals limit 1) where title = 'Chào hàng 5 quán mới';
select is((select actual from fn_weekly_goals('2026-09-28')), 1::numeric, 'Thực tế = số việc đã xong gắn với mục tiêu');
select is((select task_total from fn_weekly_goals('2026-09-28')), 1, 'Đếm việc liên kết');

select tests.authenticate_as('hue@mita.test');
select is((select count(*)::int from weekly_goals), 0, 'Staff team khác không thấy mục tiêu');
select tests.authenticate_as('long@mita.test');
select is((select count(*)::int from weekly_goals), 1, 'Staff thấy mục tiêu team mình');
select throws_ok(
  $$ update tasks set weekly_goal_id = null where title = 'Chào hàng 5 quán mới' $$,
  '42501', null, 'Staff không tự gỡ việc khỏi mục tiêu'
);

-- Thứ Hai tuần sau: chốt tuần cũ (1/2 → trượt) + nhắc lead team chưa có mục tiêu
select tests.clear_authentication();
select is(
  fn_job_weekly_kickoff('2026-10-05') - array['scores', 'milestone_owners'], '{"closed": 1, "reminded": 3}'::jsonb,
  'weekly_kickoff: chốt 1 mục tiêu (trượt), nhắc lead Sale (Trang, Mai) + lead MKT (Trang)'
);

select is((select status::text from weekly_goals limit 1), 'missed', 'Mục tiêu 1/2 → Trượt');
select tests.set_now('2026-10-05 08:01+07');
select ok(fn_cron_tick() ? 'weekly_kickoff', 'Thứ Hai 08:00 chạy weekly_kickoff');

select * from finish();
rollback;
