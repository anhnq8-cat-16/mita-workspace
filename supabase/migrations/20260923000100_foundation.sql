-- =============================================================================
-- M0 – Nền tảng: hồ sơ người dùng, team, lời mời, cài đặt, ngày lễ, nghỉ phép,
-- thông báo, nhật ký thay đổi (audit_log) + các hàm tiện ích dùng chung.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
create type public.role_enum as enum ('admin', 'manager', 'lead', 'staff');
create type public.leave_type as enum ('nghi_phep', 'cong_tac', 'om', 'khac');
create type public.audit_action as enum ('insert', 'update', 'delete');

-- -----------------------------------------------------------------------------
-- Trigger cập nhật updated_at
-- -----------------------------------------------------------------------------
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bảng
-- -----------------------------------------------------------------------------
create table public.teams (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  full_name text,
  phone text,
  avatar_url text,
  role public.role_enum not null default 'staff',
  is_active boolean not null default false,
  -- lần đầu được kích hoạt; null + is_active=false = đang chờ, có giá trị + false = đã khóa
  activated_at timestamptz,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_teams (
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index user_teams_team_idx on public.user_teams (team_id);

-- Lời mời: admin nhập email trước khi người đó đăng nhập lần đầu.
-- Khi tài khoản Google tương ứng đăng nhập, hồ sơ được tạo và kích hoạt ngay.
create table public.invitations (
  email text primary key check (email = lower(email)),
  full_name text,
  role public.role_enum not null default 'staff',
  teams text[] not null default '{}',
  lead_teams text[] not null default '{}',
  title text,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.holidays (
  date date primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  type public.leave_type not null default 'nghi_phep',
  note text,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index leaves_date_idx on public.leaves (date);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id text,
  action public.audit_action not null,
  actor_id uuid,
  diff jsonb,
  at timestamptz not null default now()
);
create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_at_idx on public.audit_log (at desc);

create trigger teams_updated_at before update on public.teams
  for each row execute function public.fn_set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.fn_set_updated_at();
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.fn_set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.fn_set_updated_at();
create trigger holidays_updated_at before update on public.holidays
  for each row execute function public.fn_set_updated_at();
create trigger leaves_updated_at before update on public.leaves
  for each row execute function public.fn_set_updated_at();
create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- Hàm tiện ích: thời gian Việt Nam, cài đặt, ngày làm việc
-- -----------------------------------------------------------------------------
create or replace function public.fn_now_vn()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh');
$$;

create or replace function public.fn_today_vn()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- Đọc 1 giá trị cài đặt (jsonb). Security definer để các hàm/trigger khác
-- đọc được cả khi người gọi chưa được kích hoạt.
create or replace function public.fn_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.value from public.settings s where s.key = p_key;
$$;
-- Không mở qua API (có thể chứa webhook); chỉ dùng nội bộ trong hàm security definer
revoke execute on function public.fn_setting(text) from public, anon, authenticated;

create or replace function public.fn_is_workday(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public.fn_setting('workdays'), '[1,2,3,4,5,6]'::jsonb)
      @> to_jsonb(extract(isodow from p_date)::int)
    and not exists (select 1 from public.holidays h where h.date = p_date);
$$;

-- -----------------------------------------------------------------------------
-- Hàm phân quyền (security definer để tránh đệ quy RLS trên profiles)
-- -----------------------------------------------------------------------------
create or replace function public.fn_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.fn_my_role()
returns public.role_enum
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.fn_my_role() = 'admin', false);
$$;

-- manager hoặc admin
create or replace function public.fn_is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.fn_my_role() in ('manager', 'admin'), false);
$$;

create or replace function public.fn_my_team_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select ut.team_id
  from public.user_teams ut
  where ut.user_id = auth.uid() and public.fn_is_active();
$$;

-- Team mà người gọi làm trưởng nhóm (is_lead) và có vai trò lead/manager/admin
create or replace function public.fn_my_led_team_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select ut.team_id
  from public.user_teams ut
  where ut.user_id = auth.uid()
    and ut.is_lead
    and public.fn_my_role() in ('lead', 'manager', 'admin');
$$;

create or replace function public.fn_in_team(p_team text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.fn_my_team_ids() t where t = p_team);
$$;

create or replace function public.fn_is_lead_of_team(p_team text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.fn_my_led_team_ids() t where t = p_team);
$$;

-- Người gọi là trưởng nhóm của ít nhất 1 team mà p_user thuộc về
create or replace function public.fn_is_lead_of_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_teams ut
    where ut.user_id = p_user
      and ut.team_id in (select public.fn_my_led_team_ids())
  );
