-- Chiến dịch trong job tự động: báo cáo tuần, nhắc thứ Hai, mốc trễ hạn
begin;
set local search_path = public, extensions, tests;
select plan(9);

select tests.seed_roster();
select tests.set_now('2026-10-12 08:00+07');

select tests.authenticate_as('trang@mita.test');
insert into campaigns (team_id, title, start_date, end_date)
values ('marketing', 'Set quà 20/10', '2026-10-05', '2026-11-01');
insert into campaign_milestones (campaign_id, title, week_start, due_date, owner_id, position)
select id, 'Chuẩn bị bao bì', '2026-10-05', '2026-10-10', get_user_id('trang@mita.test'), 1 from campaigns;
insert into campaign_milestones (campaign_id, title, week_start, due_date, done_at, position)
select id, 'Duyệt mẫu', '2026-10-05', '2026-10-09', now(), 2 from campaigns;
insert into campaign_milestones (campaign_id, title, week_start, due_date, owner_id, position)
select id, 'Tính giá bán', '2026-10-12', '2026-10-17', get_user_id('mkt@mita.test'), 3 from campaigns;
select tests.clear_authentication();

-- Báo cáo tuần 05/10 – 11/10
select is((fn_job_weekly_report('2026-10-12') ->> 'recipients')::int, 2, 'Báo cáo tuần gửi quản lý + admin');
select ok(
  exists (select 1 from outbox where recipient = 'manager@mita.test' and type = 'weekly_report'
          and body like '%CHIẾN DỊCH%' and body like '%Set quà 20/10: 1/3 mốc xong · 1 mốc trễ%'
          and body like '%Trễ: Chuẩn bị bao bì (Set quà 20/10) – hạn 10/10%'),
  'Email tuần có tiến độ chiến dịch và mốc trễ'
);

-- Thứ Hai 12/10: Marketing có mốc tuần này → không bị nhắc lập mục tiêu; Sale vẫn bị nhắc
select is((fn_job_weekly_kickoff('2026-10-12') ->> 'milestone_owners')::int, 1, 'Báo người phụ trách mốc tuần này');
select ok(
  not exists (select 1 from notifications where type = 'weekly_goal_reminder' and title like '%Marketing%'),
  'Team đã có mốc chiến dịch tuần này không bị nhắc lập mục tiêu'
);
select ok(
  exists (select 1 from notifications where type = 'weekly_goal_reminder' and title like '%Sale nội địa%'),
  'Team Sale chưa có mục tiêu vẫn được nhắc'
);
select ok(
  exists (select 1 from notifications where user_id = get_user_id('mkt@mita.test') and type = 'campaign_week'
          and body like '%Tính giá bán (Set quà 20/10) – hạn 17/10%'),
  'Người phụ trách nhận danh sách mốc của mình'
);

-- Chốt ngày 17/10: mốc "Tính giá bán" đến hạn mà chưa xong
select is((fn_job_close_day('2026-10-17') ->> 'late_milestones')::int, 1, 'close_day phát hiện 1 mốc trễ hạn');
select ok(
  exists (select 1 from notifications where user_id = get_user_id('mkt@mita.test') and type = 'milestone_late'),
  'Người phụ trách mốc được báo trễ hạn'
);
select ok(
  exists (select 1 from notifications where user_id = get_user_id('trang@mita.test') and type = 'milestone_late'
          and title like '%Tính giá bán%'),
  'Người lập chiến dịch được báo trễ hạn'
);

select * from finish();
rollback;
