-- =============================================================================
-- Công tắc tạm ẩn "Kế hoạch hôm nay" + "Báo cáo cuối ngày" (settings.daily_enabled).
-- Tắt (false): không ai bị cổng kế hoạch chặn, không nhắc/tóm tắt kế hoạch–báo cáo,
-- không gán "Bỏ lỡ", không leo thang; điểm tuân thủ chỉ còn "Việc đúng hạn".
-- Dữ liệu cũ giữ nguyên; bật lại (true) là chạy như trước.
-- =============================================================================

insert into public.settings (key, value, description) values
  ('daily_enabled', 'false',
    'Bật/tắt Kế hoạch hôm nay + Báo cáo cuối ngày (false = tạm ẩn: không chặn, không nhắc, không tính điểm)')
on conflict (key) do nothing;

create or replace function public.fn_daily_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((public.fn_setting('daily_enabled'))::boolean, true);
$$;
revoke execute on function public.fn_daily_enabled() from public, anon, authenticated;

-- Điểm chung cho cổng, nhắc, tóm tắt, "Bỏ lỡ" (qua fn_required_users) và dashboard
create or replace function public.fn_plan_required(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_daily_enabled()
  and exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.is_active
      and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text
  )
  and public.fn_is_workday_for(p_user, p_date)
  and not public.fn_has_leave(p_user, p_date);
$$;
revoke execute on function public.fn_plan_required(uuid, date) from public, anon, authenticated;

-- Tắt → không đếm vi phạm kế hoạch/báo cáo (không leo thang)
create or replace function public.fn_violation_count(p_user uuid, p_month date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.fn_daily_enabled() then 0 else coalesce(sum(
      (case when plan_status = 'late' then 1 else 0 end)
    + (case when report_status in ('late', 'missed') then 1 else 0 end)), 0)::int end
  from public.fn_compliance_days(p_user, p_month, (p_month + interval '1 month' - interval '1 day')::date)
  where counted;
$$;
revoke execute on function public.fn_violation_count(uuid, date) from public, anon, authenticated;

-- Tắt → bỏ thành phần Kế hoạch, Báo cáo, Trong kế hoạch khỏi điểm (chỉ còn Việc đúng hạn)
create or replace function public.fn_compliance_calc(p_user uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w jsonb := coalesce(public.fn_setting('compliance_weights'), '{"plan":30,"report":30,"tasks":30,"off_plan":10}');
  v_daily boolean := public.fn_daily_enabled();
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

  if not v_daily then
    v_plan_days := 0; v_report_days := 0; v_items := 0; v_off := 0;
  end if;

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
