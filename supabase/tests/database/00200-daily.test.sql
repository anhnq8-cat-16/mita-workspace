-- M1: cổng kế hoạch ngày, báo cáo, bổ sung, review, việc tồn, nghỉ, ngày làm bù
begin;
set local search_path = public, extensions, tests;
select plan(56);

select tests.seed_roster();
-- 29/09/2026 = thứ Ba, 30/09 = thứ Tư, 04/10 = Chủ nhật

-- ---------------------------------------------------------------------------
-- Ai phải qua cổng kế hoạch
-- ---------------------------------------------------------------------------
select ok(fn_plan_required(get_user_id('long@mita.test'), '2026-09-29'), 'staff phải nộp kế hoạch ngày thường');
select ok(fn_plan_required(get_user_id('mai@mita.test'), '2026-09-29'), 'lead phải nộp kế hoạch');
select ok(not fn_plan_required(get_user_id('manager@mita.test'), '2026-09-29'), 'manager không bắt buộc');
select ok(fn_plan_required(get_user_id('long@mita.test'), '2026-10-03'), 'Thứ Bảy vẫn làm việc');
select ok(not fn_plan_required(get_user_id('long@mita.test'), '2026-10-04'), 'Chủ nhật nghỉ');

insert into extra_workdays (date, name, team_ids) values ('2026-10-04', 'Hội chợ', '{sales_domestic}');
select ok(fn_plan_required(get_user_id('long@mita.test'), '2026-10-04'), 'Chủ nhật làm bù cho team Sale');
select ok(not fn_plan_required(get_user_id('hue@mita.test'), '2026-10-04'), 'Team khác vẫn nghỉ Chủ nhật đó');
insert into holidays (date, name) values ('2026-10-01', 'Lễ test');
select ok(not fn_plan_required(get_user_id('long@mita.test'), '2026-10-01'), 'Ngày lễ không bắt buộc');

-- Nghỉ: chờ duyệt → bỏ qua cổng; bị từ chối → phải nộp
select tests.authenticate_as('hue@mita.test');
insert into leaves (user_id, date, type) values (auth.uid(), '2026-09-30', 'om');
select tests.clear_authentication();
select ok(not fn_plan_required(get_user_id('hue@mita.test'), '2026-09-30'), 'NT5: khai báo nghỉ → không bị chặn');
select tests.authenticate_as('trang@mita.test');
select lives_ok(
  $$ update leaves set rejected_at = now(), reject_reason = 'Thiếu người'
     where user_id = tests.get_user_id('hue@mita.test') $$,
  'lead từ chối ngày nghỉ'
);
select tests.clear_authentication();
select ok(fn_plan_required(get_user_id('hue@mita.test'), '2026-09-30'), 'Nghỉ bị từ chối → phải nộp kế hoạch');
select ok(exists (select 1 from notifications n where n.user_id = get_user_id('hue@mita.test') and n.type = 'leave_rejected'),
  'Nhân viên nhận thông báo bị từ chối');

-- ---------------------------------------------------------------------------
-- Nộp kế hoạch
-- ---------------------------------------------------------------------------
select tests.set_now('2026-09-29 08:30+07');
select tests.authenticate_as('long@mita.test');
select is((fn_my_day() -> 'plan'), 'null'::jsonb, 'NT1: chưa có kế hoạch hôm nay');
select ok((fn_my_day() ->> 'plan_required')::boolean, 'fn_my_day báo phải nộp');
select throws_ok(
  $$ insert into daily_plans (user_id, plan_date) values (auth.uid(), '2026-09-29') $$,
  '42501', null, 'Không ghi thẳng vào bảng daily_plans (chỉ qua RPC)'
);
select throws_ok(
  $$ select fn_submit_daily_plan('[{"title":"A"},{"title":"B"}]') $$,
  '22023', 'Kế hoạch cần ít nhất 3 việc', 'Tối thiểu 3 việc'
);
select lives_ok(
  $$ select fn_submit_daily_plan(
       '[{"title":"Gọi 10 khách cũ","kind":"task","estimate_minutes":60},
         {"title":"Ghé quán Cộng","kind":"visit"},
         {"title":"Gửi báo giá Highlands","kind":"task"}]',
       'Hoàng Mai: 3 quán', null) $$,
  'Nộp kế hoạch 3 việc'
);
select is((select is_late from daily_plans where user_id = auth.uid()), false, 'Nộp trước 09:00 → đúng giờ');
select is((select count(*)::int from tasks where assignee_id = auth.uid()), 2, 'Gõ nhanh việc (task) → tạo task; ghé thăm thì không');
select is((select team_id from tasks where assignee_id = auth.uid() limit 1), 'sales_domestic', 'Task gõ nhanh thuộc team của người tạo');
select throws_ok(
  $$ select fn_submit_daily_plan('[{"title":"A"},{"title":"B"},{"title":"C"}]') $$,
  '23505', null, 'Không nộp kế hoạch 2 lần'
);
select tests.set_now('2026-09-29 08:45+07');
select lives_ok($$ select fn_add_plan_item('Soạn tin Zalo', 'task') $$, 'Thêm việc trước hạn');
select is(
  (select is_off_plan from daily_plan_items where title = 'Soạn tin Zalo'), false,
  'Thêm trước hạn chót → không phải ngoài kế hoạch'
);
select lives_ok(
  $$ select fn_remove_plan_item((select id from daily_plan_items where title = 'Soạn tin Zalo')) $$,
  'Bỏ việc trước hạn chót'
);

