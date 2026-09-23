-- M3: lead (trùng, SLA, phân công, MKT ẩn SĐT), hoạt động, khách, đơn, check-in, tự điền báo cáo
begin;
set local search_path = public, extensions, tests;
select plan(54);

select tests.seed_roster();
select tests.set_now('2026-09-29 09:00+07');

-- ---------------------------------------------------------------------------
-- MKT tạo lead → hàng chờ
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mkt@mita.test');
select ok(
  (fn_create_lead('{"name":"Quán Cà Phê Mộc","company":"Mộc Coffee","phone":"0912 345 678","source":"Fanpage","segment":"Quán cà phê"}') ? 'id'),
  'MKT tạo lead'
);
select is((select count(*)::int from leads), 0, 'MKT không đọc trực tiếp bảng leads');
select is((select phone from fn_my_submitted_leads()), '0912 345 678', 'MKT thấy SĐT lead mình tạo khi chưa giao');
select throws_ok($$ insert into leads (name, first_contact_due_at) values ('x', now()) $$, '42501', null,
  'Không ghi thẳng vào leads (phải qua fn_create_lead)');
select tests.clear_authentication();
select is((select assigned_to from leads where name = 'Quán Cà Phê Mộc'), null, 'Lead MKT chưa phân công');
select is(
  (select first_contact_due_at from leads where name = 'Quán Cà Phê Mộc'), '2026-09-30 09:00+07'::timestamptz,
  'Hạn liên hệ = tạo + 24h (lead_sla_hours)'
);
select is(
  (select count(*)::int from notifications where type = 'lead_queue'), 2,
  'Lead chờ phân công → báo trưởng nhóm Sale (Trang, Mai)'
);

select tests.authenticate_as('hue@mita.test');
select throws_ok($$ select fn_create_lead('{"name":"x"}') $$, '42501', null, 'Team xuất khẩu không tạo lead');

-- ---------------------------------------------------------------------------
-- Kiểm tra trùng
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select ok(
  (fn_create_lead('{"name":"Mộc","phone":"+84 912345678"}') ? 'duplicates'),
  'Trùng SĐT (khác định dạng) → cảnh báo, chưa tạo'
);
select is((select count(*)::int from leads), 0, 'Chưa tạo khi còn trùng');
select ok(
  (fn_create_lead('{"name":"Mộc chi nhánh 2","phone":"+84 912345678"}', true) ? 'id'),
  'Xác nhận vẫn tạo'
);
select is((select assigned_to from leads where name = 'Mộc chi nhánh 2'), auth.uid(), 'Sale tạo → tự giao cho mình');
select ok(
  (fn_create_lead('{"name":"Đại lý Minh Anh","company":"Minh Anh","phone":"0988000111","est_value_vnd":20000000}') ? 'id'),
  'Sale tạo lead thứ 2'
);

-- ---------------------------------------------------------------------------
-- Phân công (trưởng nhóm Sale) – NT1: sau khi giao, MKT không thấy SĐT
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select fn_assign_lead((select id from fn_my_submitted_leads() limit 1), auth.uid()) $$, '42501', null,
  'Sale không tự phân công'
);
select tests.authenticate_as('trang@mita.test');
select is((select count(*)::int from leads), 3, 'Trưởng nhóm Sale thấy tất cả lead');
select lives_ok(
  $$ select fn_assign_lead((select id from leads where name = 'Quán Cà Phê Mộc'), tests.get_user_id('long@mita.test')) $$,
  'Trưởng nhóm Sale giao lead'
);
select throws_ok(
  $$ select fn_assign_lead((select id from leads where name = 'Quán Cà Phê Mộc'), tests.get_user_id('mkt@mita.test')) $$,
  '22023', null, 'Không giao cho người ngoài team Sale'
);
select tests.authenticate_as('mkt@mita.test');
select is((select phone from fn_my_submitted_leads()), null, 'NT1: đã giao → MKT không thấy SĐT');
select is((select stage::text from fn_my_submitted_leads()), 'new', 'MKT vẫn thấy trạng thái lead');
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('long@mita.test') and type = 'lead_assigned'),
  'Người được giao nhận thông báo');

