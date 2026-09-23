-- M0: đăng nhập theo domain, lời mời, kích hoạt, phân quyền profiles/settings/leaves/audit.
begin;
set local search_path = public, extensions, tests;
select plan(43);

select tests.seed_roster();

-- ---------------------------------------------------------------------------
-- Đăng nhập / tài khoản mới
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'hacker@gmail.com') $$,
  '42501', null,
  'NT1: tài khoản ngoài domain bị từ chối'
);

select tests.create_user('moi@mita.test', 'staff', '{}', '{}', false);
select is(
  (select is_active from profiles where email = 'moi@mita.test'), false,
  'NT2: tài khoản trong domain chưa được mời → is_active = false'
);
select is(
  (select role::text from profiles where email = 'moi@mita.test'), 'staff',
  'Tài khoản chưa mời mặc định vai trò staff'
);
select is(
  (select is_active from profiles where email = 'trang@mita.test'), true,
  'Người được mời → kích hoạt ngay khi đăng nhập lần đầu'
);
select is(
  (select role::text from profiles where email = 'trang@mita.test'), 'lead',
  'Vai trò lấy theo lời mời'
);
select is(
  (select count(*)::int from user_teams ut join profiles p on p.id = ut.user_id
   where p.email = 'trang@mita.test' and ut.is_lead),
  3, 'Team + cờ trưởng nhóm lấy theo lời mời'
);
select isnt(
  (select accepted_at from invitations where email = 'trang@mita.test'), null,
  'Lời mời được đánh dấu đã nhận'
);
select ok(
  exists (select 1 from audit_log where table_name = 'profiles'),
  'Tạo profile có ghi audit_log'
);

-- ---------------------------------------------------------------------------
-- Tài khoản chờ kích hoạt
-- ---------------------------------------------------------------------------
select tests.authenticate_as('moi@mita.test');
select is((select count(*)::int from profiles), 1, 'Tài khoản chờ chỉ đọc được hồ sơ của mình');
select is((select count(*)::int from settings), 0, 'Tài khoản chờ không đọc được settings');
select is((select count(*)::int from teams), 0, 'Tài khoản chờ không đọc được teams');
select is_empty(
  $$ update profiles set phone = '0900' where email = 'moi@mita.test' returning id $$,
  'Tài khoản chờ không tự sửa hồ sơ'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
select tests.authenticate_anon();
select throws_ok($$ select count(*) from profiles $$, '42501', null, 'anon không đọc được profiles');
select throws_ok($$ select count(*) from settings $$, '42501', null, 'anon không đọc được settings');

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select cmp_ok((select count(*)::int from profiles), '>=', 8, 'staff đọc được tất cả hồ sơ');
select cmp_ok((select count(*)::int from settings), '>', 10, 'staff đọc được settings');
select is_empty(
  $$ update settings set value = '"10:00"' where key = 'plan_deadline' returning key $$,
  'staff không sửa được settings'
);
select lives_ok(
  $$ update profiles set phone = '0912345678' where email = 'long@mita.test' $$,
  'staff sửa được số điện thoại của mình'
);
select throws_ok(
  $$ update profiles set role = 'admin' where email = 'long@mita.test' $$,
  '42501', null, 'staff không tự đổi vai trò'
);
select throws_ok(
  $$ update profiles set is_active = false where email = 'long@mita.test' $$,
  '42501', null, 'staff không tự đổi trạng thái kích hoạt'
);
select is_empty(
  $$ update profiles set phone = '0000' where email = 'kien@mita.test' returning id $$,
  'staff không sửa hồ sơ người khác'
);
select throws_ok(
  $$ insert into invitations (email, role) values ('x@mita.test', 'admin') $$,
  '42501', null, 'staff không tạo được lời mời'
);
select throws_ok(
  $$ insert into user_teams (user_id, team_id) values (auth.uid(), 'marketing') $$,
  '42501', null, 'staff không tự thêm mình vào team'
);
select is((select count(*)::int from audit_log), 0, 'staff không đọc được audit_log');

-- Nghỉ phép
select lives_ok(
  $$ insert into leaves (user_id, date, type) values (auth.uid(), '2026-10-05', 'nghi_phep') $$,
  'staff khai báo nghỉ cho mình'
);
select throws_ok(
  $$ update leaves set approved_at = now() where user_id = auth.uid() $$,
  '42501', null, 'staff không tự duyệt nghỉ'
);
select throws_ok(
  $$ insert into leaves (user_id, date) values (tests.get_user_id('kien@mita.test'), '2026-10-05') $$,
  '42501', null, 'staff không khai báo nghỉ cho người khác'
);

-- ---------------------------------------------------------------------------
-- lead
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mai@mita.test');
select is(
  (select count(*)::int from leaves where user_id = tests.get_user_id('long@mita.test')), 1,
  'lead thấy ngày nghỉ của thành viên team'
);
select lives_ok(
  $$ update leaves set approved_at = now() where user_id = tests.get_user_id('long@mita.test') $$,
  'lead duyệt nghỉ của thành viên team'
);
select is(
  (select approved_by from leaves where user_id = tests.get_user_id('long@mita.test')),
  tests.get_user_id('mai@mita.test'),
  'approved_by = người duyệt'
);
select tests.clear_authentication();
select ok(fn_on_leave(tests.get_user_id('long@mita.test'), '2026-10-05'), 'fn_on_leave nhận ngày nghỉ đã duyệt');

select tests.authenticate_as('hue@mita.test');
select is(
  (select count(*)::int from leaves where user_id = tests.get_user_id('long@mita.test')), 0,
  'staff team khác không thấy ngày nghỉ'
);

-- ---------------------------------------------------------------------------
-- manager
-- ---------------------------------------------------------------------------
select tests.authenticate_as('manager@mita.test');
select cmp_ok((select count(*)::int from audit_log), '>', 0, 'manager đọc được audit_log');
select is_empty(
  $$ update settings set value = '"10:00"' where key = 'plan_deadline' returning key $$,
  'manager không sửa được settings'
);

-- ---------------------------------------------------------------------------
-- admin
-- ---------------------------------------------------------------------------
select tests.authenticate_as('admin@mita.test');
select lives_ok(
  $$ insert into invitations (email, role, teams) values ('MOI@mita.test', 'staff', '{marketing}') $$,
  'NT3: admin mời người dùng'
);
select is(
  (select is_active from profiles where email = 'moi@mita.test'), true,
  'Mời người đang ở màn hình chờ → kích hoạt ngay'
);
select isnt(
  (select activated_at from profiles where email = 'moi@mita.test'), null,
  'activated_at được ghi khi kích hoạt'
);
select lives_ok(
  $$ update profiles set role = 'lead' where email = 'moi@mita.test' $$,
  'NT3: admin đổi vai trò'
);
select lives_ok(
  $$ insert into user_teams (user_id, team_id, is_lead)
     values (tests.get_user_id('moi@mita.test'), 'sales_domestic', true) $$,
  'NT3: admin đổi team'
);
select lives_ok(
  $$ update settings set value = '"08:45"' where key = 'plan_deadline' $$,
  'admin sửa settings'
);
select lives_ok(
  $$ update profiles set is_active = false where email = 'kien@mita.test' $$,
  'admin khóa tài khoản'
);
select throws_ok(
  $$ update profiles set is_active = false where email = 'admin@mita.test' $$,
  '42501', null, 'không khóa được admin cuối cùng'
);
select throws_ok(
  $$ delete from audit_log $$,
  '42501', null, 'admin cũng không xóa được audit_log'
);

select * from finish();
rollback;
