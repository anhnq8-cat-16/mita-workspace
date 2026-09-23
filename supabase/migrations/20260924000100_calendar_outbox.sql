-- =============================================================================
-- M1 (1/4): lịch làm việc, giờ hệ thống, domain công ty, nghỉ phép (từ chối),
-- tùy chọn thông báo, hàng đợi gửi email / Google Chat (outbox).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Domain công ty + tài khoản hệ thống (chỉ điền khi còn trống)
-- -----------------------------------------------------------------------------
update public.settings set value = '["mitaexport.com"]'
where key = 'allowed_email_domains' and value = '[]'::jsonb;

update public.settings set value = '"https://work.mitaexport.com"'
where key = 'app_origin' and value = '""'::jsonb;

insert into public.settings (key, value, description) values
  ('system_user_email', '"sale05@mitaexport.com"',
    'Tài khoản Google gửi email hệ thống và quản lý Shared Drive'),
  ('summary_morning_delay_minutes', '15',
    'Gửi tóm tắt buổi sáng sau hạn nộp kế hoạch bao nhiêu phút'),
  ('summary_evening_time', '"18:00"', 'Giờ gửi tóm tắt cuối ngày'),
  ('email_enabled', 'true', 'Bật/tắt gửi email toàn hệ thống (thông báo trong app vẫn chạy)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Giờ hệ thống. app.now chỉ dùng trong test (PostgREST không cho client đặt GUC này).
-- -----------------------------------------------------------------------------
create or replace function public.fn_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now());
$$;

create or replace function public.fn_now_vn()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (public.fn_now() at time zone 'Asia/Ho_Chi_Minh');
$$;

