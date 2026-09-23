-- =============================================================================
-- M2: Công việc & mục tiêu tuần
-- checklist, bình luận (@nhắc tên), link tư liệu, thông báo việc,
-- mục tiêu tuần (thủ công / tự động), nhắc lập mục tiêu sáng thứ Hai.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Quyền trên 1 task theo 1 người bất kỳ (dùng cho thông báo @nhắc tên)
-- -----------------------------------------------------------------------------
create or replace function public.fn_user_can_view_task(p_user uuid, p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles u on u.id = p_user and u.is_active
    where t.id = p_task
      and (
        u.role in ('manager', 'admin')
        or t.assignee_id = p_user
        or t.created_by = p_user
        or exists (
          select 1 from public.user_teams ut
          where ut.user_id = p_user and ut.team_id = t.team_id
            and (ut.is_lead and u.role in ('lead', 'manager', 'admin') or not t.is_sensitive)
        )
      )
  );
$$;
revoke execute on function public.fn_user_can_view_task(uuid, uuid) from public, anon, authenticated;

-- Người gọi được làm việc trên task (checklist, link): người được giao, người tạo, lead team, manager
create or replace function public.fn_can_work_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task
      and public.fn_is_active()
      and (
        t.assignee_id = auth.uid()
        or t.created_by = auth.uid()
        or public.fn_can_manage_task(t.team_id)
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Checklist, bình luận, link
-- -----------------------------------------------------------------------------
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  done boolean not null default false,
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_checklist_items_task_idx on public.task_checklist_items (task_id, position);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  library_item_id uuid,                      -- FK tới library_items thêm ở M4
  url text,
  label text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is not null or library_item_id is not null)
);
create index task_links_task_idx on public.task_links (task_id);

create trigger task_checklist_items_updated_at before update on public.task_checklist_items
  for each row execute function public.fn_set_updated_at();
create trigger task_comments_updated_at before update on public.task_comments
  for each row execute function public.fn_set_updated_at();
create trigger task_links_updated_at before update on public.task_links
  for each row execute function public.fn_set_updated_at();

alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_links enable row level security;

create policy task_checklist_select on public.task_checklist_items for select to authenticated
  using (public.fn_can_view_task(task_id));
create policy task_checklist_write on public.task_checklist_items for all to authenticated
  using (public.fn_can_work_task(task_id)) with check (public.fn_can_work_task(task_id));

-- Ai xem được việc thì bình luận được (để người được @nhắc trả lời)
create policy task_comments_select on public.task_comments for select to authenticated
  using (public.fn_can_view_task(task_id));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and public.fn_can_view_task(task_id));
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = auth.uid() or public.fn_is_admin());
revoke update on public.task_comments from anon, authenticated;

create policy task_links_select on public.task_links for select to authenticated
  using (public.fn_can_view_task(task_id));