-- ---------------------------------------------------------------------------
-- Quyền của Sale trên lead
-- ---------------------------------------------------------------------------
select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from leads), 0, 'Sale khác không thấy lead của Long');
select tests.authenticate_as('long@mita.test');
select is((select count(*)::int from leads), 3, 'Long thấy lead được giao + do mình tạo');
select throws_ok(
  $$ update leads set assigned_to = tests.get_user_id('kien@mita.test') where name = 'Quán Cà Phê Mộc' $$,
  '42501', null, 'Sale không tự chuyển lead'
);
select throws_ok(
  $$ update leads set stage = 'lost' where name = 'Mộc chi nhánh 2' $$, '23514', null, 'Mất lead phải có lý do'
);
select throws_ok(
  $$ update leads set stage = 'won' where name = 'Mộc chi nhánh 2' $$, '22023', null, 'Chốt phải qua nút Chốt đơn'
);
select lives_ok(
  $$ update leads set stage = 'lost', lost_reason = 'Trùng với lead chính' where name = 'Mộc chi nhánh 2' $$,
  'Mất lead có lý do'
);

-- Hoạt động
select lives_ok(
  $$ insert into lead_activities (lead_id, type, content) values ((select id from leads where name = 'Đại lý Minh Anh'), 'call', 'Gọi giới thiệu') $$,
  'Ghi cuộc gọi'
);
select isnt((select first_contacted_at from leads where name = 'Đại lý Minh Anh'), null, 'Hoạt động đầu tiên → đã liên hệ');
select is((select stage::text from leads where name = 'Đại lý Minh Anh'), 'contacted', 'Mới → Đã liên hệ');
insert into lead_activities (lead_id, type, content) values ((select id from leads where name = 'Đại lý Minh Anh'), 'quote', 'Gửi báo giá');
select is((select stage::text from leads where name = 'Đại lý Minh Anh'), 'quoted', 'Gửi báo giá → Đã báo giá');
select tests.authenticate_as('kien@mita.test');
select throws_ok(
  $$ insert into lead_activities (lead_id, type) values ((select id from leads limit 1), 'call') $$, '42501', null,
  'Người không phụ trách không ghi hoạt động'
);

-- ---------------------------------------------------------------------------
-- NT2: SLA – quá 24h chưa liên hệ → báo người được giao + chủ dữ liệu
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
update settings set value = to_jsonb(get_user_id('trang@mita.test')::text) where key = 'sales_owner_id';
select tests.set_now('2026-09-30 10:00+07');
select is((fn_job_lead_sla_check('2026-09-30') ->> 'overdue')::int, 1, 'NT2: 1 lead quá SLA (Quán Mộc)');
select ok(exists (select 1 from notifications where user_id = get_user_id('long@mita.test') and type = 'lead_sla'),
  'NT2: người được giao nhận cảnh báo');
select ok(exists (select 1 from notifications where user_id = get_user_id('trang@mita.test') and type = 'lead_sla'),
  'NT2: chủ dữ liệu Sales (Trang) nhận cảnh báo');
select ok(not exists (select 1 from notifications where user_id = get_user_id('mai@mita.test') and type = 'lead_sla'),
  'Đã chọn chủ dữ liệu → trưởng nhóm khác không nhận');
select is((fn_job_lead_sla_check('2026-09-30') ->> 'overdue')::int, 0, 'Không cảnh báo lặp');

-- ---------------------------------------------------------------------------
-- Chốt đơn → khách + đơn nháp
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select ok(
  (fn_mark_lead_won((select id from leads where name = 'Đại lý Minh Anh'), null, '{"type":"agent"}') ? 'order_id'),
  'Chốt lead → tạo khách + đơn nháp'
);
select is((select owner_id from customers where name = 'Minh Anh'), auth.uid(), 'Khách thuộc Sale phụ trách');
select is((select total_value_vnd from orders), 20000000::numeric, 'Đơn nháp lấy giá trị dự kiến');
update orders set status = 'confirmed';

