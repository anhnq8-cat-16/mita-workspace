-- M6: doanh số theo ngày (biểu đồ lũy kế), quyền xem nhật ký
begin;
set local search_path = public, extensions, tests;
select plan(7);

select tests.seed_roster();
select tests.set_now('2026-10-12 10:00+07');

insert into customers (name, owner_id) values ('KH', get_user_id('long@mita.test'));
insert into orders (customer_id, sales_id, order_date, total_value_vnd, status) values
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-10-02', 4000000, 'confirmed'),
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-10-06', 10000000, 'delivered'),
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-10-06', 5000000, 'draft'),
  ((select id from customers where name = 'KH'), get_user_id('long@mita.test'), '2026-09-30', 7000000, 'confirmed');

select tests.authenticate_as('manager@mita.test');
select is(
  jsonb_array_length(fn_dashboard_sales('2026-10-05', '2026-10-11') -> 'revenue_daily'), 11,
  'revenue_daily: mỗi ngày từ 01/10 đến ngày cuối kỳ'
);
select is(
  (select sum((x ->> 'revenue')::numeric) from jsonb_array_elements(fn_dashboard_sales('2026-10-05', '2026-10-11') -> 'revenue_daily') x),
  (fn_dashboard_sales('2026-10-05', '2026-10-11') ->> 'revenue_month')::numeric,
  'Tổng doanh số theo ngày = doanh số tháng đến nay (không tính đơn nháp, tháng trước)'
);
select is(
  (select x ->> 'revenue' from jsonb_array_elements(fn_dashboard_sales('2026-10-05', '2026-10-11') -> 'revenue_daily') x
   where x ->> 'date' = '2026-10-06'),
  '10000000', 'Ngày 06/10 chỉ tính đơn đã giao'
);

-- Nhật ký: manager/admin đọc, nhân viên/trưởng nhóm không
select tests.clear_authentication();
update settings set value = '"09:15"' where key = 'plan_deadline';
select tests.authenticate_as('manager@mita.test');
select ok((select count(*) from audit_log where table_name = 'settings') > 0, 'Manager xem được nhật ký');
select tests.authenticate_as('admin@mita.test');
select ok((select count(*) from audit_log where table_name = 'orders') >= 4, 'Admin xem được nhật ký đơn hàng');
select tests.authenticate_as('mai@mita.test');
select is((select count(*)::int from audit_log), 0, 'Trưởng nhóm không xem nhật ký');
select tests.authenticate_as('long@mita.test');
select throws_ok($$ delete from audit_log $$, '42501', null, 'Không ai xóa nhật ký qua API');

select * from finish();
rollback;
