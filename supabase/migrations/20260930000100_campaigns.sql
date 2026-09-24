-- =============================================================================
-- Chiến dịch & mốc công việc (KPI theo đầu mục – chủ yếu cho Marketing)
--   Chiến dịch (vd "Set quà cà phê 20/10", 4 tuần) gồm các mốc, mỗi mốc gắn 1 tuần.
--   KPI tuần = số mốc của tuần đó đã xong. Mốc tự xong khi mọi việc gắn với mốc xong.
--   Xong sớm → trưởng nhóm "đẩy nhanh": kéo các mốc còn lại lên, hạn việc dời theo.
-- =============================================================================

create type public.campaign_status as enum ('planning', 'active', 'done', 'cancelled');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  goal text,                                   -- mục tiêu chiến dịch (kết quả cuối cùng)
  description text,                            -- mô tả sơ bộ / kế hoạch
  start_date date not null check (extract(isodow from start_date) = 1),
  end_date date not null,
  status public.campaign_status not null default 'active',
  owner_id uuid references public.profiles (id) on delete set null,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index campaigns_team_idx on public.campaigns (team_id, start_date desc);

create table public.campaign_milestones (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  week_start date not null check (extract(isodow from week_start) = 1),
  due_date date not null,
  owner_id uuid references public.profiles (id) on delete set null,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  position numeric not null default 0,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,   -- null + done_at = tự hoàn thành
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaign_milestones_campaign_idx on public.campaign_milestones (campaign_id, week_start, position);
create index campaign_milestones_week_idx on public.campaign_milestones (week_start);

alter table public.tasks
  add column milestone_id uuid references public.campaign_milestones (id) on delete set null,
  add column expected_result text;
create index tasks_milestone_idx on public.tasks (milestone_id);

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.fn_set_updated_at();
create trigger campaign_milestones_updated_at before update on public.campaign_milestones
  for each row execute function public.fn_set_updated_at();
create trigger campaigns_audit after insert or update or delete on public.campaigns
  for each row execute function public.fn_audit();
create trigger campaign_milestones_audit after insert or update or delete on public.campaign_milestones
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- Quyền
-- -----------------------------------------------------------------------------
create or replace function public.fn_can_view_campaign(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign and public.fn_is_active() and (
      public.fn_is_manager() or public.fn_in_team(c.team_id)
      or c.owner_id = auth.uid() or c.created_by = auth.uid()
    )
  );
$$;

create or replace function public.fn_can_manage_campaign(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign and public.fn_is_active() and public.fn_can_manage_task(c.team_id)
  );
$$;

alter table public.campaigns enable row level security;
alter table public.campaign_milestones enable row level security;

create policy campaigns_select on public.campaigns for select to authenticated
  using (public.fn_can_view_campaign(id));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (public.fn_is_active() and public.fn_can_manage_task(team_id));
create policy campaigns_update on public.campaigns for update to authenticated
  using (public.fn_is_active() and public.fn_can_manage_task(team_id))
  with check (public.fn_can_manage_task(team_id));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (public.fn_is_active() and public.fn_can_manage_task(team_id));

create policy campaign_milestones_select on public.campaign_milestones for select to authenticated
  using (public.fn_can_view_campaign(campaign_id));
create policy campaign_milestones_insert on public.campaign_milestones for insert to authenticated
  with check (public.fn_can_manage_campaign(campaign_id));
create policy campaign_milestones_update on public.campaign_milestones for update to authenticated
  using (public.fn_can_manage_campaign(campaign_id))
  with check (public.fn_can_manage_campaign(campaign_id));
create policy campaign_milestones_delete on public.campaign_milestones for delete to authenticated
  using (public.fn_can_manage_campaign(campaign_id));

-- Người phụ trách phải thuộc team; ghi nhận ai đánh dấu xong
create or replace function public.fn_campaigns_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.user_teams where user_id = new.owner_id and team_id = new.team_id
  ) and not exists (
    select 1 from public.profiles where id = new.owner_id and role in ('manager', 'admin')
  ) then
    raise exception 'Người phụ trách phải thuộc team của chiến dịch' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger campaigns_guard before insert or update on public.campaigns
  for each row execute function public.fn_campaigns_guard();

create or replace function public.fn_milestones_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.due_date < new.week_start then
    raise exception 'Hạn của mốc phải từ đầu tuần của mốc trở đi' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.done_at is distinct from old.done_at then
    new.done_by := case when new.done_at is null or public.fn_is_system() then null else auth.uid() end;
  elsif tg_op = 'INSERT' and new.done_at is not null then
    new.done_by := case when public.fn_is_system() then null else auth.uid() end;
  end if;
  return new;
end;
$$;
create trigger campaign_milestones_guard before insert or update on public.campaign_milestones
  for each row execute function public.fn_milestones_guard();