select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from customers), 0, 'Sale khác không đọc chi tiết khách');
select is((select count(*)::int from fn_customer_directory('Minh')), 1, 'Nhưng thấy tên khách (tránh trùng)');
insert into customers (name) values ('Quán của Kiên');
select tests.authenticate_as('long@mita.test');
select throws_ok(
  $$ insert into orders (customer_id, total_value_vnd) values ((select id from fn_customer_directory('Kiên')), 100) $$,
  '42501', null, 'Không tạo đơn cho khách của người khác'
);
select tests.authenticate_as('manager@mita.test');
select is_empty($$ update orders set total_value_vnd = 1 returning id $$, 'Manager chỉ đọc đơn hàng');

-- ---------------------------------------------------------------------------
-- Check-in
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select lives_ok(
  $$ insert into check_ins (customer_id, lat, lng, accuracy_m, photo_drive_file_id, note)
     values ((select id from customers where name = 'Minh Anh'), 20.98, 105.87, 12, 'drive-file-1', 'Giao mẫu') $$,
  'Check-in có GPS + ảnh'
);
select throws_ok($$ update check_ins set lat = 21 $$, '42501', null, 'Không sửa vị trí check-in');
select tests.authenticate_as('kien@mita.test');
select is((select count(*)::int from check_ins), 0, 'Sale khác không thấy check-in');
select tests.authenticate_as('mai@mita.test');
select is((select count(*)::int from check_ins), 1, 'Lead team thấy check-in');

-- NT4: tự điền báo cáo cuối ngày
select tests.authenticate_as('long@mita.test');
select is(
  fn_report_autofill() -> 'sales_domestic',
  '{"visits": 1, "new_leads": 0, "revenue_vnd": 20000000, "quotes_sent": 0, "orders_closed": 1, "contacted_leads": 0}'::jsonb,
  'NT4: số liệu Sale trong ngày (30/09) tự điền'
);

-- Mục tiêu tự động từ đơn hàng / lead
select tests.authenticate_as('mai@mita.test');
insert into weekly_goals (week_start, team_id, title, target, actual_source)
values ('2026-09-28', 'sales_domestic', 'Doanh số tuần', 50000000, 'auto_orders'),
       ('2026-09-28', 'sales_domestic', 'Lead mới', 5, 'auto_leads');
select is((select actual from fn_weekly_goals('2026-09-28') where title = 'Doanh số tuần'), 20000000::numeric,
  'Mục tiêu doanh số tự tính từ đơn đã xác nhận');
select is((select actual from fn_weekly_goals('2026-09-28') where title = 'Lead mới'), 2::numeric,
  'Mục tiêu lead tự tính (lead do thành viên team Sale tạo)');

-- Gộp lead trùng (chủ dữ liệu)
select tests.authenticate_as('long@mita.test');
select throws_ok(
  $$ select fn_merge_leads((select id from leads where name = 'Quán Cà Phê Mộc'), (select id from leads where name = 'Mộc chi nhánh 2')) $$,
  '42501', null, 'Sale không gộp lead'
);
select tests.authenticate_as('trang@mita.test');
select lives_ok(
  $$ select fn_merge_leads((select id from leads where name = 'Quán Cà Phê Mộc'), (select id from leads where name = 'Mộc chi nhánh 2')) $$,
  'Chủ dữ liệu gộp lead trùng'
);
select is((select count(*)::int from leads where name like 'Mộc%' or name like 'Quán Cà Phê Mộc'), 1, 'Còn 1 lead sau khi gộp');

-- Nhắc follow-up
select tests.authenticate_as('long@mita.test');
update leads set next_follow_up_at = '2026-10-01 14:00+07' where name = 'Quán Cà Phê Mộc';
select tests.clear_authentication();
select is((fn_job_followup_due('2026-10-01') ->> 'notified')::int, 1, 'Nhắc follow-up lead đến hạn hôm nay');

select * from finish();
rollback;