select tests.set_now('2026-09-29 09:10+07');
select lives_ok($$ select fn_add_plan_item('Việc phát sinh', 'task') $$, 'Sau hạn chót vẫn thêm được');
select is((select is_off_plan from daily_plan_items where title = 'Việc phát sinh'), true, 'Thêm sau hạn → ngoài kế hoạch');
select is((select is_off_plan from tasks where title = 'Việc phát sinh'), true, 'Task tương ứng gắn cờ ngoài kế hoạch');
select throws_ok(
  $$ select fn_remove_plan_item((select id from daily_plan_items where title = 'Việc phát sinh')) $$,
  '42501', null, 'Sau hạn chót không bỏ việc được'
);

-- Nộp trễ → lead nhận thông báo + email
select tests.authenticate_as('kien@mita.test');
select lives_ok(
  $$ select fn_submit_daily_plan('[{"title":"Viết bài fanpage","kind":"content"},{"title":"Quay video","kind":"content"},{"title":"Họp team","kind":"meeting"}]') $$,
  'Kiên nộp kế hoạch lúc 09:10'
);
select is((select is_late from daily_plans where user_id = auth.uid()), true, 'NT2: nộp sau 09:00 → Trễ');
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('mai@mita.test') and type = 'plan_late'),
  'NT2: lead team nhận thông báo trễ');
select ok(exists (select 1 from outbox where recipient = 'mai@mita.test' and type = 'plan_late'),
  'Email thông báo trễ vào hàng đợi');
select is((select team_id from tasks where title = 'Viết bài fanpage'), 'marketing', 'Việc nội dung → team Marketing');

-- ---------------------------------------------------------------------------
-- Xem / review
-- ---------------------------------------------------------------------------
select tests.authenticate_as('hue@mita.test');
select is((select count(*)::int from daily_plans where user_id = get_user_id('long@mita.test')), 0, 'Staff team khác không thấy kế hoạch');
select throws_ok($$ select fn_day_detail(tests.get_user_id('long@mita.test'), '2026-09-29') $$, '42501', null,
  'Staff không xem chi tiết ngày của người khác');
select throws_ok($$ select fn_review_plan((select id from daily_plans limit 1)) $$, '42501', null, 'Staff không review');
select tests.authenticate_as('mai@mita.test');
select is((select count(*)::int from fn_team_day('2026-09-29') where plan_id is not null), 2, 'Lead thấy kế hoạch của team');
select lives_ok(
  $$ select fn_review_plan((select id from daily_plans where user_id = tests.get_user_id('long@mita.test')), 'Ưu tiên báo giá') $$,
  'Lead bấm Đã xem + phản hồi'
);
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('long@mita.test') and type = 'plan_review'),
  'Nhân viên nhận phản hồi');

