-- =============================================================================
-- M5: Điểm tuân thủ, leo thang, báo cáo tuần, dữ liệu dashboard quản lý
-- =============================================================================

insert into public.settings (key, value, description) values
  ('weekly_report_time', '"07:30"', 'Giờ gửi email báo cáo tuần cho quản lý (thứ Hai)'),
  ('compliance_bands', '{"good":90,"warn":70}', 'Ngưỡng màu điểm tuân thủ: xanh ≥ good, vàng ≥ warn, còn lại đỏ')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Leo thang
-- -----------------------------------------------------------------------------
create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  level int not null check (level in (1, 2)),
  reason text not null,
  task_id uuid references public.tasks (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolved_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_month, level)
);
create trigger escalations_updated_at before update on public.escalations
  for each row execute function public.fn_set_updated_at();
create trigger escalations_audit after insert or update or delete on public.escalations
  for each row execute function public.fn_audit();

alter table public.escalations enable row level security;
create policy escalations_select on public.escalations for select to authenticated
  using (public.fn_can_view_user_day(user_id));
create policy escalations_admin on public.escalations for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Ghi nhận ngày lead bị mất (thống kê lý do mất theo kỳ)
alter table public.leads add column lost_at timestamptz;
create or replace function public.fn_leads_lost_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage = 'lost' and old.stage is distinct from 'lost' then
    new.lost_at := public.fn_now();
  elsif new.stage <> 'lost' then
    new.lost_at := null;
  end if;
  return new;
end;
$$;
create trigger leads_lost_at before update of stage on public.leads
  for each row execute function public.fn_leads_lost_at();

-- -----------------------------------------------------------------------------
-- Tuân thủ theo ngày (SPEC: v_compliance_daily) – 1 người, 1 khoảng ngày
--   Ngày được tính: ngày làm việc của người đó, không nghỉ đã duyệt, từ ngày kích hoạt.
--   Kế hoạch: tính các ngày trước hôm nay + hôm nay nếu đã qua hạn nộp.
--   Báo cáo, việc đến hạn: chỉ các ngày đã qua (hôm nay chưa kết thúc).
-- -----------------------------------------------------------------------------
create or replace function public.fn_compliance_days(p_user uuid, p_from date, p_to date)
returns table (
  day date,
  counted boolean,
  plan_counted boolean,
  report_counted boolean,
  plan_status text,
  report_status text,
  tasks_due int,
  tasks_done_on_time int,
  plan_items int,
  off_plan_items int
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, coalesce((p.activated_at at time zone 'Asia/Ho_Chi_Minh')::date, p.created_at::date) as since
    from public.profiles p where p.id = p_user
  ),
  days as (
    select d::date as day
    from me, generate_series(greatest(p_from, me.since), least(p_to, public.fn_today_vn()), interval '1 day') d
  ),
  base as (
    select
      d.day,
      public.fn_is_workday_for(p_user, d.day)
        and not exists (
          select 1 from public.leaves l
          where l.user_id = p_user and l.date = d.day and l.approved_at is not null
        ) as counted
    from days d
  )
  select
    b.day,
    b.counted,
    b.counted and (b.day < public.fn_today_vn()
                   or public.fn_now() > public.fn_setting_at(b.day, 'plan_deadline', '09:00')),
    b.counted and b.day < public.fn_today_vn(),
    case when dp.id is null then 'none' when dp.is_late then 'late' else 'on_time' end,
    case when r.submitted_at is null then case when r.status = 'missed' then 'missed' else 'none' end
         else r.status::text end,
    case when b.counted and b.day < public.fn_today_vn() then (
      select count(*)::int from public.tasks t
      where t.assignee_id = p_user and t.due_date = b.day
    ) else 0 end,
    case when b.counted and b.day < public.fn_today_vn() then (
      select count(*)::int from public.tasks t
      where t.assignee_id = p_user and t.due_date = b.day
        and t.completed_at is not null
        and (t.completed_at at time zone 'Asia/Ho_Chi_Minh')::date <= t.due_date
    ) else 0 end,
    coalesce((select count(*)::int from public.daily_plan_items i
              where i.plan_id = dp.id and i.removed_reason is null), 0),
    coalesce((select count(*)::int from public.daily_plan_items i
              where i.plan_id = dp.id and i.removed_reason is null and i.is_off_plan), 0)
  from base b
  left join public.daily_plans dp on dp.user_id = p_user and dp.plan_date = b.day
  left join public.daily_reports r on r.user_id = p_user and r.report_date = b.day
  order by b.day;