create policy task_links_write on public.task_links for all to authenticated
  using (public.fn_can_work_task(task_id)) with check (public.fn_can_work_task(task_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_comments, public.task_checklist_items;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Thông báo việc: giao việc, chờ duyệt, đã duyệt, bình luận / @nhắc tên
-- -----------------------------------------------------------------------------
create or replace function public.fn_tasks_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_link text := '/viec?task=' || new.id;
  v_lead uuid;
begin
  select coalesce(full_name, email) into v_actor_name from public.profiles where id = v_actor;
  v_actor_name := coalesce(v_actor_name, 'Hệ thống');

  -- Được giao việc (bởi người khác)
  if new.assignee_id is not null and new.assignee_id is distinct from v_actor
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.fn_notify_user(new.assignee_id, 'task_assigned',
      v_actor_name || ' giao việc: ' || new.title,
      case when new.due_date is not null then 'Hạn: ' || to_char(new.due_date, 'DD/MM/YYYY') end,
      v_link, true);
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Chờ duyệt → người giao việc (hoặc trưởng nhóm nếu tự giao)
    if new.status = 'review' then
      if new.created_by is not null and new.created_by is distinct from new.assignee_id then
        perform public.fn_notify_user(new.created_by, 'task_review',
          'Chờ duyệt: ' || new.title, v_actor_name || ' đã hoàn thành, cần duyệt', v_link, true);
      elsif new.assignee_id is not null then
        for v_lead in
          select ut.user_id from public.user_teams ut
          join public.profiles p on p.id = ut.user_id and p.is_active
          where ut.team_id = new.team_id and ut.is_lead and ut.user_id <> new.assignee_id
        loop
          perform public.fn_notify_user(v_lead, 'task_review',
            'Chờ duyệt: ' || new.title, v_actor_name || ' đã hoàn thành, cần duyệt', v_link, true);
        end loop;
      end if;
    -- Đã duyệt / trả lại → người thực hiện
    elsif new.assignee_id is not null and new.assignee_id is distinct from v_actor then
      if new.status = 'done' then
        perform public.fn_notify_user(new.assignee_id, 'task_done',
          'Đã duyệt: ' || new.title, null, v_link, false);
      elsif old.status = 'review' then
        perform public.fn_notify_user(new.assignee_id, 'task_returned',
          'Việc được trả lại: ' || new.title, 'Trạng thái: ' || new.status, v_link, true);
      end if;
    end if;
  end if;
  return null;
end;
$$;
create trigger tasks_notify after insert or update on public.tasks
  for each row execute function public.fn_tasks_notify();

create or replace function public.fn_task_comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_author text;
  v_user uuid;
  v_link text := '/viec?task=' || new.task_id;
  v_excerpt text := left(new.body, 200);
begin
  select * into v_task from public.tasks where id = new.task_id;
  select coalesce(full_name, email) into v_author from public.profiles where id = new.author_id;

  -- @nhắc tên: chỉ báo cho người xem được việc (tránh lộ việc nhạy cảm)
  for v_user in select distinct m from unnest(new.mentions) m loop
    if v_user <> new.author_id and public.fn_user_can_view_task(v_user, new.task_id) then
      perform public.fn_notify_user(v_user, 'task_mention',
        v_author || ' nhắc bạn trong: ' || v_task.title, v_excerpt, v_link, true);
    end if;
  end loop;

  -- Người thực hiện + người giao (nếu chưa được @nhắc)
  for v_user in
    select distinct u from unnest(array[v_task.assignee_id, v_task.created_by]) u
    where u is not null and u <> new.author_id and not (u = any (new.mentions))
  loop
    perform public.fn_notify_user(v_user, 'task_comment',
      v_author || ' bình luận: ' || v_task.title, v_excerpt, v_link, false);
  end loop;
  return null;
end;
$$;
create trigger task_comments_notify after insert on public.task_comments
  for each row execute function public.fn_task_comments_notify();

-- -----------------------------------------------------------------------------
-- Mục tiêu tuần
-- -----------------------------------------------------------------------------
create type public.goal_source as enum ('manual', 'auto_orders', 'auto_leads', 'auto_tasks');
create type public.goal_status as enum ('open', 'achieved', 'missed');

create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  team_id text not null references public.teams (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,   -- null = mục tiêu cả team
  title text not null check (length(trim(title)) > 0),
  metric text,
  target numeric not null check (target >= 0),
  unit text,
  actual numeric,
  actual_source public.goal_source not null default 'manual',
  status public.goal_status not null default 'open',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_goals_week_idx on public.weekly_goals (week_start, team_id);

alter table public.tasks
  add constraint tasks_weekly_goal_fk foreign key (weekly_goal_id)
  references public.weekly_goals (id) on delete set null;
create index tasks_weekly_goal_idx on public.tasks (weekly_goal_id);

create trigger weekly_goals_updated_at before update on public.weekly_goals
  for each row execute function public.fn_set_updated_at();
create trigger weekly_goals_audit after insert or update or delete on public.weekly_goals
  for each row execute function public.fn_audit();

create or replace function public.fn_weekly_goals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.user_teams where user_id = new.owner_id and team_id = new.team_id
  ) then
    raise exception 'Người phụ trách phải thuộc team của mục tiêu' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger weekly_goals_guard before insert or update on public.weekly_goals
  for each row execute function public.fn_weekly_goals_guard();

alter table public.weekly_goals enable row level security;
create policy weekly_goals_select on public.weekly_goals for select to authenticated
  using (
    public.fn_is_active() and (
      public.fn_is_manager() or public.fn_in_team(team_id) or owner_id = auth.uid()
    )
  );
create policy weekly_goals_insert on public.weekly_goals for insert to authenticated
  with check (public.fn_can_manage_task(team_id));
create policy weekly_goals_update on public.weekly_goals for update to authenticated
  using (public.fn_can_manage_task(team_id)) with check (public.fn_can_manage_task(team_id));
create policy weekly_goals_delete on public.weekly_goals for delete to authenticated
  using (public.fn_is_admin());

-- Việc chỉ gắn được vào mục tiêu cùng team
create or replace function public.fn_tasks_goal_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.weekly_goal_id is not null
     and (tg_op = 'INSERT'
          or new.weekly_goal_id is distinct from old.weekly_goal_id
          or new.team_id is distinct from old.team_id)
     and not exists (
       select 1 from public.weekly_goals g
       where g.id = new.weekly_goal_id and g.team_id is not distinct from new.team_id
     ) then
    raise exception 'Mục tiêu tuần không thuộc team của việc' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger tasks_goal_check before insert or update of weekly_goal_id, team_id on public.tasks
  for each row execute function public.fn_tasks_goal_check();

-- Giá trị thực tế của mục tiêu.
-- auto_tasks: số việc gắn với mục tiêu đã hoàn thành. auto_orders / auto_leads: có từ M3.
create or replace function public.fn_goal_actual(p_goal uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.weekly_goals;
begin
  select * into g from public.weekly_goals where id = p_goal;
  if not found then
    return null;
  end if;
  return case g.actual_source
    when 'manual' then g.actual
    when 'auto_tasks' then (
      select count(*)::numeric from public.tasks t
      where t.weekly_goal_id = g.id and t.status = 'done'
    )
    else null
  end;
end;
$$;

-- Danh sách mục tiêu 1 tuần kèm tiến độ (RLS của weekly_goals vẫn áp dụng)
create or replace function public.fn_weekly_goals(p_week_start date)
returns table (
  id uuid,
  week_start date,
  team_id text,
  owner_id uuid,
  title text,
  metric text,
  target numeric,
  unit text,
  actual_source public.goal_source,
  status public.goal_status,
  actual numeric,
  task_total int,
  task_done int,
  created_by uuid
)
language sql
stable
set search_path = ''
as $$
  select g.id, g.week_start, g.team_id, g.owner_id, g.title, g.metric, g.target, g.unit,
         g.actual_source, g.status, public.fn_goal_actual(g.id),
         (select count(*)::int from public.tasks t where t.weekly_goal_id = g.id),
         (select count(*)::int from public.tasks t where t.weekly_goal_id = g.id and t.status = 'done'),
         g.created_by
  from public.weekly_goals g
  where g.week_start = p_week_start
  order by g.team_id, g.owner_id nulls first, g.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Job thứ Hai: chốt mục tiêu tuần trước + nhắc lead lập mục tiêu tuần này
-- (điểm tuân thủ tuần trước sẽ bổ sung ở M5)
-- -----------------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('weekly_kickoff_time', '"08:00"', 'Giờ sáng thứ Hai nhắc lập mục tiêu tuần')
on conflict (key) do nothing;

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

  return jsonb_build_object('closed', v_closed, 'reminded', v_reminded);
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
  where extract(isodow from p_date) = 1;
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
    when 'weekly_kickoff' then public.fn_job_weekly_kickoff(p_date)
  end;
end;
$$;

revoke execute on function public.fn_job_weekly_kickoff(date) from public, anon, authenticated;
revoke execute on function public.fn_job_schedule(date) from public, anon, authenticated;
revoke execute on function public.fn_run_job(text, date) from public, anon, authenticated;