-- ---------------------------------------------------------------------------
-- Báo cáo cuối ngày
-- ---------------------------------------------------------------------------
select tests.authenticate_as('long@mita.test');
select throws_ok($$ select fn_submit_daily_report('[]') $$, '22023', null, 'Chưa đến 16:00 thì chưa báo cáo');
select tests.set_now('2026-09-29 16:30+07');
select throws_ok(
  $$ select fn_submit_daily_report((
       select jsonb_agg(jsonb_build_object('plan_item_id', id, 'result', 'partial'))
       from daily_plan_items where removed_reason is null)) $$,
  '22023', null, 'Chưa xong mà không ghi lý do → lỗi'
);
select lives_ok(
  $$ select fn_submit_daily_report(
       (select jsonb_agg(jsonb_build_object(
          'plan_item_id', id,
          'result', case when title = 'Gọi 10 khách cũ' then 'done' when title = 'Ghé quán Cộng' then 'not_done' else 'partial' end,
          'reason', 'Khách hẹn lại'))
        from daily_plan_items where removed_reason is null),
       '{"sales_domestic":{"visits":2}}', 'Thiếu mẫu', 'Duyệt giá sỉ', null) $$,
  'Nộp báo cáo'
);
select is((select status::text from daily_reports where user_id = auth.uid()), 'on_time', 'Trước 17:30 → đúng giờ');
select is((select status::text from tasks where title = 'Gọi 10 khách cũ'), 'review', 'Hoàn thành → task sang Chờ duyệt');
select throws_ok($$ select fn_submit_daily_report('[]') $$, '23505', null, 'NT3: báo cáo đã nộp bị khóa');
select throws_ok($$ update daily_reports set blockers = 'sửa' where user_id = auth.uid() $$, '42501', null,
  'NT3: không sửa trực tiếp báo cáo');
select lives_ok(
  $$ insert into report_amendments (report_id, body) values ((select id from daily_reports where user_id = auth.uid()), 'Bổ sung: đã gọi thêm 2 khách') $$,
  'NT3: chỉ thêm Bổ sung'
);
select throws_ok($$ delete from report_amendments $$, '42501', null, 'Không xóa bổ sung');

select tests.set_now('2026-09-29 17:45+07');
select tests.authenticate_as('kien@mita.test');
select lives_ok(
  $$ select fn_submit_daily_report((select jsonb_agg(jsonb_build_object('plan_item_id', i.id, 'result', 'done'))
       from daily_plan_items i join daily_plans p on p.id = i.plan_id where p.user_id = auth.uid())) $$,
  'Kiên báo cáo 17:45'
);
select is((select status::text from daily_reports where user_id = auth.uid()), 'late', 'Sau 17:30 → Trễ');

-- Cuối ngày: người chưa báo cáo → Bỏ lỡ (hue đã bị từ chối nghỉ ngày 30, ngày 29 vẫn phải nộp)
select tests.clear_authentication();
select is((fn_job_close_day('2026-09-29') ->> 'missed')::int, 4, 'close_day gán Bỏ lỡ cho 4 người chưa nộp');
select throws_ok($$ select tests.authenticate_as('admin@mita.test'); delete from daily_reports $$, '42501', null,
  'Admin cũng không xóa được báo cáo');

-- ---------------------------------------------------------------------------
-- Ngày hôm sau: việc tồn
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select tests.set_now('2026-09-30 08:00+07');
select tests.authenticate_as('long@mita.test');
select is(
  (select count(*)::int from jsonb_array_elements(fn_plan_prefill()) e where e ->> 'source' = 'carried'), 3,
  'NT4: 3 việc chưa xong tự vào kế hoạch hôm sau (Một phần/Chưa làm)'
);
select throws_ok(
  $$ select fn_submit_daily_plan('[{"title":"A"},{"title":"B"},{"title":"C"}]') $$,
  '22023', null, 'Không được bỏ qua việc tồn'
);
select lives_ok(
  $$ select fn_submit_daily_plan((
       select jsonb_agg(e || case when e ->> 'kind' = 'visit' then '{"removed_reason":"Quán đóng cửa"}'::jsonb else '{}'::jsonb end)
       from jsonb_array_elements(fn_plan_prefill()) e
     ) || '[{"title":"Việc mới"}]'::jsonb) $$,
  'Giữ việc tồn, bỏ 1 việc có lý do'
);
select is((select carried_over_count from tasks where title = 'Gửi báo giá Highlands'), 1, 'carried_over_count tăng');

select * from finish();
rollback;
