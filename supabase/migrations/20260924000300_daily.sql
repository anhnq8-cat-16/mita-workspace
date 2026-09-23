-- =============================================================================
-- M1 (3/4): Kế hoạch ngày (cổng bắt buộc), báo cáo cuối ngày, bổ sung, review,
-- chuyển việc tồn, cờ ngoài kế hoạch.
-- Ghi dữ liệu chỉ qua hàm RPC (security definer) để mọi quy tắc nằm ở server;
-- RLS chỉ mở quyền đọc. Không ai xóa được báo cáo / bổ sung.
-- =============================================================================

create type public.plan_item_kind as enum ('task', 'visit', 'meeting', 'content', 'other');
create type public.report_status as enum ('on_time', 'late', 'missed');
create type public.report_result as enum ('done', 'partial', 'not_done');

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  route_plan text,
  note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);
create index daily_plans_date_idx on public.daily_plans (plan_date);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.daily_plans (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  kind public.plan_item_kind not null default 'task',
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  is_carried_over boolean not null default false,
  carried_from_item_id uuid references public.daily_plan_items (id) on delete set null,
  removed_reason text,
  is_off_plan boolean not null default false,   -- thêm sau hạn chót
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index daily_plan_items_plan_idx on public.daily_plan_items (plan_id, position);
create index daily_plan_items_task_idx on public.daily_plan_items (task_id);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_date date not null,
  submitted_at timestamptz,
  status public.report_status not null,
  metrics jsonb not null default '{}'::jsonb,
  blockers text,
  need_decision text,
  tomorrow_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_date)
);
create index daily_reports_date_idx on public.daily_reports (report_date);

