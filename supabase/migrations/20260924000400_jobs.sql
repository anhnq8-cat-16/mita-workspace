-- =============================================================================
-- M1 (4/4): lịch tự động. pg_cron chạy fn_cron_tick() mỗi phút; hàm này tự so giờ
-- Việt Nam với các mốc trong settings và chạy mỗi job tối đa 1 lần/ngày
-- (bảng cron_runs). Job ghi thông báo trong app + đưa email/Chat vào outbox;
-- sau đó gọi Edge Function `notify` (qua pg_net) để gửi đi.
-- =============================================================================

create table public.cron_runs (
  job text not null,
  run_date date not null,
  ran_at timestamptz not null default now(),
  result jsonb,
  error text,
  primary key (job, run_date)
);
alter table public.cron_runs enable row level security;
create policy cron_runs_admin_select on public.cron_runs for select to authenticated
  using (public.fn_is_admin());
revoke insert, update, delete, truncate on public.cron_runs from anon, authenticated;

-- Người phải nộp kế hoạch/báo cáo trong ngày
create or replace function public.fn_required_users(p_date date)
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p
  where p.is_active and public.fn_plan_required(p.id, p_date)
  order by p.full_name;
$$;

-- Người nhận tóm tắt: manager/admin (tất cả) + lead (thành viên team mình)
-- Trả về (recipient, member) – member là người thuộc phạm vi theo dõi.
create or replace function public.fn_summary_scope(p_date date)
returns table (recipient uuid, member uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with req as (select id from public.fn_required_users(p_date))
  select m.id, req.id
  from public.profiles m cross join req
  where m.is_active and m.role in ('manager', 'admin') and m.id <> req.id
  union
  select lead.user_id, req.id
  from req
  join public.user_teams mem on mem.user_id = req.id
  join public.user_teams lead on lead.team_id = mem.team_id and lead.is_lead
  join public.profiles lp on lp.id = lead.user_id and lp.is_active and lp.role = 'lead'
  where lead.user_id <> req.id;
$$;

-- -----------------------------------------------------------------------------
-- Jobs
-- -----------------------------------------------------------------------------
create or replace function public.fn_job_remind_plan(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.profiles;
  v_count int := 0;
  v_deadline text := coalesce(public.fn_setting('plan_deadline') #>> '{}', '09:00');
begin
  for v_user in
    select * from public.fn_required_users(p_date) u
    where not exists (select 1 from public.daily_plans dp where dp.user_id = u.id and dp.plan_date = p_date)
  loop
    perform public.fn_notify_user(v_user.id, 'remind_plan', 'Nhắc: nộp kế hoạch hôm nay',
      'Hạn nộp kế hoạch là ' || v_deadline || '. Nộp sau giờ này sẽ bị tính Trễ.', '/', true, true);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('reminded', v_count);
end;
$$;

create or replace function public.fn_job_remind_report(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.profiles;
  v_count int := 0;
  v_deadline text := coalesce(public.fn_setting('report_deadline') #>> '{}', '17:30');
begin
  for v_user in
    select * from public.fn_required_users(p_date) u
    where not exists (
      select 1 from public.daily_reports r where r.user_id = u.id and r.report_date = p_date
    )
  loop
    perform public.fn_notify_user(v_user.id, 'remind_report', 'Nhắc: nộp báo cáo cuối ngày',
      'Hạn báo cáo đúng giờ là ' || v_deadline || '.', '/', true, true);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('reminded', v_count);
end;
$$;

create or replace function public.fn_job_summary_morning(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_missing text;
  v_late text;
  v_body text;
  v_sent int := 0;
  v_all_missing text;
  v_all_late text;
begin
  for v_recipient in select distinct s.recipient from public.fn_summary_scope(p_date) s loop
    select string_agg(coalesce(p.full_name, p.email), ', ' order by p.full_name)
      into v_missing
    from public.fn_summary_scope(p_date) s
    join public.profiles p on p.id = s.member
    where s.recipient = v_recipient
      and not exists (select 1 from public.daily_plans dp where dp.user_id = p.id and dp.plan_date = p_date);

    select string_agg(coalesce(p.full_name, p.email) || ' (' ||
             to_char(dp.submitted_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') || ')', ', '
             order by p.full_name)
      into v_late
    from public.fn_summary_scope(p_date) s
    join public.profiles p on p.id = s.member
    join public.daily_plans dp on dp.user_id = p.id and dp.plan_date = p_date and dp.is_late
    where s.recipient = v_recipient;

    v_body := concat_ws(E'\n',
      'Chưa nộp kế hoạch: ' || coalesce(v_missing, 'không có'),
      'Nộp trễ: ' || coalesce(v_late, 'không có'));
    perform public.fn_notify_user(v_recipient, 'summary_morning',
      'Tóm tắt kế hoạch ' || to_char(p_date, 'DD/MM/YYYY'), v_body, '/bao-cao?tab=team', true);
    v_sent := v_sent + 1;
  end loop;

  select string_agg(coalesce(u.full_name, u.email), ', ' order by u.full_name) into v_all_missing
  from public.fn_required_users(p_date) u
  where not exists (select 1 from public.daily_plans dp where dp.user_id = u.id and dp.plan_date = p_date);
  select string_agg(coalesce(u.full_name, u.email), ', ' order by u.full_name) into v_all_late
  from public.fn_required_users(p_date) u
  join public.daily_plans dp on dp.user_id = u.id and dp.plan_date = p_date and dp.is_late;

  if exists (select 1 from public.fn_required_users(p_date)) then
    perform public.fn_post_chat('summary_morning', concat_ws(E'\n',
      '*Kế hoạch ngày ' || to_char(p_date, 'DD/MM/YYYY') || '*',
      'Chưa nộp: ' || coalesce(v_all_missing, 'không có'),
      'Nộp trễ: ' || coalesce(v_all_late, 'không có')));
  end if;
  return jsonb_build_object('recipients', v_sent);
end;
$$;

create or replace function public.fn_job_summary_evening(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_submitted int;
  v_total int;
  v_missing text;
  v_done text;
  v_decisions text;
  v_blockers text;
  v_sent int := 0;
begin
  for v_recipient in select distinct s.recipient from public.fn_summary_scope(p_date) s loop
    select count(*) filter (where r.submitted_at is not null), count(*),
           string_agg(coalesce(p.full_name, p.email), ', ' order by p.full_name)
             filter (where r.submitted_at is null)
      into v_submitted, v_total, v_missing
    from public.fn_summary_scope(p_date) s
    join public.profiles p on p.id = s.member
    left join public.daily_reports r on r.user_id = p.id and r.report_date = p_date
    where s.recipient = v_recipient;

    select string_agg(x.name || ': ' || x.n, ', ' order by x.name) into v_done
    from (
      select coalesce(p.full_name, p.email) as name, count(*) as n
      from public.fn_summary_scope(p_date) s
      join public.profiles p on p.id = s.member
      join public.daily_reports r on r.user_id = p.id and r.report_date = p_date
      join public.daily_report_items ri on ri.report_id = r.id
      where s.recipient = v_recipient and ri.result = 'done'
      group by 1
    ) x;

    select string_agg('• ' || coalesce(p.full_name, p.email) || ': ' || r.need_decision, E'\n'
                      order by p.full_name)
      into v_decisions
    from public.fn_summary_scope(p_date) s
    join public.profiles p on p.id = s.member
    join public.daily_reports r on r.user_id = p.id and r.report_date = p_date and r.need_decision is not null
    where s.recipient = v_recipient;

    select string_agg('• ' || coalesce(p.full_name, p.email) || ': ' || r.blockers, E'\n'
                      order by p.full_name)
      into v_blockers
    from public.fn_summary_scope(p_date) s
    join public.profiles p on p.id = s.member
    join public.daily_reports r on r.user_id = p.id and r.report_date = p_date and r.blockers is not null
    where s.recipient = v_recipient;

    perform public.fn_notify_user(v_recipient, 'summary_evening',
      'Tóm tắt cuối ngày ' || to_char(p_date, 'DD/MM/YYYY'),
      concat_ws(E'\n',
        'Báo cáo đã nộp: ' || v_submitted || '/' || v_total,
        'Chưa nộp: ' || coalesce(v_missing, 'không có'),
        'Việc hoàn thành: ' || coalesce(v_done, 'chưa có'),
        case when v_decisions is not null then E'\nCần quản lý quyết định:\n' || v_decisions end,
        case when v_blockers is not null then E'\nVướng mắc:\n' || v_blockers end),
      '/bao-cao?tab=team', true);
    v_sent := v_sent + 1;
  end loop;

  if exists (select 1 from public.fn_required_users(p_date)) then
    perform public.fn_post_chat('summary_evening', (
      select concat_ws(E'\n',
        '*Báo cáo cuối ngày ' || to_char(p_date, 'DD/MM/YYYY') || '*',
        'Đã nộp: ' || count(r.id) || '/' || count(*),
        'Chưa nộp: ' || coalesce(string_agg(coalesce(u.full_name, u.email), ', ')
                                   filter (where r.id is null), 'không có'))
      from public.fn_required_users(p_date) u
      left join public.daily_reports r
        on r.user_id = u.id and r.report_date = p_date and r.submitted_at is not null));
  end if;
  return jsonb_build_object('recipients', v_sent);
end;
$$;

-- Cuối ngày: ai phải báo cáo mà chưa nộp → Bỏ lỡ. (Việc tồn được chuyển khi lập
-- kế hoạch ngày làm việc tiếp theo – xem fn_carry_candidates. Tuân thủ/leo thang: M5.)
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
  return jsonb_build_object('missed', v_count);
end;
$$;

-- -----------------------------------------------------------------------------
-- Bộ lập lịch
-- -----------------------------------------------------------------------------
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
  select 'close_day', public.fn_setting_at(p_date, 'report_missed_at', '23:59');
$$;

create or replace function public.fn_run_job(p_job text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return case p_job
    when 'remind_plan' then public.fn_job_remind_plan(p_date)
    when 'summary_morning' then public.fn_job_summary_morning(p_date)
    when 'remind_report' then public.fn_job_remind_report(p_date)
    when 'summary_evening' then public.fn_job_summary_evening(p_date)
    when 'close_day' then public.fn_job_close_day(p_date)
  end;
end;
$$;

-- Gọi Edge Function `notify` để gửi outbox (cần pg_net + 2 secret trong Vault:
-- project_url, cron_secret – xem docs/setup-supabase.md). Không có thì bỏ qua.
create or replace function public.fn_flush_outbox()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.outbox where status = 'pending') then
    return false;
  end if;
  if not exists (select 1 from pg_namespace where nspname = 'net')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    return false;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then
    return false;
  end if;
  execute $q$select net.http_post(url := $1, headers := $2, body := '{}'::jsonb)$q$
    using rtrim(v_url, '/') || '/functions/v1/notify',
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret);
  return true;
exception when others then
  raise warning 'fn_flush_outbox: %', sqlerrm;
  return false;
end;
$$;

create or replace function public.fn_cron_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.fn_today_vn();
  v_now timestamptz := public.fn_now();
  v_job record;
  v_result jsonb;
  v_ran jsonb := '{}'::jsonb;
begin
  for v_job in select * from public.fn_job_schedule(v_today) order by due_at loop
    continue when v_now < v_job.due_at;
    continue when exists (
      select 1 from public.cron_runs where job = v_job.job and run_date = v_today
    );
    begin
      v_result := public.fn_run_job(v_job.job, v_today);
      insert into public.cron_runs (job, run_date, ran_at, result)
      values (v_job.job, v_today, v_now, v_result);
    exception when others then
      insert into public.cron_runs (job, run_date, ran_at, error)
      values (v_job.job, v_today, v_now, sqlerrm)
      on conflict do nothing;
      v_result := jsonb_build_object('error', sqlerrm);
    end;
    v_ran := v_ran || jsonb_build_object(v_job.job, v_result);
  end loop;

  perform public.fn_flush_outbox();
  return v_ran;
end;
$$;

revoke execute on function public.fn_cron_tick() from public, anon, authenticated;
revoke execute on function public.fn_run_job(text, date) from public, anon, authenticated;
revoke execute on function public.fn_flush_outbox() from public, anon, authenticated;
revoke execute on function public.fn_job_remind_plan(date) from public, anon, authenticated;
revoke execute on function public.fn_job_remind_report(date) from public, anon, authenticated;
revoke execute on function public.fn_job_summary_morning(date) from public, anon, authenticated;
revoke execute on function public.fn_job_summary_evening(date) from public, anon, authenticated;
revoke execute on function public.fn_job_close_day(date) from public, anon, authenticated;
revoke execute on function public.fn_required_users(date) from public, anon, authenticated;
revoke execute on function public.fn_summary_scope(date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Bật pg_cron / pg_net (nếu có – Supabase có sẵn; Postgres thường thì bỏ qua)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mita-tick', '* * * * *', 'select public.fn_cron_tick()');
  end if;
end;
$$;

-- Hàm nội bộ đọc settings theo key tùy ý / thông tin nghỉ của người khác: không mở qua API
revoke execute on function public.fn_setting_at(date, text, text) from public, anon, authenticated;
revoke execute on function public.fn_job_schedule(date) from public, anon, authenticated;
revoke execute on function public.fn_has_leave(uuid, date) from public, anon, authenticated;
revoke execute on function public.fn_plan_required(uuid, date) from public, anon, authenticated;