$$;

-- -----------------------------------------------------------------------------
-- Thông báo trong app (dùng bởi trigger/cron ở các milestone sau)
-- -----------------------------------------------------------------------------
create or replace function public.fn_notify(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.fn_notify(uuid, text, text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nhật ký thay đổi
-- -----------------------------------------------------------------------------
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
  v_row_id text;
  v_key text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_diff := jsonb_build_object('new', v_new);
    v_row_id := coalesce(v_new ->> 'id', v_new ->> 'key', v_new ->> 'date');
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_diff := '{}'::jsonb;
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return new;
    end if;
    v_row_id := coalesce(v_new ->> 'id', v_new ->> 'key', v_new ->> 'date');
  else
    v_old := to_jsonb(old);
    v_diff := jsonb_build_object('old', v_old);
    v_row_id := coalesce(v_old ->> 'id', v_old ->> 'key', v_old ->> 'date');
  end if;

  insert into public.audit_log (table_name, row_id, action, actor_id, diff)
  values (tg_table_name, v_row_id, lower(tg_op)::public.audit_action, auth.uid(), v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.fn_audit();
create trigger settings_audit after insert or update or delete on public.settings
  for each row execute function public.fn_audit();

-- Ghi người sửa cài đặt
create or replace function public.fn_settings_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger settings_stamp before insert or update on public.settings
  for each row execute function public.fn_settings_stamp();

-- -----------------------------------------------------------------------------
-- Bảo vệ cột nhạy cảm của profiles: chỉ admin (hoặc hệ thống) đổi role,
-- is_active, email, họ tên, chức danh. Người dùng tự sửa phone/avatar.
-- Không cho khóa/hạ quyền admin cuối cùng.
-- -----------------------------------------------------------------------------
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.fn_is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.full_name is distinct from old.full_name
       or new.title is distinct from old.title then
      raise exception 'Bạn chỉ được sửa số điện thoại và ảnh đại diện của mình'
        using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.is_active and p.id <> old.id
     ) then
    raise exception 'Không thể khóa hoặc hạ quyền quản trị viên cuối cùng'
      using errcode = '42501';
  end if;

  if new.is_active and new.activated_at is null then
    new.activated_at := now();
  end if;

  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.fn_profiles_guard();

-- -----------------------------------------------------------------------------
-- Áp dụng lời mời vào hồ sơ (role, team, kích hoạt)
-- -----------------------------------------------------------------------------
create or replace function public.fn_apply_invitation(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
begin
  select * into inv from public.invitations i where i.email = p_email;
  if not found then
    return false;
  end if;

  update public.profiles
  set role = inv.role,
      is_active = true,
      full_name = coalesce(inv.full_name, full_name),
      title = coalesce(inv.title, title)
  where id = p_user;

  insert into public.user_teams (user_id, team_id, is_lead)
  select p_user, t, t = any (inv.lead_teams)
  from unnest(inv.teams) t
  where exists (select 1 from public.teams where id = t)
  on conflict (user_id, team_id) do update set is_lead = excluded.is_lead;

  update public.invitations set accepted_at = now() where email = p_email;
  return true;
end;
$$;
revoke execute on function public.fn_apply_invitation(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tài khoản mới (auth.users insert): chặn email ngoài domain, tạo hồ sơ.
-- -----------------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_domain text := split_part(v_email, '@', 2);
  v_allowed jsonb := coalesce(public.fn_setting('allowed_email_domains'), '[]'::jsonb);
begin
  if v_email = '' or v_domain = '' then
    raise exception 'Tài khoản không có email hợp lệ' using errcode = '42501';
  end if;

  if not (v_allowed @> to_jsonb(v_domain)) then
    raise exception 'Chỉ tài khoản thuộc domain công ty được phép đăng nhập (%).', v_email
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, is_active)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    false
  )
  on conflict (id) do nothing;

  perform public.fn_apply_invitation(new.id, v_email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- Mời người đã đăng nhập trước đó (đang ở màn hình chờ) → kích hoạt ngay
create or replace function public.fn_invitation_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select p.id into v_user from public.profiles p where p.email = new.email;
  if v_user is not null and new.accepted_at is null then
    perform public.fn_apply_invitation(v_user, new.email);
  end if;
  return new;
end;
$$;
create trigger invitations_apply after insert on public.invitations
  for each row execute function public.fn_invitation_after_insert();

create or replace function public.fn_invitation_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  if new.invited_by is null then
    new.invited_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger invitations_stamp before insert on public.invitations
  for each row execute function public.fn_invitation_stamp();

-- -----------------------------------------------------------------------------
-- Nghỉ phép: chỉ người có quyền duyệt mới được ghi approved_by/approved_at;
-- không tự duyệt cho mình (trừ admin).
-- -----------------------------------------------------------------------------
create or replace function public.fn_leaves_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_approve boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_can_approve := public.fn_is_manager()
    or (public.fn_is_lead_of_user(new.user_id) and new.user_id <> auth.uid());

  if tg_op = 'INSERT' then
    if new.approved_at is not null or new.approved_by is not null then
      if not v_can_approve then
        raise exception 'Bạn không có quyền duyệt ngày nghỉ này' using errcode = '42501';
      end if;
      new.approved_by := auth.uid();
      new.approved_at := coalesce(new.approved_at, now());
    end if;
    return new;
  end if;

  if (new.approved_at is distinct from old.approved_at)
     or (new.approved_by is distinct from old.approved_by) then
    if not v_can_approve then
      raise exception 'Bạn không có quyền duyệt ngày nghỉ này' using errcode = '42501';
    end if;
    if new.approved_at is not null then
      new.approved_by := auth.uid();
    else
      new.approved_by := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger leaves_guard before insert or update on public.leaves
  for each row execute function public.fn_leaves_guard();

-- Người dùng có nghỉ đã duyệt vào ngày p_date không
create or replace function public.fn_on_leave(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leaves l
    where l.user_id = p_user and l.date = p_date and l.approved_at is not null
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.user_teams enable row level security;
alter table public.invitations enable row level security;
alter table public.settings enable row level security;
alter table public.holidays enable row level security;
alter table public.leaves enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- teams
create policy teams_select on public.teams for select to authenticated
  using (public.fn_is_active());
create policy teams_admin_all on public.teams for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- profiles: ai cũng đọc được hồ sơ của chính mình (để hiện màn hình chờ);
-- người đã kích hoạt đọc được tất cả.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.fn_is_active());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and public.fn_is_active())
  with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- user_teams
create policy user_teams_select on public.user_teams for select to authenticated
  using (user_id = auth.uid() or public.fn_is_active());
create policy user_teams_admin_all on public.user_teams for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- invitations: chỉ admin
create policy invitations_admin_all on public.invitations for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- settings: đọc (người đã kích hoạt); admin đọc/ghi, không xóa
create policy settings_select on public.settings for select to authenticated
  using (public.fn_is_active());
create policy settings_admin_insert on public.settings for insert to authenticated
  with check (public.fn_is_admin());
create policy settings_admin_update on public.settings for update to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- holidays
create policy holidays_select on public.holidays for select to authenticated
  using (public.fn_is_active());
create policy holidays_admin_all on public.holidays for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- leaves
create policy leaves_select on public.leaves for select to authenticated
  using (
    public.fn_is_active() and (
      user_id = auth.uid()
      or public.fn_is_manager()
      or public.fn_is_lead_of_user(user_id)
    )
  );
create policy leaves_insert on public.leaves for insert to authenticated
  with check (
    public.fn_is_active() and (user_id = auth.uid() or public.fn_is_admin())
  );
create policy leaves_update on public.leaves for update to authenticated
  using (
    public.fn_is_active() and (
      (user_id = auth.uid() and approved_at is null)
      or public.fn_is_manager()
      or public.fn_is_lead_of_user(user_id)
    )
  )
  with check (
    public.fn_is_active() and (
      user_id = auth.uid()
      or public.fn_is_manager()
      or public.fn_is_lead_of_user(user_id)
    )
  );
create policy leaves_delete on public.leaves for delete to authenticated
  using (
    public.fn_is_active() and (
      (user_id = auth.uid() and approved_at is null) or public.fn_is_admin()
    )
  );

-- notifications: của mình; tạo qua fn_notify (security definer) hoặc service role
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.fn_is_admin());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid() or public.fn_is_admin());
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check (public.fn_is_admin());

-- audit_log: manager/admin đọc; không ai sửa/xóa qua API
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.fn_is_manager());
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- anon không có quyền gì trên các bảng nghiệp vụ
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Realtime: thông báo (chuông) cập nhật tức thì
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
