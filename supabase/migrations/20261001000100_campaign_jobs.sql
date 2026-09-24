-- =============================================================================
-- Chiến dịch trong các job tự động
--   • Báo cáo tuần (thứ Hai, quản lý): thêm mục CHIẾN DỊCH – tiến độ + mốc trễ.
--   • weekly_kickoff: không nhắc "lập mục tiêu tuần" nếu team đã có mốc chiến dịch
--     tuần này; báo mỗi người phụ trách các mốc của họ trong tuần.
--   • close_day: mốc đến hạn hôm nay mà chưa xong → báo người phụ trách + người lập.
-- =============================================================================

-- Tóm tắt chiến dịch cho email (dùng chung)
create or replace function public.fn_campaigns_digest(p_from date, p_to date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select string_agg(line, E'\n' order by ord)
  from (
    select 1 as ord, c.start_date,
      format('• [%s] %s: %s/%s mốc xong%s', upper(c.team_id), c.title,
        count(m.id) filter (where m.done_at is not null), count(m.id),
        case when count(m.id) filter (where m.done_at is null and m.due_date < p_to + 1) > 0
             then ' · ' || count(m.id) filter (where m.done_at is null and m.due_date < p_to + 1) || ' mốc trễ'
             else '' end) as line
    from public.campaigns c
    left join public.campaign_milestones m on m.campaign_id = c.id
    where c.status in ('planning', 'active') and c.start_date <= p_to and c.end_date >= p_from
    group by c.id
    union all
    select 2, null, format('   – Trễ: %s (%s) – hạn %s', m.title, c.title, to_char(m.due_date, 'DD/MM'))
    from public.campaign_milestones m join public.campaigns c on c.id = m.campaign_id
    where c.status in ('planning', 'active') and m.done_at is null and m.due_date <= p_to
  ) x;
$$;
revoke execute on function public.fn_campaigns_digest(date, date) from public, anon, authenticated;

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
  v_campaigns text := public.fn_campaigns_digest(v_from, v_to);
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
    coalesce(v_goals, '(chưa có mục tiêu)'),
    '',
    'CHIẾN DỊCH',
    coalesce(v_campaigns, '(không có chiến dịch đang chạy)'));

  for v_mgr in select id from public.profiles where is_active and role in ('manager', 'admin') loop
    perform public.fn_notify_user(v_mgr, 'weekly_report',
      'Báo cáo tuần ' || to_char(v_from, 'DD/MM') || ' – ' || to_char(v_to, 'DD/MM'),
      v_body, '/quan-ly?mode=week&date=' || v_to, true);
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('recipients', v_sent);
end;
$$;

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
  v_owner record;
  v_owners int := 0;
  c jsonb;
begin
  update public.weekly_goals g
  set status = case
    when coalesce(public.fn_goal_actual(g.id), 0) >= g.target then 'achieved'
    else 'missed' end::public.goal_status
  where g.week_start < v_week and g.status = 'open';
  get diagnostics v_closed = row_count;

  -- Nhắc lập mục tiêu: team chưa có mục tiêu tuần VÀ chưa có mốc chiến dịch nào trong tuần
  for v_lead in
    select distinct ut.user_id, ut.team_id
    from public.user_teams ut
    join public.profiles p on p.id = ut.user_id and p.is_active and p.role = 'lead'
    where ut.is_lead
      and ut.team_id in ('sales_domestic', 'marketing')
      and not exists (
        select 1 from public.weekly_goals g where g.team_id = ut.team_id and g.week_start = v_week
      )
      and not exists (
        select 1 from public.campaign_milestones m join public.campaigns cp on cp.id = m.campaign_id
        where cp.team_id = ut.team_id and cp.status in ('planning', 'active') and m.week_start = v_week
      )
  loop
    perform public.fn_notify_user(v_lead.user_id, 'weekly_goal_reminder',
      'Lập mục tiêu tuần ' || to_char(v_week, 'DD/MM') || ' cho team ' ||
        (select name from public.teams where id = v_lead.team_id),
      'Team chưa có mục tiêu tuần hoặc mốc chiến dịch nào tuần này.', '/muc-tieu', true);
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

  -- Người phụ trách mốc: danh sách mốc của họ trong tuần
  for v_owner in
    select m.owner_id,
           count(*) as n,
           string_agg(format('• %s (%s) – hạn %s', m.title, cp.title, to_char(m.due_date, 'DD/MM')),
                      E'\n' order by m.due_date, m.position) as body
    from public.campaign_milestones m
    join public.campaigns cp on cp.id = m.campaign_id
    join public.profiles p on p.id = m.owner_id and p.is_active
    where m.week_start = v_week and m.done_at is null and cp.status in ('planning', 'active')
    group by m.owner_id
  loop
    perform public.fn_notify_user(v_owner.owner_id, 'campaign_week',
      'Tuần này bạn phụ trách ' || v_owner.n || ' mốc chiến dịch', v_owner.body,
      '/muc-tieu?tab=campaigns', true);
    v_owners := v_owners + 1;
  end loop;

  return jsonb_build_object('closed', v_closed, 'reminded', v_reminded, 'scores', v_scores,
                            'milestone_owners', v_owners);
end;
$$;

create or replace function public.fn_job_close_day(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_late record;
  v_late_n int := 0;
  v_to uuid;
begin
  insert into public.daily_reports (user_id, report_date, submitted_at, status)
  select u.id, p_date, null, 'missed'
  from public.fn_required_users(p_date) u
  where not exists (select 1 from public.daily_reports r where r.user_id = u.id and r.report_date = p_date)
  on conflict (user_id, report_date) do nothing;
  get diagnostics v_count = row_count;

  -- Mốc đến hạn hôm nay mà chưa xong (mỗi mốc báo 1 lần, đúng ngày hạn)
  for v_late in
    select m.id, m.title, m.owner_id, cp.id as campaign_id, cp.title as campaign_title,
           coalesce(cp.owner_id, cp.created_by) as campaign_owner
    from public.campaign_milestones m join public.campaigns cp on cp.id = m.campaign_id
    where m.due_date = p_date and m.done_at is null and cp.status in ('planning', 'active')
  loop
    foreach v_to in array array_remove(array[v_late.owner_id,
        case when v_late.campaign_owner is distinct from v_late.owner_id then v_late.campaign_owner end], null)
    loop
      perform public.fn_notify_user(v_to, 'milestone_late',
        'Mốc "' || v_late.title || '" đã quá hạn',
        'Chiến dịch "' || v_late.campaign_title || '" – mốc đến hạn ' || to_char(p_date, 'DD/MM') || ' chưa xong.',
        '/muc-tieu?tab=campaigns&c=' || v_late.campaign_id, true);
    end loop;
    v_late_n := v_late_n + 1;
  end loop;

  return jsonb_build_object('missed', v_count,
    'escalations', public.fn_check_escalations(p_date) -> 'created',
    'late_milestones', v_late_n);
end;
$$;

revoke execute on function public.fn_job_weekly_report(date) from public, anon, authenticated;
revoke execute on function public.fn_job_weekly_kickoff(date) from public, anon, authenticated;
revoke execute on function public.fn_job_close_day(date) from public, anon, authenticated;