create table public.daily_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports (id) on delete cascade,
  plan_item_id uuid references public.daily_plan_items (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  result public.report_result not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index daily_report_items_report_idx on public.daily_report_items (report_id);

create table public.report_amendments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index report_amendments_report_idx on public.report_amendments (report_id, created_at);

create trigger daily_plans_updated_at before update on public.daily_plans
  for each row execute function public.fn_set_updated_at();
create trigger daily_plan_items_updated_at before update on public.daily_plan_items
  for each row execute function public.fn_set_updated_at();
create trigger daily_reports_updated_at before update on public.daily_reports
  for each row execute function public.fn_set_updated_at();
create trigger daily_report_items_updated_at before update on public.daily_report_items
  for each row execute function public.fn_set_updated_at();
create trigger daily_plans_audit after insert or update or delete on public.daily_plans
  for each row execute function public.fn_audit();
create trigger daily_reports_audit after insert or update or delete on public.daily_reports
  for each row execute function public.fn_audit();

-- Không ai xóa báo cáo / bổ sung (kể cả admin – chỉ qua SQL trực tiếp với quyền postgres)
create or replace function public.fn_forbid_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    raise exception 'Không được xóa dữ liệu này' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger daily_reports_no_delete before delete on public.daily_reports
  for each row execute function public.fn_forbid_delete();
create trigger report_amendments_no_delete before delete on public.report_amendments
  for each row execute function public.fn_forbid_delete();

-- -----------------------------------------------------------------------------
-- Hàm hỗ trợ
-- -----------------------------------------------------------------------------

-- Người này có phải qua cổng kế hoạch vào ngày p_date không
create or replace function public.fn_plan_required(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.is_active
      and coalesce(public.fn_setting('plan_required_roles'), '["lead","staff"]'::jsonb) ? p.role::text
  )
  and public.fn_is_workday_for(p_user, p_date)
  and not public.fn_has_leave(p_user, p_date);
$$;

-- Người gọi xem được kế hoạch/báo cáo của p_user không
create or replace function public.fn_can_view_user_day(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_active() and (
    p_user = auth.uid() or public.fn_is_manager() or public.fn_is_lead_of_user(p_user)
  );
$$;

create or replace function public.fn_primary_team(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ut.team_id from public.user_teams ut
  where ut.user_id = p_user
  order by ut.created_at, ut.team_id
  limit 1;
$$;

create or replace function public.fn_require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.fn_is_active() then
    raise exception 'Tài khoản chưa được kích hoạt' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Việc tồn của kế hoạch gần nhất trước p_date: item chưa bị bỏ, báo cáo không ghi
-- Hoàn thành (hoặc không có báo cáo), và task (nếu có) chưa xong / chờ duyệt.
create or replace function public.fn_carry_candidates(p_user uuid, p_date date)
returns table (
  item_id uuid,
  task_id uuid,
  title text,
  kind public.plan_item_kind,
  estimate_minutes int,
  from_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_plan as (
    select dp.id, dp.plan_date
    from public.daily_plans dp
    where dp.user_id = p_user and dp.plan_date < p_date
    order by dp.plan_date desc
    limit 1
  )
  select i.id, i.task_id, coalesce(t.title, i.title), i.kind, i.estimate_minutes, lp.plan_date
  from last_plan lp
  join public.daily_plan_items i on i.plan_id = lp.id
  left join public.daily_reports r
    on r.user_id = p_user and r.report_date = lp.plan_date and r.submitted_at is not null
  left join public.daily_report_items ri on ri.report_id = r.id and ri.plan_item_id = i.id
  left join public.tasks t on t.id = i.task_id
  where coalesce((public.fn_setting('carry_over_enabled'))::boolean, true)
    and i.removed_reason is null
    and (ri.id is null or ri.result <> 'done')
    and (t.id is null or t.status not in ('done', 'review'))
  order by i.position;
$$;

-- -----------------------------------------------------------------------------
-- Đọc: 1 ngày của 1 người (kế hoạch + báo cáo + hạn chót)
-- -----------------------------------------------------------------------------
create or replace function public.fn_day_detail(p_user uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.daily_plans;
  v_report public.daily_reports;
  v_leave public.leaves;
begin
  if not public.fn_can_view_user_day(p_user) then
    raise exception 'Bạn không có quyền xem ngày làm việc này' using errcode = '42501';
  end if;

  select * into v_plan from public.daily_plans where user_id = p_user and plan_date = p_date;
  select * into v_report from public.daily_reports where user_id = p_user and report_date = p_date;
  select * into v_leave from public.leaves
    where user_id = p_user and date = p_date and rejected_at is null;

  return jsonb_build_object(
    'user_id', p_user,
    'date', p_date,
    'now', public.fn_now(),
    'is_today', p_date = public.fn_today_vn(),
    'is_workday', public.fn_is_workday_for(p_user, p_date),
    'plan_required', public.fn_plan_required(p_user, p_date),
    'leave', case when v_leave.id is null then null else to_jsonb(v_leave) end,
    'plan_min_items', coalesce((public.fn_setting('plan_min_items'))::int, 3),
    'deadlines', jsonb_build_object(
      'plan_deadline', public.fn_setting_at(p_date, 'plan_deadline', '09:00'),
      'report_open', public.fn_setting_at(p_date, 'report_open_time', '16:00'),
      'report_deadline', public.fn_setting_at(p_date, 'report_deadline', '17:30'),
      'report_missed', public.fn_setting_at(p_date, 'report_missed_at', '23:59')
    ),
    'plan', case when v_plan.id is null then null else
      to_jsonb(v_plan) || jsonb_build_object('items', coalesce((
        select jsonb_agg(
          to_jsonb(i) || jsonb_build_object(
            'task_status', t.status, 'task_due_date', t.due_date
          ) order by i.position, i.created_at)
        from public.daily_plan_items i
        left join public.tasks t on t.id = i.task_id
        where i.plan_id = v_plan.id
      ), '[]'::jsonb))
    end,
    'report', case when v_report.id is null then null else
      to_jsonb(v_report) || jsonb_build_object(
        'items', coalesce((
          select jsonb_agg(to_jsonb(ri) order by ri.created_at)
          from public.daily_report_items ri where ri.report_id = v_report.id
        ), '[]'::jsonb),
        'amendments', coalesce((
          select jsonb_agg(to_jsonb(a) || jsonb_build_object('author_name', p.full_name)
                           order by a.created_at)
          from public.report_amendments a
          left join public.profiles p on p.id = a.author_id
          where a.report_id = v_report.id
        ), '[]'::jsonb)
      )
    end
  );
end;
$$;

create or replace function public.fn_my_day()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_day_detail(public.fn_require_active_user(), public.fn_today_vn());
$$;

-- Gợi ý cho form kế hoạch: việc tồn (bắt buộc giữ hoặc ghi lý do) + việc đến hạn/quá hạn + đang làm
create or replace function public.fn_plan_prefill()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_today date := public.fn_today_vn();
  v_carried jsonb;
  v_tasks jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'source', 'carried',
      'carried_from_item_id', c.item_id,
      'task_id', c.task_id,
      'title', c.title,
      'kind', c.kind,
      'estimate_minutes', c.estimate_minutes,
      'from_date', c.from_date)), '[]'::jsonb)
  into v_carried
  from public.fn_carry_candidates(v_user, v_today) c;

  select coalesce(jsonb_agg(jsonb_build_object(
      'source', case when t.status = 'doing' then 'doing' else 'due' end,
      'task_id', t.id,
      'title', t.title,
      'kind', 'task',
      'estimate_minutes', t.estimate_minutes,
      'due_date', t.due_date,
      'status', t.status) order by t.due_date nulls last, t.created_at), '[]'::jsonb)
  into v_tasks
  from public.tasks t
  where t.assignee_id = v_user
    and t.status in ('todo', 'doing', 'blocked')
    and (t.status = 'doing' or t.due_date <= v_today)
    and not exists (
      select 1 from public.fn_carry_candidates(v_user, v_today) c where c.task_id = t.id
    );

  return v_carried || v_tasks;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ghi: kế hoạch
-- -----------------------------------------------------------------------------

-- Tạo task nhanh từ kế hoạch (cho chính mình)
create or replace function public.fn_quick_task(
  p_user uuid, p_title text, p_estimate int, p_kind public.plan_item_kind
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_team text := public.fn_primary_team(p_user);
begin
  if p_kind = 'content' and exists (
    select 1 from public.user_teams where user_id = p_user and team_id = 'marketing'
  ) then
    v_team := 'marketing';
  end if;
  perform set_config('app.system', 'on', true);
  insert into public.tasks (title, team_id, assignee_id, created_by, status, due_date, estimate_minutes)
  values (trim(p_title), v_team, p_user, p_user, 'todo', public.fn_today_vn(), p_estimate)
  returning id into v_id;
  perform set_config('app.system', '', true);
  return v_id;
end;
$$;
revoke execute on function public.fn_quick_task(uuid, text, int, public.plan_item_kind)
  from public, anon, authenticated;

-- Kiểm tra task có thuộc người dùng không (được giao cho mình)
create or replace function public.fn_assert_my_task(p_user uuid, p_task uuid)
returns public.tasks
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task;
  if not found or v_task.assignee_id is distinct from p_user then
    raise exception 'Việc này không được giao cho bạn' using errcode = '42501';
  end if;
  if v_task.status = 'done' then
    raise exception 'Việc "%" đã hoàn thành', v_task.title using errcode = '22023';
  end if;
  return v_task;
end;
$$;

-- Nộp kế hoạch hôm nay.
-- p_items: [{title, kind, task_id?, estimate_minutes?, carried_from_item_id?, removed_reason?}]
create or replace function public.fn_submit_daily_plan(
  p_items jsonb,
  p_route_plan text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_today date := public.fn_today_vn();
  v_now timestamptz := public.fn_now();
  v_min int := coalesce((public.fn_setting('plan_min_items'))::int, 3);
  v_plan_id uuid;
  v_item jsonb;
  v_pos int := 0;
  v_active int := 0;
  v_task_id uuid;
  v_task public.tasks;
  v_title text;
  v_kind public.plan_item_kind;
  v_from uuid;
  v_removed text;
  v_task_ids uuid[] := '{}';
  v_candidate record;
begin
  if exists (select 1 from public.daily_plans where user_id = v_user and plan_date = v_today) then
    raise exception 'Bạn đã nộp kế hoạch hôm nay' using errcode = '23505';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Danh sách việc không hợp lệ' using errcode = '22023';
  end if;

  -- Việc tồn: phải giữ lại hoặc ghi lý do bỏ
  for v_candidate in select * from public.fn_carry_candidates(v_user, v_today) loop
    if not exists (
      select 1 from jsonb_array_elements(p_items) e
      where e ->> 'carried_from_item_id' = v_candidate.item_id::text
    ) then
      raise exception 'Việc chuyển từ hôm trước "%" phải giữ lại hoặc ghi lý do bỏ', v_candidate.title
        using errcode = '22023';
    end if;
  end loop;

  select count(*) into v_active
  from jsonb_array_elements(p_items) e
  where coalesce(trim(e ->> 'removed_reason'), '') = '';
  if v_active < v_min then
    raise exception 'Kế hoạch cần ít nhất % việc', v_min using errcode = '22023';
  end if;

  insert into public.daily_plans (user_id, plan_date, submitted_at, is_late, route_plan, note)
  values (
    v_user, v_today, v_now,
    v_now > public.fn_setting_at(v_today, 'plan_deadline', '09:00'),
    nullif(trim(coalesce(p_route_plan, '')), ''),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_plan_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    v_kind := coalesce(nullif(v_item ->> 'kind', ''), 'task')::public.plan_item_kind;
    v_title := trim(coalesce(v_item ->> 'title', ''));
    v_task_id := nullif(v_item ->> 'task_id', '')::uuid;
    v_removed := nullif(trim(coalesce(v_item ->> 'removed_reason', '')), '');
    v_from := nullif(v_item ->> 'carried_from_item_id', '')::uuid;

    -- Chỉ nhận carried_from_item_id đúng là việc tồn của mình
    if v_from is not null and not exists (
      select 1 from public.fn_carry_candidates(v_user, v_today) c where c.item_id = v_from
    ) then
      v_from := null;
    end if;
    if v_removed is not null and v_from is null then
      continue; -- bỏ việc thường thì chỉ cần không gửi lên
    end if;

    if v_task_id is not null then
      v_task := public.fn_assert_my_task(v_user, v_task_id);
      if v_title = '' then
        v_title := v_task.title;
      end if;
    elsif v_kind in ('task', 'content') and v_removed is null then
      if v_title = '' then
        raise exception 'Tên việc không được để trống' using errcode = '22023';
      end if;
      v_task_id := public.fn_quick_task(v_user, v_title, nullif(v_item ->> 'estimate_minutes', '')::int, v_kind);
    end if;
    if v_title = '' then
      raise exception 'Tên việc không được để trống' using errcode = '22023';
    end if;
    if v_task_id is not null and v_removed is null then
      if v_task_id = any (v_task_ids) then
        raise exception 'Việc "%" bị trùng trong kế hoạch', v_title using errcode = '22023';
      end if;
      v_task_ids := v_task_ids || v_task_id;
    end if;

    insert into public.daily_plan_items (
      plan_id, task_id, title, kind, estimate_minutes,
      is_carried_over, carried_from_item_id, removed_reason, position
    ) values (
      v_plan_id, v_task_id, v_title, v_kind, nullif(v_item ->> 'estimate_minutes', '')::int,
      v_from is not null, v_from, v_removed, v_pos
    );

    if v_from is not null and v_task_id is not null and v_removed is null then
      perform set_config('app.system', 'on', true);
      update public.tasks set carried_over_count = carried_over_count + 1 where id = v_task_id;
      perform set_config('app.system', '', true);
    end if;
  end loop;

  return v_plan_id;
end;
$$;

-- Thêm việc vào kế hoạch đã nộp. Sau hạn chót → đánh dấu ngoài kế hoạch.
create or replace function public.fn_add_plan_item(
  p_title text,
  p_kind public.plan_item_kind default 'task',
  p_task_id uuid default null,
  p_estimate_minutes int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_today date := public.fn_today_vn();
  v_plan public.daily_plans;
  v_off boolean;
  v_task_id uuid := p_task_id;
  v_title text := trim(coalesce(p_title, ''));
  v_task public.tasks;
  v_id uuid;
begin
  select * into v_plan from public.daily_plans where user_id = v_user and plan_date = v_today;
  if not found then
    raise exception 'Bạn chưa nộp kế hoạch hôm nay' using errcode = '22023';
  end if;
  v_off := public.fn_now() > public.fn_setting_at(v_today, 'plan_deadline', '09:00');

  if v_task_id is not null then
    v_task := public.fn_assert_my_task(v_user, v_task_id);
    if v_title = '' then
      v_title := v_task.title;
    end if;
    if exists (
      select 1 from public.daily_plan_items
      where plan_id = v_plan.id and task_id = v_task_id and removed_reason is null
    ) then
      raise exception 'Việc này đã có trong kế hoạch' using errcode = '23505';
    end if;
  elsif p_kind in ('task', 'content') then
    if v_title = '' then
      raise exception 'Tên việc không được để trống' using errcode = '22023';
    end if;
    v_task_id := public.fn_quick_task(v_user, v_title, p_estimate_minutes, p_kind);
  end if;
  if v_title = '' then
    raise exception 'Tên việc không được để trống' using errcode = '22023';
  end if;

  insert into public.daily_plan_items (plan_id, task_id, title, kind, estimate_minutes, is_off_plan, position)
  values (
    v_plan.id, v_task_id, v_title, p_kind, p_estimate_minutes, v_off,
    coalesce((select max(position) from public.daily_plan_items where plan_id = v_plan.id), 0) + 1
  )
  returning id into v_id;

  if v_off and v_task_id is not null then
    perform set_config('app.system', 'on', true);
    update public.tasks set is_off_plan = true where id = v_task_id;
    perform set_config('app.system', '', true);
  end if;
  return v_id;
end;
$$;

-- Bỏ 1 việc khỏi kế hoạch (chỉ trước hạn chót). Việc tồn: bắt buộc lý do, giữ lại dấu vết.
create or replace function public.fn_remove_plan_item(p_item uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_item public.daily_plan_items;
  v_plan public.daily_plans;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_item from public.daily_plan_items where id = p_item;
  select * into v_plan from public.daily_plans where id = v_item.plan_id;
  if v_plan.id is null or v_plan.user_id <> v_user or v_plan.plan_date <> public.fn_today_vn() then
    raise exception 'Không tìm thấy việc trong kế hoạch hôm nay của bạn' using errcode = '42501';
  end if;
  if public.fn_now() > public.fn_setting_at(v_plan.plan_date, 'plan_deadline', '09:00') then
    raise exception 'Sau hạn chót chỉ được thêm việc, không được bỏ' using errcode = '42501';
  end if;
  if v_item.is_carried_over then
    if v_reason is null then
      raise exception 'Bỏ việc chuyển từ hôm trước cần ghi lý do' using errcode = '22023';
    end if;
    update public.daily_plan_items set removed_reason = v_reason where id = p_item;
  else
    delete from public.daily_plan_items where id = p_item;
  end if;
end;
$$;

-- Sửa lịch trình / ghi chú (trước hạn chót)
create or replace function public.fn_update_plan_meta(p_route_plan text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_today date := public.fn_today_vn();
begin
  if public.fn_now() > public.fn_setting_at(v_today, 'plan_deadline', '09:00') then
    raise exception 'Đã quá hạn chót, không sửa được kế hoạch' using errcode = '42501';
  end if;
  update public.daily_plans
  set route_plan = nullif(trim(coalesce(p_route_plan, '')), ''),
      note = nullif(trim(coalesce(p_note, '')), '')
  where user_id = v_user and plan_date = v_today;
  if not found then
    raise exception 'Bạn chưa nộp kế hoạch hôm nay' using errcode = '22023';
  end if;
end;
$$;

-- Thông báo trưởng nhóm khi nộp kế hoạch trễ
create or replace function public.fn_daily_plans_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_lead uuid;
begin
  if new.is_late then
    select coalesce(full_name, email) into v_name from public.profiles where id = new.user_id;
    for v_lead in select public.fn_leads_of(new.user_id) loop
      perform public.fn_notify_user(
        v_lead, 'plan_late',
        v_name || ' nộp kế hoạch trễ (' || to_char(new.submitted_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') || ')',
        null, '/bao-cao?tab=team', true);
    end loop;
  end if;
  return null;
end;
$$;
create trigger daily_plans_notify after insert on public.daily_plans
  for each row execute function public.fn_daily_plans_notify();

-- Task bắt đầu (sang Đang làm) trong ngày mà không có trong kế hoạch hôm nay → ngoài kế hoạch
create or replace function public.fn_tasks_off_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  if new.status = 'doing' and (tg_op = 'INSERT' or old.status is distinct from 'doing')
     and new.assignee_id is not null and not new.is_off_plan then
    select id into v_plan from public.daily_plans
    where user_id = new.assignee_id and plan_date = public.fn_today_vn();
    if v_plan is not null and not exists (
      select 1 from public.daily_plan_items i
      where i.plan_id = v_plan and i.task_id = new.id and i.removed_reason is null
    ) then
      new.is_off_plan := true;
    end if;
  end if;
  return new;
end;
$$;
create trigger tasks_off_plan before insert or update of status on public.tasks
  for each row execute function public.fn_tasks_off_plan();

-- -----------------------------------------------------------------------------
-- Ghi: báo cáo cuối ngày
-- -----------------------------------------------------------------------------
-- p_items: [{plan_item_id, result: done|partial|not_done, reason?}]
create or replace function public.fn_submit_daily_report(
  p_items jsonb,
  p_metrics jsonb default '{}'::jsonb,
  p_blockers text default null,
  p_need_decision text default null,
  p_tomorrow_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_today date := public.fn_today_vn();
  v_now timestamptz := public.fn_now();
  v_plan public.daily_plans;
  v_existing public.daily_reports;
  v_report_id uuid;
  v_item public.daily_plan_items;
  v_entry jsonb;
  v_result public.report_result;
  v_reason text;
  v_require_review boolean := coalesce((public.fn_setting('task_require_review'))::boolean, true);
begin
  select * into v_plan from public.daily_plans where user_id = v_user and plan_date = v_today;
  if not found then
    raise exception 'Chưa có kế hoạch hôm nay nên chưa báo cáo được' using errcode = '22023';
  end if;
  if v_now < public.fn_setting_at(v_today, 'report_open_time', '16:00') then
    raise exception 'Chưa đến giờ nhận báo cáo (%)',
      coalesce(public.fn_setting('report_open_time') #>> '{}', '16:00') using errcode = '22023';
  end if;
  select * into v_existing from public.daily_reports where user_id = v_user and report_date = v_today;
  if found then
    raise exception 'Báo cáo hôm nay đã khóa. Hãy dùng "Bổ sung"' using errcode = '23505';
  end if;
  if p_metrics is not null and jsonb_typeof(p_metrics) <> 'object' then
    raise exception 'Chỉ số không hợp lệ' using errcode = '22023';
  end if;

  insert into public.daily_reports (
    user_id, report_date, submitted_at, status, metrics, blockers, need_decision, tomorrow_note
  ) values (
    v_user, v_today, v_now,
    case when v_now <= public.fn_setting_at(v_today, 'report_deadline', '17:30')
      then 'on_time' else 'late' end::public.report_status,
    coalesce(p_metrics, '{}'::jsonb),
    nullif(trim(coalesce(p_blockers, '')), ''),
    nullif(trim(coalesce(p_need_decision, '')), ''),
    nullif(trim(coalesce(p_tomorrow_note, '')), '')
  )
  returning id into v_report_id;

  for v_item in
    select * from public.daily_plan_items
    where plan_id = v_plan.id and removed_reason is null
    order by position
  loop
    select e into v_entry from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    where e ->> 'plan_item_id' = v_item.id::text
    limit 1;
    if v_entry is null or coalesce(v_entry ->> 'result', '') = '' then
      raise exception 'Chưa chọn kết quả cho việc "%"', v_item.title using errcode = '22023';
    end if;
    v_result := (v_entry ->> 'result')::public.report_result;
    v_reason := nullif(trim(coalesce(v_entry ->> 'reason', '')), '');
    if v_result <> 'done' and v_reason is null then
      raise exception 'Cần ghi lý do cho việc chưa xong "%"', v_item.title using errcode = '22023';
    end if;

    insert into public.daily_report_items (report_id, plan_item_id, task_id, result, reason)
    values (v_report_id, v_item.id, v_item.task_id, v_result, v_reason);

    -- Đồng bộ trạng thái task
    if v_item.task_id is not null then
      perform set_config('app.system', 'on', true);
      if v_result = 'done' then
        update public.tasks
        set status = case when v_require_review then 'review' else 'done' end::public.task_status
        where id = v_item.task_id and assignee_id = v_user and status not in ('done', 'review');
      elsif v_result = 'partial' then
        update public.tasks set status = 'doing'
        where id = v_item.task_id and assignee_id = v_user and status = 'todo';
      end if;
      perform set_config('app.system', '', true);
    end if;
  end loop;

  return v_report_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Review (lead/manager): "Đã xem" + phản hồi
-- -----------------------------------------------------------------------------
create or replace function public.fn_review_plan(p_plan uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.daily_plans;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  perform public.fn_require_active_user();
  select * into v_plan from public.daily_plans where id = p_plan;
  if not found or v_plan.user_id = auth.uid()
     or not (public.fn_is_manager() or public.fn_is_lead_of_user(v_plan.user_id)) then
    raise exception 'Bạn không có quyền duyệt kế hoạch này' using errcode = '42501';
  end if;
  update public.daily_plans
  set reviewed_by = auth.uid(), reviewed_at = public.fn_now(),
      review_comment = coalesce(v_comment, review_comment)
  where id = p_plan;
  if v_comment is not null then
    perform public.fn_notify_user(v_plan.user_id, 'plan_review',
      'Phản hồi kế hoạch ' || to_char(v_plan.plan_date, 'DD/MM/YYYY'), v_comment, '/bao-cao', true);
  end if;
end;
$$;

create or replace function public.fn_review_report(p_report uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.daily_reports;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  perform public.fn_require_active_user();
  select * into v_report from public.daily_reports where id = p_report;
  if not found or v_report.user_id = auth.uid()
     or not (public.fn_is_manager() or public.fn_is_lead_of_user(v_report.user_id)) then
    raise exception 'Bạn không có quyền duyệt báo cáo này' using errcode = '42501';
  end if;
  update public.daily_reports
  set reviewed_by = auth.uid(), reviewed_at = public.fn_now(),
      review_comment = coalesce(v_comment, review_comment)
  where id = p_report;
  if v_comment is not null then
    perform public.fn_notify_user(v_report.user_id, 'report_review',
      'Phản hồi báo cáo ' || to_char(v_report.report_date, 'DD/MM/YYYY'), v_comment, '/bao-cao', true);
  end if;
end;
$$;

-- Bảng tổng hợp 1 ngày cho lead (thành viên team mình) / manager (tất cả)
create or replace function public.fn_team_day(p_date date default null)
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role public.role_enum,
  teams text[],
  plan_required boolean,
  leave_id uuid,
  leave_type public.leave_type,
  leave_approved boolean,
  plan_id uuid,
  plan_submitted_at timestamptz,
  plan_is_late boolean,
  plan_reviewed_at timestamptz,
  plan_item_count int,
  report_id uuid,
  report_status public.report_status,
  report_submitted_at timestamptz,
  report_reviewed_at timestamptz,
  need_decision text,
  blockers text
)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select coalesce(p_date, public.fn_today_vn()) as day)
  select
    p.id, p.full_name, p.email, p.avatar_url, p.role,
    array(select ut.team_id from public.user_teams ut where ut.user_id = p.id order by ut.team_id),
    public.fn_plan_required(p.id, d.day),
    l.id, l.type, l.approved_at is not null,
    dp.id, dp.submitted_at, dp.is_late, dp.reviewed_at,
    (select count(*)::int from public.daily_plan_items i where i.plan_id = dp.id and i.removed_reason is null),
    r.id, r.status, r.submitted_at, r.reviewed_at, r.need_decision, r.blockers
  from d
  cross join public.profiles p
  left join public.leaves l on l.user_id = p.id and l.date = d.day and l.rejected_at is null
  left join public.daily_plans dp on dp.user_id = p.id and dp.plan_date = d.day
  left join public.daily_reports r on r.user_id = p.id and r.report_date = d.day
  where p.is_active
    and p.id <> auth.uid()
    and public.fn_is_active()
    and (public.fn_is_manager() or public.fn_is_lead_of_user(p.id))
  order by p.full_name;
$$;

-- -----------------------------------------------------------------------------
-- RLS: chỉ đọc (ghi qua RPC)
-- -----------------------------------------------------------------------------
alter table public.daily_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_items enable row level security;
alter table public.report_amendments enable row level security;

create policy daily_plans_select on public.daily_plans for select to authenticated
  using (public.fn_can_view_user_day(user_id));
create policy daily_plan_items_select on public.daily_plan_items for select to authenticated
  using (exists (
    select 1 from public.daily_plans dp
    where dp.id = plan_id and public.fn_can_view_user_day(dp.user_id)
  ));
create policy daily_reports_select on public.daily_reports for select to authenticated
  using (public.fn_can_view_user_day(user_id));
create policy daily_report_items_select on public.daily_report_items for select to authenticated
  using (exists (
    select 1 from public.daily_reports r
    where r.id = report_id and public.fn_can_view_user_day(r.user_id)
  ));
create policy report_amendments_select on public.report_amendments for select to authenticated
  using (exists (
    select 1 from public.daily_reports r
    where r.id = report_id and public.fn_can_view_user_day(r.user_id)
  ));
-- Bổ sung: chỉ tác giả báo cáo, khi báo cáo đã nộp
create policy report_amendments_insert on public.report_amendments for insert to authenticated
  with check (
    public.fn_is_active()
    and author_id = auth.uid()
    and exists (
      select 1 from public.daily_reports r
      where r.id = report_id and r.user_id = auth.uid() and r.submitted_at is not null
    )
  );

revoke insert, update, delete, truncate on
  public.daily_plans, public.daily_plan_items, public.daily_reports, public.daily_report_items
  from anon, authenticated;
revoke update, delete, truncate on public.report_amendments from anon, authenticated;

-- Hàm nội bộ không mở qua API
revoke execute on function public.fn_carry_candidates(uuid, date) from public, anon, authenticated;
revoke execute on function public.fn_assert_my_task(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_primary_team(uuid) from public, anon, authenticated;
