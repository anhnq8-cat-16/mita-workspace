-- Email cá nhân: chỉ đăng nhập được khi đã có lời mời đúng email.
begin;
set local search_path = public, extensions, tests;
select plan(6);

select tests.seed_roster();

select throws_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'nguoila@gmail.com') $$,
  '42501', null,
  'Gmail chưa được mời → bị từ chối'
);

insert into invitations (email, full_name, role, teams, lead_teams)
values ('Nhanvien.A@Gmail.com', 'Nhân viên A', 'staff', '{sales_domestic}', '{}');

select is(
  (select count(*)::int from invitations where email = 'nhanvien.a@gmail.com'), 1,
  'Lời mời lưu email chữ thường'
);

select lives_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'nhanvien.a@gmail.com') $$,
  'Gmail đã được mời → đăng nhập được'
);
select is(
  (select is_active from profiles where email = 'nhanvien.a@gmail.com'), true,
  'Gmail được mời → kích hoạt ngay'
);
select is(
  (select count(*)::int from user_teams ut join profiles p on p.id = ut.user_id
   where p.email = 'nhanvien.a@gmail.com' and ut.team_id = 'sales_domestic'),
  1, 'Team lấy theo lời mời'
);

select lives_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'chuamoi@mita.test') $$,
  'Email trong domain vẫn đăng nhập được khi chưa mời (chờ kích hoạt)'
);

select * from finish();
rollback;
