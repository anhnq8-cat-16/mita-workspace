-- Hàm hỗ trợ test RLS (tạo người dùng giả, đăng nhập giả). Chạy đầu tiên, không rollback.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Tạo người dùng qua đúng luồng thật: (lời mời) + insert auth.users → trigger tạo profile.
create or replace function tests.create_user(
  p_email text,
  p_role public.role_enum default 'staff',
  p_teams text[] default '{}',
  p_lead_teams text[] default '{}',
  p_invite boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_invite then
    insert into public.invitations (email, full_name, role, teams, lead_teams)
    values (lower(p_email), split_part(p_email, '@', 1), p_role, p_teams, p_lead_teams)
    on conflict (email) do nothing;
  end if;
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (v_id, lower(p_email), jsonb_build_object('full_name', split_part(p_email, '@', 1)),
          'authenticated', 'authenticated');
  return v_id;
end;
$$;

create or replace function tests.get_user_id(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where email = lower(p_email)
$$;

create or replace function tests.authenticate_as(p_email text) returns void
language plpgsql set search_path = public as $$
declare
  v_id uuid := tests.get_user_id(p_email);
begin
  if v_id is null then
    raise exception 'tests.authenticate_as: không có người dùng %', p_email;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', lower(p_email))::text, true);
end;
$$;

create or replace function tests.authenticate_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

create or replace function tests.clear_authentication() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Tạo bộ người dùng chuẩn theo SPEC mục 2.4 (domain test: mita.test)
create or replace function tests.seed_roster() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.settings set value = '["mita.test"]' where key = 'allowed_email_domains';
  perform tests.create_user('admin@mita.test', 'admin', '{sales_domestic,marketing}');
  perform tests.create_user('manager@mita.test', 'manager', '{sales_domestic,marketing,export}');
  perform tests.create_user('trang@mita.test', 'lead', '{sales_domestic,marketing,export}',
                            '{sales_domestic,marketing,export}');
  perform tests.create_user('mai@mita.test', 'lead', '{sales_domestic}', '{sales_domestic}');
  perform tests.create_user('kien@mita.test', 'staff', '{marketing,sales_domestic}');
  perform tests.create_user('long@mita.test', 'staff', '{sales_domestic}');
  perform tests.create_user('hue@mita.test', 'staff', '{export}');
  perform tests.create_user('mkt@mita.test', 'staff', '{marketing}');
end;
$$;

-- Giả lập thời điểm hiện tại (fn_now đọc app.now), ví dụ '2026-09-29 08:30+07'
create or replace function tests.set_now(p_ts text) returns void
language plpgsql as $$
begin
  perform set_config('app.now', p_ts, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

set search_path = public, extensions;
select plan(1);
select ok(true, 'helpers ready');
select * from finish();