$$;
revoke execute on function public.fn_compliance_days(uuid, date, date) from public, anon, authenticated;

-- Điểm tuân thủ 0–100 (SPEC mục 8). Thành phần không có dữ liệu thì bỏ khỏi trọng số.
create or replace function public.fn_compliance_calc(p_user uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w jsonb := coalesce(public.fn_setting('compliance_weights'), '{"plan":30,"report":30,"tasks":30,"off_plan":10}');
  v_plan_days int; v_plan_ok int;
  v_report_days int; v_report_pts numeric;
  v_due int; v_done int;
  v_items int; v_off int;
  c_plan numeric; c_report numeric; c_tasks numeric; c_off numeric;
  v_sum numeric := 0; v_w numeric := 0;
begin
  select
    count(*) filter (where plan_counted),
    count(*) filter (where plan_counted and plan_status = 'on_time'),
    count(*) filter (where report_counted),
    coalesce(sum(case when report_status = 'on_time' then 100 when report_status = 'late' then 50 else 0 end)
             filter (where report_counted), 0),
    coalesce(sum(tasks_due), 0), coalesce(sum(tasks_done_on_time), 0),
    coalesce(sum(plan_items) filter (where counted), 0),
    coalesce(sum(off_plan_items) filter (where counted), 0)
  into v_plan_days, v_plan_ok, v_report_days, v_report_pts, v_due, v_done, v_items, v_off
  from public.fn_compliance_days(p_user, p_from, p_to);

  c_plan := case when v_plan_days > 0 then round(100.0 * v_plan_ok / v_plan_days, 1) end;
  c_report := case when v_report_days > 0 then round(v_report_pts / v_report_days, 1) end;
  c_tasks := case when v_due > 0 then round(100.0 * v_done / v_due, 1) end;
  c_off := case when v_items > 0 then round(100 - least(100, 200.0 * v_off / v_items), 1) end;

  if c_plan is not null then v_sum := v_sum + c_plan * (w ->> 'plan')::numeric; v_w := v_w + (w ->> 'plan')::numeric; end if;
  if c_report is not null then v_sum := v_sum + c_report * (w ->> 'report')::numeric; v_w := v_w + (w ->> 'report')::numeric; end if;
  if c_tasks is not null then v_sum := v_sum + c_tasks * (w ->> 'tasks')::numeric; v_w := v_w + (w ->> 'tasks')::numeric; end if;
  if c_off is not null then v_sum := v_sum + c_off * (w ->> 'off_plan')::numeric; v_w := v_w + (w ->> 'off_plan')::numeric; end if;

  return jsonb_build_object(
    'score', case when v_w > 0 then round(v_sum / v_w, 1) end,
    'plan', c_plan, 'report', c_report, 'tasks', c_tasks, 'off_plan', c_off,
    'plan_days', v_plan_days, 'report_days', v_report_days,
    'tasks_due', v_due, 'tasks_done_on_time', v_done,
    'plan_items', v_items, 'off_plan_items', v_off
  );
end;
$$;
revoke execute on function public.fn_compliance_calc(uuid, date, date) from public, anon, authenticated;

-- API: điểm của 1 người (chính mình, thành viên team, hoặc manager xem tất cả)
create or replace function public.fn_compliance_score(p_user uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fn_can_view_user_day(p_user) then
    raise exception 'Bạn không có quyền xem điểm tuân thủ này' using errcode = '42501';
  end if;
  return public.fn_compliance_calc(p_user, p_from, p_to);
end;
$$;

-- Người thuộc diện tính tuân thủ mà người gọi xem được
create or replace function public.fn_compliance_people()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.is_active
    and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text
    and public.fn_can_view_user_day(p.id);
$$;

create or replace function public.fn_compliance_scores(p_from date, p_to date)
returns table (
  user_id uuid, full_name text, email text, avatar_url text, teams text[],
  score numeric, plan numeric, report numeric, tasks numeric, off_plan numeric, detail jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.avatar_url,
         array(select ut.team_id from public.user_teams ut where ut.user_id = p.id order by ut.team_id),
         (c ->> 'score')::numeric, (c ->> 'plan')::numeric, (c ->> 'report')::numeric,
         (c ->> 'tasks')::numeric, (c ->> 'off_plan')::numeric, c
  from public.profiles p
  cross join lateral (select public.fn_compliance_calc(p.id, p_from, p_to) as c) x
  where p.id in (select public.fn_compliance_people())
  order by (c ->> 'score')::numeric nulls last, p.full_name;
$$;

-- Xu hướng: điểm từng tuần (p_weeks tuần gần nhất tính đến tuần chứa p_end)
create or replace function public.fn_compliance_trend(p_weeks int default 4, p_end date default null)
returns table (user_id uuid, week_start date, score numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select (date_trunc('week', coalesce(p_end, public.fn_today_vn()))::date - 7 * g) as ws
    from generate_series(0, least(greatest(p_weeks, 1), 12) - 1) g
  )
  select u, w.ws, (public.fn_compliance_calc(u, w.ws, w.ws + 6) ->> 'score')::numeric
  from public.fn_compliance_people() u cross join w
  order by u, w.ws;
$$;

-- -----------------------------------------------------------------------------
-- Leo thang (chạy cuối ngày trong close_day)
-- -----------------------------------------------------------------------------
create or replace function public.fn_violation_count(p_user uuid, p_month date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
      (case when plan_status = 'late' then 1 else 0 end)
    + (case when report_status in ('late', 'missed') then 1 else 0 end)), 0)::int
  from public.fn_compliance_days(p_user, p_month, (p_month + interval '1 month' - interval '1 day')::date)
  where counted;
$$;
revoke execute on function public.fn_violation_count(uuid, date) from public, anon, authenticated;

create or replace function public.fn_check_escalations(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_date)::date;
  t jsonb := coalesce(public.fn_setting('escalation_thresholds'), '{"level1":3,"level2":5}');
  v_l1 int := (t ->> 'level1')::int;
  v_l2 int := (t ->> 'level2')::int;
  v_user record;
  v_n int;
  v_lead uuid;
  v_task uuid;
  v_created int := 0;
  v_mgr uuid;
  v_label text := to_char(v_month, 'MM/YYYY');
begin
  for v_user in
    select p.id, coalesce(p.full_name, p.email) as name
    from public.profiles p
    where p.is_active
      and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text
  loop
    v_n := public.fn_violation_count(v_user.id, v_month);

    if v_n >= v_l1 and not exists (
      select 1 from public.escalations where user_id = v_user.id and period_month = v_month and level = 1
    ) then
      select l into v_lead from public.fn_leads_of(v_user.id) l limit 1;
      if v_lead is null then
        select id into v_lead from public.profiles
        where is_active and role in ('manager', 'admin') and id <> v_user.id order by role desc limit 1;
      end if;
      v_task := null;
      if v_lead is not null then
        perform set_config('app.system', 'on', true);
        insert into public.tasks (title, description, team_id, assignee_id, status, priority, due_date, is_sensitive)
        values (
          'Gặp 1-1 với ' || v_user.name,
          v_user.name || ' đã trễ/bỏ lỡ ' || v_n || ' lần trong tháng ' || v_label
            || ' (kế hoạch trễ + báo cáo trễ + báo cáo bỏ lỡ). Trao đổi nguyên nhân và thống nhất cách cải thiện.',
          public.fn_primary_team(v_user.id), v_lead, 'todo', 'high', p_date + 2, true
        )
        returning id into v_task;
        perform set_config('app.system', '', true);
      end if;
      insert into public.escalations (user_id, period_month, level, reason, task_id)
      values (v_user.id, v_month, 1, v_n || ' lần trễ/bỏ lỡ trong tháng ' || v_label, v_task);
      perform public.fn_notify_user(v_user.id, 'escalation', 'Nhắc nhở kỷ luật tháng ' || v_label,
        'Bạn đã trễ/bỏ lỡ ' || v_n || ' lần. Trưởng nhóm sẽ hẹn gặp 1-1.', '/bao-cao', true, true);
      v_created := v_created + 1;
    end if;

    if v_n >= v_l2 and not exists (
      select 1 from public.escalations where user_id = v_user.id and period_month = v_month and level = 2
    ) then
      insert into public.escalations (user_id, period_month, level, reason)
      values (v_user.id, v_month, 2, v_n || ' lần trễ/bỏ lỡ trong tháng ' || v_label);
      for v_mgr in select id from public.profiles where is_active and role in ('manager', 'admin') loop
        perform public.fn_notify_user(v_mgr, 'escalation', 'Leo thang cấp 2: ' || v_user.name,
          v_n || ' lần trễ/bỏ lỡ trong tháng ' || v_label, '/quan-ly', true, true);
      end loop;
      v_created := v_created + 1;
    end if;
  end loop;
  return jsonb_build_object('created', v_created);
end;
$$;
revoke execute on function public.fn_check_escalations(date) from public, anon, authenticated;

create or replace function public.fn_resolve_escalation(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.escalations;
begin
  perform public.fn_require_active_user();
  select * into e from public.escalations where id = p_id;
  if not found or e.user_id = auth.uid()
     or not (public.fn_is_manager() or public.fn_is_lead_of_user(e.user_id)) then
    raise exception 'Bạn không có quyền xử lý leo thang này' using errcode = '42501';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Cần ghi kết quả xử lý' using errcode = '22023';
  end if;
  update public.escalations
  set resolved_by = auth.uid(), resolved_at = public.fn_now(), resolved_note = trim(p_note)
  where id = p_id;
end;
$$;

-- close_day: gán Bỏ lỡ + kiểm tra leo thang
create or replace function public.fn_job_close_day(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.daily_reports (user_id, report_date, submitted_at, status)
  select u.id, p_date, null, 'missed'
  from public.fn_required_users(p_date) u
  where not exists (select 1 from public.daily_reports r where r.user_id = u.id and r.report_date = p_date)
  on conflict (user_id, report_date) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('missed', v_count, 'escalations', public.fn_check_escalations(p_date) -> 'created');
end;
$$;

-- -----------------------------------------------------------------------------
-- Báo cáo tuần + gửi điểm tuân thủ (thứ Hai)
-- -----------------------------------------------------------------------------

-- 10000000 → "10.000.000đ"
create or replace function public.fn_fmt_vnd(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(trim(to_char(round(coalesce(p, 0)), 'FM999G999G999G990')), ',', '.') || 'đ';
$$;
create or replace function public.fn_sales_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lf as (
    select * from public.leads
    where created_at >= public.fn_vn_at(p_from, '00:00') and created_at < public.fn_vn_at(p_to + 1, '00:00')
  ),
  ord as (
    select * from public.orders where status in ('confirmed', 'delivered')
  )
  select jsonb_build_object(
    'new_leads', (select count(*) from lf),
    'contacted_in_sla', (select count(*) from lf where first_contacted_at is not null and first_contacted_at <= first_contact_due_at),
    'sla_due', (select count(*) from lf where first_contact_due_at <= public.fn_now() or first_contacted_at is not null),
    'overdue_now', (select count(*) from public.leads
                    where first_contacted_at is null and first_contact_due_at < public.fn_now()
                      and stage not in ('won', 'lost')),
    'won', (select count(*) from public.leads
            where won_at >= public.fn_vn_at(p_from, '00:00') and won_at < public.fn_vn_at(p_to + 1, '00:00')),
    'lost', (select count(*) from public.leads
             where lost_at >= public.fn_vn_at(p_from, '00:00') and lost_at < public.fn_vn_at(p_to + 1, '00:00')),
    'revenue', (select coalesce(sum(total_value_vnd), 0) from ord where order_date between p_from and p_to),
    'revenue_month', (select coalesce(sum(total_value_vnd), 0) from ord
                      where order_date >= date_trunc('month', p_to)::date and order_date <= p_to),
    'kpi_month', coalesce((public.fn_setting('kpi_monthly_revenue_vnd'))::numeric, 150000000),
    'pipeline', coalesce((select jsonb_agg(jsonb_build_object('stage', s, 'count', n, 'value', v) order by ord_s)
      from (
        select l.stage::text as s, array_position(enum_range(null::public.lead_stage), l.stage) as ord_s,
               count(*) as n, coalesce(sum(l.est_value_vnd), 0) as v
        from public.leads l where l.stage not in ('won', 'lost') group by l.stage
      ) x), '[]'::jsonb),
    'lost_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', r, 'count', n) order by n desc, r)
      from (
        select trim(lost_reason) as r, count(*) as n from public.leads
        where lost_at >= public.fn_vn_at(p_from, '00:00') and lost_at < public.fn_vn_at(p_to + 1, '00:00')
        group by trim(lost_reason) order by count(*) desc limit 5
      ) x), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source', s, 'count', n) order by n desc)
      from (select coalesce(source, 'Khác') as s, count(*) as n from lf group by 1) x), '[]'::jsonb)
  );
