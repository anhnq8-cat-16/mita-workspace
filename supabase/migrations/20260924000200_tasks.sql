-- =============================================================================
-- M1 (2/4): bảng tasks (cần cho kế hoạch ngày; giao diện Kanban ở M2).
-- Task nhạy cảm (hiệu suất cá nhân): chỉ người được giao, người tạo, trưởng nhóm
-- của team và manager/admin xem được. Chỉ lead/manager/admin bật cờ này.
-- =============================================================================

create type public.task_status as enum ('todo', 'doing', 'review', 'done', 'blocked');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  team_id text references public.teams (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  weekly_goal_id uuid,                      -- FK thêm ở M2 (weekly_goals)
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  start_date date,
  due_date date,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  position numeric not null default 0,
  is_sensitive boolean not null default false,
  is_off_plan boolean not null default false,
  carried_over_count int not null default 0,
  completed_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_team_idx on public.tasks (team_id, status);
create index tasks_due_idx on public.tasks (due_date) where status <> 'done';

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index task_status_history_task_idx on public.task_status_history (task_id, changed_at);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.fn_set_updated_at();
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.fn_audit();

-- Hàm RPC của hệ thống bật app.system trong transaction để trigger kiểm soát bỏ qua
-- (PostgREST không cho client đặt GUC này).
create or replace function public.fn_is_system()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null or coalesce(current_setting('app.system', true), '') = 'on';
$$;

-- Người gọi quản lý được task này không (lead của team task, hoặc manager/admin)
create or replace function public.fn_can_manage_task(p_team text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_manager() or (p_team is not null and public.fn_is_lead_of_team(p_team));
$$;

-- Người gọi xem được task không (dùng cho RLS bảng con ở M2)
create or replace function public.fn_can_view_task(p_task uuid)
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
        public.fn_is_manager()
        or t.assignee_id = auth.uid()
        or t.created_by = auth.uid()
        or (t.team_id is not null and public.fn_is_lead_of_team(t.team_id))
        or (t.team_id is not null and not t.is_sensitive and public.fn_in_team(t.team_id))
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Kiểm soát ghi: cột nào ai được sửa, quy tắc duyệt, lịch sử trạng thái, cờ ngoài kế hoạch
-- -----------------------------------------------------------------------------
create or replace function public.fn_tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := case when public.fn_is_system() then null else auth.uid() end;
  v_manage boolean;
  v_own_personal boolean;
  v_require_review boolean := coalesce((public.fn_setting('task_require_review'))::boolean, true);
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_uid, new.created_by, auth.uid());
    if v_uid is not null then
      v_manage := public.fn_can_manage_task(new.team_id);
      if not v_manage then
        -- staff chỉ tạo task cho chính mình, trong team của mình
        if new.assignee_id is distinct from v_uid then
          raise exception 'Bạn chỉ được tạo việc cho chính mình' using errcode = '42501';
        end if;
        if new.team_id is not null and not public.fn_in_team(new.team_id) then
          raise exception 'Bạn không thuộc team này' using errcode = '42501';
        end if;
        if new.is_sensitive then
          raise exception 'Chỉ trưởng nhóm/quản lý đánh dấu việc nhạy cảm' using errcode = '42501';
        end if;
        if new.status = 'done' and v_require_review then
          new.status := 'review';
        end if;
        new.approved_by := null;
      end if;
    end if;
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, public.fn_now());
    end if;
    return new;
  end if;

  -- UPDATE
  if v_uid is not null then
    v_manage := public.fn_can_manage_task(old.team_id)
      and (new.team_id is not distinct from old.team_id or public.fn_can_manage_task(new.team_id));
    v_own_personal := old.created_by = v_uid and old.assignee_id = v_uid;

    if not v_manage then
      -- Cột staff không được đổi (trừ task cá nhân tự tạo: được sửa nội dung, hạn, ước lượng)
      if new.assignee_id is distinct from old.assignee_id
         or new.team_id is distinct from old.team_id
         or new.created_by is distinct from old.created_by
         or new.is_sensitive is distinct from old.is_sensitive
         or new.approved_by is distinct from old.approved_by
         or new.carried_over_count is distinct from old.carried_over_count
         or new.is_off_plan is distinct from old.is_off_plan
         or new.weekly_goal_id is distinct from old.weekly_goal_id then
        raise exception 'Bạn không có quyền sửa thông tin này của việc' using errcode = '42501';
      end if;
      if not v_own_personal and (
           new.title is distinct from old.title
           or new.description is distinct from old.description
           or new.due_date is distinct from old.due_date
           or new.start_date is distinct from old.start_date
           or new.priority is distinct from old.priority
           or new.estimate_minutes is distinct from old.estimate_minutes) then
        raise exception 'Chỉ người giao việc được sửa nội dung, hạn và ưu tiên' using errcode = '42501';
      end if;
      if new.status = 'done' and old.status <> 'done' and v_require_review then
        raise exception 'Việc cần được duyệt: hãy chuyển sang "Chờ duyệt"' using errcode = '42501';
      end if;
    elsif new.status = 'done' and old.status <> 'done' then
      new.approved_by := v_uid;
    end if;
  end if;

  if new.status = 'blocked' and coalesce(trim(new.blocked_reason), '') = '' then
    raise exception 'Việc bị chặn cần ghi lý do' using errcode = '23514';
  end if;
  if new.status <> 'blocked' and old.status = 'blocked' then
    new.blocked_reason := null;
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := public.fn_now();
  elsif new.status <> 'done' then
    new.completed_at := null;
    if old.status = 'done' then
      new.approved_by := null;
    end if;
  end if;

  if new.start_date is null and new.status = 'doing' and old.status = 'todo' then
    new.start_date := public.fn_today_vn();
  end if;
  return new;
end;
$$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.fn_tasks_guard();

create or replace function public.fn_tasks_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by, changed_at)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), public.fn_now());
  end if;
  return null;
end;
$$;
create trigger tasks_history after insert or update of status on public.tasks
  for each row execute function public.fn_tasks_history();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create policy tasks_select on public.tasks for select to authenticated
  using (
    public.fn_is_active() and (
      public.fn_is_manager()
      or assignee_id = auth.uid()
      or created_by = auth.uid()
      or (team_id is not null and public.fn_is_lead_of_team(team_id))
      or (team_id is not null and not is_sensitive and public.fn_in_team(team_id))
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.fn_is_active());
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.fn_is_active() and (
      public.fn_can_manage_task(team_id) or assignee_id = auth.uid()
    )
  )
  with check (public.fn_is_active());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.fn_is_admin());

create policy task_status_history_select on public.task_status_history for select to authenticated
  using (public.fn_can_view_task(task_id));
revoke insert, update, delete, truncate on public.task_status_history from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;
