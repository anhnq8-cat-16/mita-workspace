-- Ngày làm việc, ngày lễ, giờ Việt Nam
begin;
set local search_path = public, extensions, tests;
select plan(6);

select ok(fn_is_workday('2026-09-21'), 'Thứ Hai là ngày làm việc');
select ok(fn_is_workday('2026-09-26'), 'Thứ Bảy là ngày làm việc (mặc định workdays có 6)');
select ok(not fn_is_workday('2026-09-27'), 'Chủ nhật không phải ngày làm việc');

insert into holidays (date, name) values ('2026-09-02', 'Quốc khánh');
select ok(not fn_is_workday('2026-09-02'), 'Ngày lễ không phải ngày làm việc');

update settings set value = '[1,2,3,4,5]' where key = 'workdays';
select ok(not fn_is_workday('2026-09-26'), 'Đổi workdays trong settings → thứ Bảy nghỉ');

select is(fn_today_vn(), (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'fn_today_vn theo giờ Việt Nam');

select * from finish();
rollback;