$$;
revoke execute on function public.fn_sales_summary(date, date) from public, anon, authenticated;

create or replace function public.fn_job_weekly_report(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('week', p_date)::date - 7;
  v_to date := v_from + 6;
  s jsonb := public.fn_sales_summary(v_from, v_to);
  v_people text;
  v_goals text;
  v_body text;
  v_mgr uuid;
  v_sent int := 0;
begin
  select string_agg(format('• %s: %s điểm (KH %s · BC %s · Việc %s)',
           coalesce(p.full_name, p.email),
           coalesce((c ->> 'score'), '—'), coalesce(c ->> 'plan', '—'),
           coalesce(c ->> 'report', '—'), coalesce(c ->> 'tasks', '—')), E'\n'
           order by (c ->> 'score')::numeric nulls last)
    into v_people
  from public.profiles p
  cross join lateral (select public.fn_compliance_calc(p.id, v_from, v_to) as c) x
  where p.is_active
    and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text;

  select string_agg(format('• [%s] %s: %s/%s %s', upper(g.team_id), g.title,
           coalesce(public.fn_goal_actual(g.id)::text, '—'), g.target, coalesce(g.unit, '')), E'\n')
    into v_goals
  from public.weekly_goals g where g.week_start = v_from;

  v_body := concat_ws(E'\n',
    'Tuần ' || to_char(v_from, 'DD/MM') || ' – ' || to_char(v_to, 'DD/MM/YYYY'),
    '',
    'DOANH SỐ',
    '• Tuần: ' || public.fn_fmt_vnd((s ->> 'revenue')::numeric),
    '• Tháng đến nay: ' || public.fn_fmt_vnd((s ->> 'revenue_month')::numeric) || ' / KPI '
      || public.fn_fmt_vnd((s ->> 'kpi_month')::numeric),
    '',
    'LEAD',
    '• Lead mới: ' || (s ->> 'new_leads') || ' · liên hệ đúng SLA: ' || (s ->> 'contacted_in_sla')
      || ' · chốt: ' || (s ->> 'won') || ' · mất: ' || (s ->> 'lost'),
    '• Đang quá SLA: ' || (s ->> 'overdue_now'),
    '',
    'TUÂN THỦ',
    coalesce(v_people, '(không có dữ liệu)'),
    '',
    'MỤC TIÊU TUẦN',
    coalesce(v_goals, '(chưa có mục tiêu)'));

  for v_mgr in select id from public.profiles where is_active and role in ('manager', 'admin') loop
    perform public.fn_notify_user(v_mgr, 'weekly_report',
      'Báo cáo tuần ' || to_char(v_from, 'DD/MM') || ' – ' || to_char(v_to, 'DD/MM'),
      v_body, '/quan-ly?mode=week&date=' || v_to, true);
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('recipients', v_sent);
end;
$$;

-- weekly_kickoff: như M2 + gửi mỗi người điểm tuân thủ tuần trước
create or replace function public.fn_job_weekly_kickoff(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := p_date - (extract(isodow from p_date)::int - 1);
  v_closed int;
  v_lead record;
  v_reminded int := 0;
  v_user record;
  v_scores int := 0;
  c jsonb;
begin
  update public.weekly_goals g
  set status = case
    when coalesce(public.fn_goal_actual(g.id), 0) >= g.target then 'achieved'
    else 'missed' end::public.goal_status
  where g.week_start < v_week and g.status = 'open';
  get diagnostics v_closed = row_count;

  for v_lead in
    select distinct ut.user_id, ut.team_id
    from public.user_teams ut
    join public.profiles p on p.id = ut.user_id and p.is_active and p.role = 'lead'
    where ut.is_lead
      and ut.team_id in ('sales_domestic', 'marketing')
      and not exists (
        select 1 from public.weekly_goals g where g.team_id = ut.team_id and g.week_start = v_week
      )
  loop
    perform public.fn_notify_user(v_lead.user_id, 'weekly_goal_reminder',
      'Lập mục tiêu tuần ' || to_char(v_week, 'DD/MM') || ' cho team ' ||
        (select name from public.teams where id = v_lead.team_id),
      'Team chưa có mục tiêu tuần này.', '/muc-tieu', true);
    v_reminded := v_reminded + 1;
  end loop;

  for v_user in
    select p.id from public.profiles p
    where p.is_active
      and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text
  loop
    c := public.fn_compliance_calc(v_user.id, v_week - 7, v_week - 1);
    if c ->> 'score' is not null then
      perform public.fn_notify_user(v_user.id, 'weekly_score',
        'Điểm tuân thủ tuần trước: ' || (c ->> 'score'),
        format('Kế hoạch %s · Báo cáo %s · Việc đúng hạn %s · Trong kế hoạch %s',
          coalesce(c ->> 'plan', '—'), coalesce(c ->> 'report', '—'),
          coalesce(c ->> 'tasks', '—'), coalesce(c ->> 'off_plan', '—')),
        '/bao-cao', true);
      v_scores := v_scores + 1;
    end if;
  end loop;

  return jsonb_build_object('closed', v_closed, 'reminded', v_reminded, 'scores', v_scores);
end;
$$;

create or replace function public.fn_job_schedule(p_date date)
returns table (job text, due_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'remind_plan', public.fn_setting_at(p_date, 'plan_reminder_time', '08:30')
  union all
  select 'summary_morning', public.fn_setting_at(p_date, 'plan_deadline', '09:00')
    + make_interval(mins => coalesce((public.fn_setting('summary_morning_delay_minutes'))::int, 15))
  union all
  select 'remind_report', public.fn_setting_at(p_date, 'report_reminder_time', '17:00')
  union all
  select 'summary_evening', public.fn_setting_at(p_date, 'summary_evening_time', '18:00')
  union all
  select 'close_day', public.fn_setting_at(p_date, 'report_missed_at', '23:59')
  union all
  select 'weekly_kickoff', public.fn_setting_at(p_date, 'weekly_kickoff_time', '08:00')
  where extract(isodow from p_date) = 1
  union all
  select 'weekly_report', public.fn_setting_at(p_date, 'weekly_report_time', '07:30')
  where extract(isodow from p_date) = 1
  union all
  select 'followup_due', public.fn_setting_at(p_date, 'followup_time', '08:00')
  where public.fn_is_workday(p_date)
  union all
  select 'lead_sla_check:' || lpad(h::text, 2, '0'), public.fn_vn_at(p_date, lpad(h::text, 2, '0') || ':00')
  from generate_series(
    coalesce((public.fn_setting('lead_sla_check_hours') ->> 'from')::int, 8),
    coalesce((public.fn_setting('lead_sla_check_hours') ->> 'to')::int, 18)
  ) h
  where public.fn_is_workday(p_date);
$$;

create or replace function public.fn_run_job(p_job text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_job like 'lead_sla_check:%' then
    return public.fn_job_lead_sla_check(p_date);
  end if;
  return case p_job
    when 'remind_plan' then public.fn_job_remind_plan(p_date)
    when 'summary_morning' then public.fn_job_summary_morning(p_date)
    when 'remind_report' then public.fn_job_remind_report(p_date)
    when 'summary_evening' then public.fn_job_summary_evening(p_date)
    when 'close_day' then public.fn_job_close_day(p_date)
    when 'weekly_kickoff' then public.fn_job_weekly_kickoff(p_date)
    when 'weekly_report' then public.fn_job_weekly_report(p_date)
    when 'followup_due' then public.fn_job_followup_due(p_date)
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dữ liệu dashboard (phạm vi: manager/admin tất cả; lead thành viên team mình)
-- -----------------------------------------------------------------------------
create or replace function public.fn_require_dashboard()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.fn_require_active_user();
  if public.fn_my_role() = 'staff' then
    raise exception 'Chỉ trưởng nhóm/quản lý xem dashboard' using errcode = '42501';
  end if;
end;
$$;

-- Khối 1: từng người trong ngày
create or replace function public.fn_dashboard_people(p_date date default null)
returns table (
  user_id uuid, full_name text, email text, avatar_url text, role public.role_enum, teams text[],
  plan_required boolean, leave_type public.leave_type, leave_approved boolean,
  plan_id uuid, plan_submitted_at timestamptz, plan_is_late boolean, plan_reviewed_at timestamptz,
  report_id uuid, report_status public.report_status, report_submitted_at timestamptz, report_reviewed_at timestamptz,
  tasks_due int, tasks_overdue int, last_checkin_at timestamptz, last_checkin_place text, checkins int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date := coalesce(p_date, public.fn_today_vn());
begin
  perform public.fn_require_dashboard();
  return query
  select
    p.id, p.full_name, p.email, p.avatar_url, p.role,
    array(select ut.team_id from public.user_teams ut where ut.user_id = p.id order by ut.team_id),
    public.fn_plan_required(p.id, d),
    l.type, l.approved_at is not null,
    dp.id, dp.submitted_at, dp.is_late, dp.reviewed_at,
    r.id, r.status, r.submitted_at, r.reviewed_at,
    (select count(*)::int from public.tasks t where t.assignee_id = p.id and t.due_date = d and t.status <> 'done'),
    (select count(*)::int from public.tasks t where t.assignee_id = p.id and t.due_date < d and t.status <> 'done'),
    ci.checked_in_at, ci.place_name,
    (select count(*)::int from public.check_ins c
      where c.user_id = p.id and c.checked_in_at >= public.fn_vn_at(d, '00:00') and c.checked_in_at < public.fn_vn_at(d + 1, '00:00'))
  from public.profiles p
  left join public.leaves l on l.user_id = p.id and l.date = d and l.rejected_at is null
  left join public.daily_plans dp on dp.user_id = p.id and dp.plan_date = d
  left join public.daily_reports r on r.user_id = p.id and r.report_date = d
  left join lateral (
    select c.checked_in_at, c.place_name from public.check_ins c
    where c.user_id = p.id and c.checked_in_at < public.fn_vn_at(d + 1, '00:00')
    order by c.checked_in_at desc limit 1
  ) ci on true
  where p.is_active and p.id <> auth.uid()
    and (public.fn_is_manager() or public.fn_is_lead_of_user(p.id))
  order by p.full_name;
end;
$$;

-- Khối 2: chờ tôi xử lý
create or replace function public.fn_dashboard_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since date := public.fn_today_vn() - 7;
  v_me uuid := auth.uid();
begin
  perform public.fn_require_dashboard();
  return jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', dp.id, 'user_id', dp.user_id,
        'name', coalesce(p.full_name, p.email), 'date', dp.plan_date, 'is_late', dp.is_late) order by dp.plan_date desc)
      from public.daily_plans dp join public.profiles p on p.id = dp.user_id
      where dp.plan_date >= v_since and dp.reviewed_at is null and dp.user_id <> v_me
        and (public.fn_is_manager() or public.fn_is_lead_of_user(dp.user_id))), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id,
        'name', coalesce(p.full_name, p.email), 'date', r.report_date, 'status', r.status) order by r.report_date desc)
      from public.daily_reports r join public.profiles p on p.id = r.user_id
      where r.report_date >= v_since and r.submitted_at is not null and r.reviewed_at is null and r.user_id <> v_me
        and (public.fn_is_manager() or public.fn_is_lead_of_user(r.user_id))), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id,
        'name', coalesce(p.full_name, p.email), 'date', r.report_date, 'text', r.need_decision) order by r.report_date desc)
      from public.daily_reports r join public.profiles p on p.id = r.user_id
      where r.report_date >= v_since and r.need_decision is not null and r.reviewed_at is null and r.user_id <> v_me
        and (public.fn_is_manager() or public.fn_is_lead_of_user(r.user_id))), '[]'::jsonb),
    'tasks_review', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title,
        'assignee_id', t.assignee_id, 'name', coalesce(p.full_name, p.email), 'due_date', t.due_date) order by t.updated_at)
      from public.tasks t left join public.profiles p on p.id = t.assignee_id
      where t.status = 'review' and t.assignee_id is distinct from v_me and public.fn_can_manage_task(t.team_id)), '[]'::jsonb),
    'library_pending', (select count(*) from public.library_items li
      where li.status = 'pending' and li.uploaded_by is distinct from v_me
        and public.fn_can_approve_library(li.shared_drive)),
    'leaves_pending', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'user_id', l.user_id,
        'name', coalesce(p.full_name, p.email), 'date', l.date, 'type', l.type) order by l.date)
      from public.leaves l join public.profiles p on p.id = l.user_id
      where l.approved_at is null and l.rejected_at is null and l.user_id <> v_me
        and (public.fn_is_manager() or public.fn_is_lead_of_user(l.user_id))), '[]'::jsonb),
    'escalations', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'user_id', e.user_id,
        'name', coalesce(p.full_name, p.email), 'level', e.level, 'reason', e.reason,
        'period_month', e.period_month, 'task_id', e.task_id) order by e.level desc, e.created_at)
      from public.escalations e join public.profiles p on p.id = e.user_id
      where e.resolved_at is null and e.user_id <> v_me
        and (public.fn_is_manager() or public.fn_is_lead_of_user(e.user_id))), '[]'::jsonb)
  );
end;
$$;

-- Khối 4: Sales (manager, admin, trưởng nhóm Sale)
create or replace function public.fn_dashboard_sales(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.fn_require_active_user();
  if not public.fn_can_read_all_sales() then
    raise exception 'Bạn không có quyền xem số liệu Sales' using errcode = '42501';
  end if;
  return public.fn_sales_summary(p_from, p_to);
end;
$$;

revoke execute on function public.fn_job_weekly_report(date) from public, anon, authenticated;
revoke execute on function public.fn_job_weekly_kickoff(date) from public, anon, authenticated;
revoke execute on function public.fn_job_close_day(date) from public, anon, authenticated;
revoke execute on function public.fn_job_schedule(date) from public, anon, authenticated;
revoke execute on function public.fn_run_job(text, date) from public, anon, authenticated;