create or replace function public.fn_today_vn()
returns date
language sql
stable
set search_path = ''
as $$
  select (public.fn_now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- Mốc thời gian tuyệt đối của giờ "HH:MM" (giờ Việt Nam) trong ngày p_date
create or replace function public.fn_vn_at(p_date date, p_hhmm text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date + p_hhmm::time) at time zone 'Asia/Ho_Chi_Minh';
$$;

-- Giờ trong settings (dạng "HH:MM") → mốc thời gian của ngày p_date
create or replace function public.fn_setting_at(p_date date, p_key text, p_default text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_vn_at(p_date, coalesce(public.fn_setting(p_key) #>> '{}', p_default));
$$;

-- -----------------------------------------------------------------------------
-- Ngày làm bù (ví dụ Chủ nhật có sự kiện). team_ids rỗng = cả công ty.
-- -----------------------------------------------------------------------------
create table public.extra_workdays (
  date date primary key,
  name text not null,
  team_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger extra_workdays_updated_at before update on public.extra_workdays
  for each row execute function public.fn_set_updated_at();
create trigger extra_workdays_audit after insert or update or delete on public.extra_workdays
  for each row execute function public.fn_audit();
create trigger holidays_audit after insert or update or delete on public.holidays
  for each row execute function public.fn_audit();

alter table public.extra_workdays enable row level security;
create policy extra_workdays_select on public.extra_workdays for select to authenticated
  using (public.fn_is_active());
create policy extra_workdays_admin_all on public.extra_workdays for all to authenticated
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Ngày làm việc chung của công ty (không tính ngày làm bù theo team)
create or replace function public.fn_is_workday(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.holidays h where h.date = p_date)
    and (
      coalesce(public.fn_setting('workdays'), '[1,2,3,4,5,6]'::jsonb)
        @> to_jsonb(extract(isodow from p_date)::int)
      or exists (
        select 1 from public.extra_workdays e
        where e.date = p_date and e.team_ids = '{}'
      )
    );
$$;

-- Ngày làm việc của 1 người (tính cả ngày làm bù của team người đó)
create or replace function public.fn_is_workday_for(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_workday(p_date)
    or (
      not exists (select 1 from public.holidays h where h.date = p_date)
      and exists (
        select 1 from public.extra_workdays e
        where e.date = p_date
          and e.team_ids && array(select ut.team_id from public.user_teams ut where ut.user_id = p_user)
      )
    );
$$;

-- -----------------------------------------------------------------------------
-- Nghỉ phép: thêm trạng thái Từ chối
-- -----------------------------------------------------------------------------
alter table public.leaves
  add column rejected_by uuid references public.profiles (id) on delete set null,
  add column rejected_at timestamptz,
  add column reject_reason text;

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
    if new.approved_at is not null or new.approved_by is not null
       or new.rejected_at is not null or new.rejected_by is not null then
      if not v_can_approve then
        raise exception 'Bạn không có quyền duyệt ngày nghỉ này' using errcode = '42501';
      end if;
      if new.approved_at is not null then
        new.approved_by := auth.uid();
      end if;
      if new.rejected_at is not null then
        new.rejected_by := auth.uid();
      end if;
    end if;
    return new;
  end if;

  if (new.approved_at is distinct from old.approved_at)
     or (new.approved_by is distinct from old.approved_by)
     or (new.rejected_at is distinct from old.rejected_at)
     or (new.rejected_by is distinct from old.rejected_by) then
    if not v_can_approve then
      raise exception 'Bạn không có quyền duyệt ngày nghỉ này' using errcode = '42501';
    end if;
    new.approved_by := case when new.approved_at is not null then auth.uid() end;
    new.rejected_by := case when new.rejected_at is not null then auth.uid() end;
    if new.approved_at is not null and new.rejected_at is not null then
      raise exception 'Ngày nghỉ không thể vừa duyệt vừa từ chối' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

-- Người dùng tự sửa/xóa khi chưa duyệt và chưa bị từ chối
drop policy leaves_update on public.leaves;
create policy leaves_update on public.leaves for update to authenticated
  using (
    public.fn_is_active() and (
      (user_id = auth.uid() and approved_at is null and rejected_at is null)
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
drop policy leaves_delete on public.leaves;
create policy leaves_delete on public.leaves for delete to authenticated
  using (
    public.fn_is_active() and (
      (user_id = auth.uid() and approved_at is null and rejected_at is null)
      or public.fn_is_admin()
    )
  );

-- Có khai báo nghỉ (chờ duyệt hoặc đã duyệt, chưa bị từ chối) → bỏ qua cổng kế hoạch
create or replace function public.fn_has_leave(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leaves l
    where l.user_id = p_user and l.date = p_date and l.rejected_at is null
  );
$$;

-- -----------------------------------------------------------------------------
-- Tùy chọn thông báo: {"email_off": ["summary", ...]} – người dùng tự sửa
-- -----------------------------------------------------------------------------
alter table public.profiles add column notification_prefs jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Outbox: email / Google Chat chờ gửi. Edge Function `notify` đọc bằng service role.
-- -----------------------------------------------------------------------------
create type public.outbox_channel as enum ('email', 'chat');
create type public.outbox_status as enum ('pending', 'sent', 'failed');

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  channel public.outbox_channel not null,
  recipient text not null,           -- email hoặc URL webhook Google Chat
  subject text,
  body text not null,
  type text not null,
  status public.outbox_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_pending_idx on public.outbox (created_at) where status = 'pending';
create trigger outbox_updated_at before update on public.outbox
  for each row execute function public.fn_set_updated_at();

alter table public.outbox enable row level security;
create policy outbox_admin_select on public.outbox for select to authenticated
  using (public.fn_is_admin());
revoke insert, update, delete, truncate on public.outbox from anon, authenticated;

-- Thông báo cho 1 người: chuông trong app + (tùy chọn) email.
-- p_mandatory = true: không tắt được (nhắc kế hoạch/báo cáo).
create or replace function public.fn_notify_user(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_email boolean default false,
  p_mandatory boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_origin text := coalesce(public.fn_setting('app_origin') #>> '{}', '');
begin
  select * into v_profile from public.profiles where id = p_user and is_active;
  if not found then
    return;
  end if;

  perform public.fn_notify(p_user, p_type, p_title, p_body, p_link);

  if p_email
     and coalesce((public.fn_setting('email_enabled'))::boolean, true)
     and (p_mandatory or not coalesce(v_profile.notification_prefs -> 'email_off', '[]'::jsonb) ? p_type)
  then
    insert into public.outbox (channel, recipient, subject, body, type)
    values (
      'email',
      v_profile.email,
      '[Mita Workspace] ' || p_title,
      concat_ws(E'\n\n',
        'Chào ' || coalesce(v_profile.full_name, v_profile.email) || ',',
        p_body,
        case when p_link is not null and v_origin <> '' then 'Mở: ' || v_origin || p_link end,
        '— Mita Workspace'),
      p_type
    );
  end if;
end;
$$;
revoke execute on function public.fn_notify_user(uuid, text, text, text, text, boolean, boolean)
  from public, anon, authenticated;

create or replace function public.fn_post_chat(p_type text, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := coalesce(public.fn_setting('google_chat_webhook') #>> '{}', '');
begin
  if v_url <> '' then
    insert into public.outbox (channel, recipient, body, type) values ('chat', v_url, p_text, p_type);
  end if;
end;
$$;
revoke execute on function public.fn_post_chat(text, text) from public, anon, authenticated;

-- Trưởng nhóm của các team mà p_user thuộc về (trừ chính p_user)
create or replace function public.fn_leads_of(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct lead.user_id
  from public.user_teams mine
  join public.user_teams lead on lead.team_id = mine.team_id and lead.is_lead
  join public.profiles p on p.id = lead.user_id and p.is_active
  where mine.user_id = p_user and lead.user_id <> p_user;
$$;
revoke execute on function public.fn_leads_of(uuid) from public, anon, authenticated;

-- Thông báo khi khai báo / duyệt / từ chối nghỉ
create or replace function public.fn_leaves_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_lead uuid;
  v_date text := to_char(new.date, 'DD/MM/YYYY');
begin
  select coalesce(full_name, email) into v_name from public.profiles where id = new.user_id;
  if tg_op = 'INSERT' and new.approved_at is null then
    for v_lead in select public.fn_leads_of(new.user_id) loop
      perform public.fn_notify_user(v_lead, 'leave_request', v_name || ' khai báo nghỉ ' || v_date,
        new.note, '/bao-cao?tab=team', true);
    end loop;
  elsif tg_op = 'UPDATE' and new.approved_at is not null and old.approved_at is null then
    perform public.fn_notify_user(new.user_id, 'leave_approved', 'Ngày nghỉ ' || v_date || ' đã được duyệt',
      null, '/bao-cao', false);
  elsif tg_op = 'UPDATE' and new.rejected_at is not null and old.rejected_at is null then
    perform public.fn_notify_user(new.user_id, 'leave_rejected', 'Ngày nghỉ ' || v_date || ' bị từ chối',
      new.reject_reason, '/bao-cao', true);
  end if;
  return new;
end;
$$;
create trigger leaves_notify after insert or update on public.leaves
  for each row execute function public.fn_leaves_notify();