-- Việc chỉ gắn vào mốc cùng team; nhân viên không tự đổi mốc / kết quả cần đạt của việc được giao
create or replace function public.fn_tasks_campaign_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.milestone_id is not null
     and (tg_op = 'INSERT'
          or new.milestone_id is distinct from old.milestone_id
          or new.team_id is distinct from old.team_id)
     and not exists (
       select 1 from public.campaign_milestones m join public.campaigns c on c.id = m.campaign_id
       where m.id = new.milestone_id and c.team_id is not distinct from new.team_id
     ) then
    raise exception 'Mốc chiến dịch không thuộc team của việc' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and not public.fn_is_system() and auth.uid() is not null
     and not public.fn_can_manage_task(old.team_id) then
    if new.milestone_id is distinct from old.milestone_id then
      raise exception 'Bạn không có quyền sửa thông tin này của việc' using errcode = '42501';
    end if;
    if new.expected_result is distinct from old.expected_result
       and not (old.created_by = auth.uid() and old.assignee_id = auth.uid()) then
      raise exception 'Chỉ người giao việc được sửa kết quả cần đạt' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger tasks_campaign_guard before insert or update of milestone_id, team_id, expected_result
  on public.tasks for each row execute function public.fn_tasks_campaign_guard();

-- -----------------------------------------------------------------------------
-- Tiến độ & gợi ý đẩy nhanh
-- -----------------------------------------------------------------------------

