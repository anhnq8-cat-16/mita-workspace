-- Chiến dịch & mốc công việc: quyền, mốc tự xong, đẩy nhanh, KPI tuần
begin;
set local search_path = public, extensions, tests;
select plan(25);

select tests.seed_roster();
-- Thứ Tư 07/10/2026 (tuần bắt đầu 05/10)
select tests.set_now('2026-10-07 10:00+07');

-- Trưởng nhóm Sale không tạo được chiến dịch Marketing
select tests.authenticate_as('mai@mita.test');
select throws_ok(
  $$ insert into campaigns (team_id, title, start_date, end_date) values ('marketing', 'X', '2026-10-05', '2026-11-01') $$,
  '42501', null, 'Trưởng nhóm team khác không tạo chiến dịch'
);

select tests.authenticate_as('trang@mita.test');
insert into campaigns (team_id, title, goal, description, start_date, end_date, links)
values ('marketing', 'Set quà cà phê 20/10', 'Bán 300 set trước 20/10', 'Kế hoạch 4 tuần',
        '2026-10-05', '2026-11-01', '[{"label":"Brief","url":"https://drive.google.com/x"}]');
select is((select count(*)::int from campaigns), 1, 'Trưởng nhóm Marketing tạo chiến dịch');
select throws_ok(
  $$ insert into campaigns (team_id, title, start_date, end_date) values ('marketing', 'Y', '2026-10-06', '2026-11-01') $$,
  '23514', null, 'Chiến dịch bắt đầu từ thứ Hai'
);

insert into campaign_milestones (campaign_id, title, week_start, due_date, position)
select id, 'Chuẩn bị bao bì', '2026-10-05', '2026-10-10', 1 from campaigns;
insert into campaign_milestones (campaign_id, title, week_start, due_date, position)
select id, 'Tính giá bán', '2026-10-12', '2026-10-17', 2 from campaigns;
insert into campaign_milestones (campaign_id, title, week_start, due_date, position)
select id, 'Tung ra thị trường', '2026-10-19', '2026-10-24', 3 from campaigns;
select is((select count(*)::int from campaign_milestones), 3, 'Thêm 3 mốc, mỗi mốc 1 tuần');
select throws_ok(
  $$ insert into campaign_milestones (campaign_id, title, week_start, due_date) select id, 'Z', '2026-10-12', '2026-10-10' from campaigns $$,
  '22023', null, 'Hạn mốc không trước tuần của mốc'
);

-- Việc gắn mốc
insert into tasks (title, team_id, assignee_id, status, due_date, milestone_id)
select 'Đặt in hộp quà', 'marketing', get_user_id('mkt@mita.test'), 'todo', '2026-10-09', id
from campaign_milestones where title = 'Chuẩn bị bao bì';
insert into tasks (title, team_id, assignee_id, status, due_date, start_date, milestone_id, expected_result)
select 'Lên bảng giá set quà', 'marketing', get_user_id('mkt@mita.test'), 'todo', '2026-10-16', '2026-10-14', id,
       'Bảng giá 3 mức lẻ/sỉ/đại lý được duyệt'
from campaign_milestones where title = 'Tính giá bán';
select throws_ok(
  $$ insert into tasks (title, team_id, assignee_id, milestone_id) select 'Sai team', 'sales_domestic', get_user_id('long@mita.test'), id from campaign_milestones limit 1 $$,
  '22023', null, 'Việc chỉ gắn mốc cùng team'
);

-- Phạm vi xem
select tests.authenticate_as('mkt@mita.test');
select is((select count(*)::int from campaigns), 1, 'Nhân viên Marketing xem chiến dịch của team');
select is((select count(*)::int from fn_milestones(p_week => '2026-10-05')), 1, 'KPI tuần: 1 mốc tuần này');
select throws_ok(
  $$ insert into campaign_milestones (campaign_id, title, week_start, due_date) select id, 'N', '2026-10-05', '2026-10-10' from campaigns $$,
  '42501', null, 'Nhân viên không thêm mốc'
);
select throws_ok(
  $$ update tasks set milestone_id = null where title = 'Đặt in hộp quà' $$,
  '42501', null, 'Nhân viên không đổi mốc của việc được giao'
);
select throws_ok(
  $$ update tasks set expected_result = 'khác' where title = 'Lên bảng giá set quà' $$,
  '42501', null, 'Nhân viên không sửa kết quả cần đạt'
);
select tests.authenticate_as('long@mita.test');
select is((select count(*)::int from campaigns), 0, 'Sale không thấy chiến dịch Marketing');
select tests.authenticate_as('manager@mita.test');
select is((select count(*)::int from fn_campaigns()), 1, 'Quản lý thấy mọi chiến dịch');

-- Chưa đẩy nhanh được khi mốc tuần này chưa xong
select tests.authenticate_as('trang@mita.test');
select is((select can_pull from fn_campaigns()), false, 'Mốc tuần này chưa xong → chưa đẩy nhanh');
select throws_ok($$ select fn_campaign_pull_forward((select id from campaigns)) $$, '22023', null,
  'Đẩy nhanh bị từ chối khi chưa xong mốc tuần này');

-- Xong việc → mốc tự xong → gợi ý đẩy nhanh
update tasks set status = 'done' where title = 'Đặt in hộp quà';
select ok((select done_at is not null and done_by is null from campaign_milestones where title = 'Chuẩn bị bao bì'),
  'Mọi việc của mốc xong → mốc tự hoàn thành');
select is((select can_pull from fn_campaigns()), true, 'Xong sớm → có thể đẩy nhanh');
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('trang@mita.test') and type = 'campaign_ahead'),
  'Người lập chiến dịch được báo vượt tiến độ');

select tests.authenticate_as('mkt@mita.test');
select throws_ok($$ select fn_campaign_pull_forward((select id from campaigns)) $$, '42501', null,
  'Nhân viên không đẩy nhanh');

select tests.authenticate_as('trang@mita.test');
select is(fn_campaign_pull_forward((select id from campaigns)), 2, 'Đẩy nhanh 2 mốc còn lại');
select is(
  (select array_agg(week_start::text || '/' || due_date::text order by position) from campaign_milestones where done_at is null),
  array['2026-10-05/2026-10-10', '2026-10-12/2026-10-17'],
  'Mốc sau kéo lên 1 tuần, giữ khoảng cách'
);
select is((select due_date::text || '/' || start_date::text from tasks where title = 'Lên bảng giá set quà'),
  '2026-10-09/2026-10-07', 'Hạn và ngày bắt đầu của việc dời sớm theo (không trước hôm nay)');
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('mkt@mita.test') and type = 'campaign_pulled'),
  'Người được giao được báo đẩy nhanh');

-- Mở lại việc → mốc tự xong mở lại; mốc đánh dấu tay giữ nguyên
select tests.authenticate_as('trang@mita.test');
update tasks set status = 'doing' where title = 'Đặt in hộp quà';
select ok((select done_at is null from campaign_milestones where title = 'Chuẩn bị bao bì'),
  'Việc mở lại → mốc tự hoàn thành mở lại');
update campaign_milestones set done_at = now() where title = 'Chuẩn bị bao bì';
update tasks set status = 'todo' where title = 'Đặt in hộp quà';
select ok((select done_at is not null and done_by = get_user_id('trang@mita.test') from campaign_milestones where title = 'Chuẩn bị bao bì'),
  'Mốc trưởng nhóm đánh dấu tay giữ trạng thái xong');

select * from finish();
rollback;