-- Tất cả mốc đến tuần này đã xong và còn mốc ở tuần sau → có thể đẩy nhanh
create or replace function public.fn_campaign_can_pull(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with w as (select date_trunc('week', public.fn_today_vn())::date as wk)
  select c.status in ('planning', 'active')
    and not exists (
      select 1 from public.campaign_milestones m, w
      where m.campaign_id = c.id and m.done_at is null and m.week_start <= w.wk)
    and exists (
      select 1 from public.campaign_milestones m, w
      where m.campaign_id = c.id and m.done_at is null and m.week_start > w.wk)
  from public.campaigns c where c.id = p_campaign;
$$;

-- Khi 1 mốc xong: nếu có thể đẩy nhanh thì báo người phụ trách chiến dịch (1 lần/tuần)
create or replace function public.fn_milestones_after_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  v_to uuid;
begin
  if new.done_at is null or old.done_at is not null then
    return new;
  end if;
  select * into c from public.campaigns where id = new.campaign_id;
  if public.fn_campaign_can_pull(c.id) then
    v_to := coalesce(c.owner_id, c.created_by);
    if v_to is not null and not exists (
      select 1 from public.notifications n
      where n.user_id = v_to and n.type = 'campaign_ahead' and n.link = '/muc-tieu?tab=campaigns&c=' || c.id
        and n.created_at >= public.fn_vn_at(date_trunc('week', public.fn_today_vn())::date, '00:00')
    ) then
      perform public.fn_notify_user(v_to, 'campaign_ahead',
        'Chiến dịch "' || c.title || '" đang vượt tiến độ',
        'Mọi mốc đến tuần này đã xong. Có thể đẩy nhanh các mốc tuần sau.',
        '/muc-tieu?tab=campaigns&c=' || c.id, false);
    end if;
  end if;
  return new;
end;
$$;
create trigger campaign_milestones_after_done after update of done_at on public.campaign_milestones
  for each row execute function public.fn_milestones_after_done();

-- Việc đổi trạng thái → mốc tự xong khi mọi việc của mốc xong; mở lại nếu có việc bị mở lại
-- (chỉ với mốc tự hoàn thành – mốc do trưởng nhóm đánh dấu tay giữ nguyên)
create or replace function public.fn_tasks_milestone_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ms uuid;
begin
  foreach v_ms in array array_remove(array[new.milestone_id, case when tg_op = 'UPDATE' then old.milestone_id end], null) loop
    perform set_config('app.system', 'on', true);
    if exists (select 1 from public.tasks t where t.milestone_id = v_ms)
       and not exists (select 1 from public.tasks t where t.milestone_id = v_ms and t.status <> 'done') then
      update public.campaign_milestones set done_at = public.fn_now()
      where id = v_ms and done_at is null;
    else
      update public.campaign_milestones set done_at = null
      where id = v_ms and done_at is not null and done_by is null;
    end if;
    perform set_config('app.system', '', true);
  end loop;
  return new;
end;
$$;
create trigger tasks_milestone_progress after insert or update of status, milestone_id on public.tasks
  for each row execute function public.fn_tasks_milestone_progress();

-- Đẩy nhanh: kéo mốc chưa xong gần nhất về tuần này, các mốc sau giữ nguyên khoảng cách.
-- Hạn của mốc và của việc chưa xong gắn với mốc dời sớm tương ứng (không sớm hơn hôm nay).
create or replace function public.fn_campaign_pull_forward(p_campaign uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := date_trunc('week', public.fn_today_vn())::date;
  v_today date := public.fn_today_vn();
  v_next date;
  v_shift int;
  v_n int;
  c public.campaigns;
  m record;
begin
  perform public.fn_require_active_user();
  select * into c from public.campaigns where id = p_campaign;
  if not found or not public.fn_can_manage_task(c.team_id) then
    raise exception 'Bạn không có quyền điều chỉnh chiến dịch này' using errcode = '42501';
  end if;
  if not public.fn_campaign_can_pull(p_campaign) then
    raise exception 'Chưa đẩy nhanh được: còn mốc đến tuần này chưa xong, hoặc không còn mốc nào phía sau'
      using errcode = '22023';
  end if;

  select min(week_start) into v_next from public.campaign_milestones
  where campaign_id = p_campaign and done_at is null;
  v_shift := v_next - v_week;

  update public.campaign_milestones
  set week_start = week_start - v_shift,
      due_date = greatest(due_date - v_shift, least(v_today, due_date))
  where campaign_id = p_campaign and done_at is null;
  get diagnostics v_n = row_count;

  perform set_config('app.system', 'on', true);
  update public.tasks t
  set due_date = greatest(t.due_date - v_shift, least(v_today, t.due_date)),
      start_date = case when t.start_date is null then null
                        else greatest(t.start_date - v_shift, least(v_today, t.start_date)) end
  where t.status <> 'done'
    and t.milestone_id in (select id from public.campaign_milestones
                           where campaign_id = p_campaign and done_at is null);
  perform set_config('app.system', '', true);

  for m in
    select distinct x.uid from (
      select owner_id as uid from public.campaign_milestones where campaign_id = p_campaign and done_at is null
      union
      select t.assignee_id from public.tasks t join public.campaign_milestones cm on cm.id = t.milestone_id
      where cm.campaign_id = p_campaign and cm.done_at is null and t.status <> 'done'
    ) x where x.uid is not null and x.uid <> auth.uid()
  loop
    perform public.fn_notify_user(m.uid, 'campaign_pulled',
      'Chiến dịch "' || c.title || '" được đẩy nhanh ' || (v_shift / 7) || ' tuần',
      'Các mốc và việc liên quan đã dời hạn sớm hơn. Xem lại hạn của bạn.',
      '/muc-tieu?tab=campaigns&c=' || c.id, false);
  end loop;
  return v_n;
end;
$$;

-- Danh sách chiến dịch (kèm tiến độ) mà người gọi xem được
create or replace function public.fn_campaigns(p_team text default null)
returns table (
  id uuid, team_id text, title text, goal text, description text, start_date date, end_date date,
  status public.campaign_status, owner_id uuid, links jsonb, created_by uuid,
  milestone_total int, milestone_done int, current_week_total int, current_week_done int,
  can_pull boolean, can_manage boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (select date_trunc('week', public.fn_today_vn())::date as wk)
  select c.id, c.team_id, c.title, c.goal, c.description, c.start_date, c.end_date, c.status,
         c.owner_id, c.links, c.created_by,
         (select count(*)::int from public.campaign_milestones m where m.campaign_id = c.id),
         (select count(*)::int from public.campaign_milestones m where m.campaign_id = c.id and m.done_at is not null),
         (select count(*)::int from public.campaign_milestones m, w where m.campaign_id = c.id and m.week_start = w.wk),
         (select count(*)::int from public.campaign_milestones m, w where m.campaign_id = c.id and m.week_start = w.wk and m.done_at is not null),
         public.fn_campaign_can_pull(c.id),
         public.fn_can_manage_task(c.team_id)
  from public.campaigns c
  where public.fn_can_view_campaign(c.id) and (p_team is null or c.team_id = p_team)
  order by (c.status in ('done', 'cancelled')), c.start_date desc, c.created_at desc;
$$;

-- Mốc của 1 chiến dịch hoặc của 1 tuần (KPI tuần), kèm số việc xong/tổng
create or replace function public.fn_milestones(p_campaign uuid default null, p_week date default null)
returns table (
  id uuid, campaign_id uuid, campaign_title text, team_id text, title text, description text,
  week_start date, due_date date, owner_id uuid, links jsonb, "position" numeric,
  done_at timestamptz, done_by uuid, task_total int, task_done int
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.campaign_id, c.title, c.team_id, m.title, m.description, m.week_start, m.due_date,
         m.owner_id, m.links, m.position, m.done_at, m.done_by,
         (select count(*)::int from public.tasks t where t.milestone_id = m.id),
         (select count(*)::int from public.tasks t where t.milestone_id = m.id and t.status = 'done')
  from public.campaign_milestones m
  join public.campaigns c on c.id = m.campaign_id
  where public.fn_can_view_campaign(c.id)
    and (p_campaign is null or m.campaign_id = p_campaign)
    and (p_week is null or m.week_start = p_week)
    and (p_campaign is not null or p_week is not null)
    and c.status <> 'cancelled'
  order by m.week_start, m.position, m.created_at;
$$;

revoke execute on function public.fn_campaign_can_pull(uuid) from public, anon;
