-- =============================================================================
-- M3: Sales – lead, hoạt động, khách hàng, đơn hàng, check-in thị trường.
-- Quyền (SPEC mục 6):
--   Sale (team sales_domestic): RW lead được giao / do mình tạo; RW khách & đơn của mình.
--   Marketing: tạo lead; chỉ xem trạng thái lead mình tạo (ẩn SĐT/email sau khi giao) – qua RPC.
--   Trưởng nhóm Sale ("sales admin") + admin: RW tất cả. Manager: chỉ đọc.
-- =============================================================================

create type public.lead_stage as enum
  ('new', 'contacted', 'consulting', 'sample_sent', 'quoted', 'won', 'lost');
create type public.activity_type as enum
  ('call', 'zalo', 'meeting', 'visit', 'email', 'sample', 'quote', 'note');
create type public.customer_type as enum
  ('cafe', 'agent', 'retail_store', 'corporate_gift', 'individual', 'fruit_b2b', 'other');
create type public.customer_status as enum ('active', 'inactive');
create type public.order_status as enum ('draft', 'confirmed', 'delivered', 'cancelled');

insert into public.settings (key, value, description) values
  ('sales_owner_id', '""', 'Chủ dữ liệu Sales (id người dùng) – nhận hàng chờ lead & cảnh báo SLA. Trống = mọi trưởng nhóm Sale'),
  ('lead_sla_check_hours', '{"from": 8, "to": 18}', 'Khung giờ kiểm tra SLA lead mỗi giờ'),
  ('followup_time', '"08:00"', 'Giờ nhắc lead cần follow-up trong ngày')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Chuẩn hóa SĐT để kiểm tra trùng: bỏ ký tự khác số, +84/84 → 0
-- -----------------------------------------------------------------------------
create or replace function public.fn_norm_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    case
      when d ~ '^84\d{9}$' then '0' || substr(d, 3)
      else d
    end, '')
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

-- -----------------------------------------------------------------------------
-- Quyền Sales
-- -----------------------------------------------------------------------------
-- Trưởng nhóm Sale hoặc admin: RW toàn bộ dữ liệu Sales
create or replace function public.fn_is_sales_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_admin() or public.fn_is_lead_of_team('sales_domestic');
$$;

create or replace function public.fn_can_read_all_sales()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_manager() or public.fn_is_sales_admin();
$$;

create or replace function public.fn_in_sales()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_in_team('sales_domestic');
$$;

-- Người nhận hàng chờ lead / cảnh báo SLA
create or replace function public.fn_sales_owners()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := nullif(public.fn_setting('sales_owner_id') #>> '{}', '')::uuid;
begin
  if v_owner is not null and exists (select 1 from public.profiles where id = v_owner and is_active) then
    return next v_owner;
    return;
  end if;
  return query
    select distinct ut.user_id from public.user_teams ut
    join public.profiles p on p.id = ut.user_id and p.is_active and p.role in ('lead', 'admin')
    where ut.team_id = 'sales_domestic' and ut.is_lead;
end;
$$;
revoke execute on function public.fn_sales_owners() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Khách hàng
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type public.customer_type not null default 'other',
  contact_name text,
  phone text,
  phone_norm text generated always as (public.fn_norm_phone(phone)) stored,
  email text,
  address text,
  district text,
  lat double precision,
  lng double precision,
  owner_id uuid references public.profiles (id) on delete set null,
  status public.customer_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_owner_idx on public.customers (owner_id);
create index customers_phone_idx on public.customers (phone_norm);
create index customers_name_idx on public.customers (lower(name));

-- -----------------------------------------------------------------------------
-- Lead
-- -----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  company text,
  contact_name text,
  phone text,
  phone_norm text generated always as (public.fn_norm_phone(phone)) stored,
  email text,
  zalo text,
  address text,
  district text,
  source text,
  segment text,
  product_interest text[] not null default '{}',
  stage public.lead_stage not null default 'new',
  lost_reason text,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  first_contact_due_at timestamptz not null,
  first_contacted_at timestamptz,
  sla_notified_at timestamptz,
  next_follow_up_at timestamptz,
  est_value_vnd numeric check (est_value_vnd is null or est_value_vnd >= 0),
  notes text,
  customer_id uuid references public.customers (id) on delete set null,
  won_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'lost' or length(trim(coalesce(lost_reason, ''))) > 0)
);
create index leads_assigned_idx on public.leads (assigned_to, stage);
create index leads_created_by_idx on public.leads (created_by);
create index leads_phone_idx on public.leads (phone_norm);
create index leads_email_idx on public.leads (lower(email));
create index leads_company_idx on public.leads (lower(company));
create index leads_sla_idx on public.leads (first_contact_due_at) where first_contacted_at is null;
create index leads_followup_idx on public.leads (next_follow_up_at) where next_follow_up_at is not null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  type public.activity_type not null,
  content text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, happened_at desc);
create index lead_activities_user_idx on public.lead_activities (user_id, happened_at);

-- -----------------------------------------------------------------------------
-- Đơn hàng (số Sale tự báo để theo dõi KPI; số kế toán là nguồn chuẩn)
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  sales_id uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  order_date date not null default public.fn_today_vn(),
  total_value_vnd numeric not null default 0 check (total_value_vnd >= 0),
  items_summary text,
  status public.order_status not null default 'draft',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_sales_date_idx on public.orders (sales_id, order_date);
create index orders_customer_idx on public.orders (customer_id);

-- -----------------------------------------------------------------------------
-- Check-in thị trường
-- -----------------------------------------------------------------------------
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  photo_drive_file_id text,
  photo_web_link text,
  place_name text,
  note text,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create index check_ins_user_time_idx on public.check_ins (user_id, checked_in_at desc);
create index check_ins_time_idx on public.check_ins (checked_in_at);

-- updated_at + audit
create trigger customers_updated_at before update on public.customers
  for each row execute function public.fn_set_updated_at();
create trigger leads_updated_at before update on public.leads
  for each row execute function public.fn_set_updated_at();
create trigger lead_activities_updated_at before update on public.lead_activities
  for each row execute function public.fn_set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.fn_set_updated_at();
create trigger check_ins_updated_at before update on public.check_ins
  for each row execute function public.fn_set_updated_at();
create trigger customers_audit after insert or update or delete on public.customers
  for each row execute function public.fn_audit();
create trigger leads_audit after insert or update or delete on public.leads
  for each row execute function public.fn_audit();
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function public.fn_audit();

-- -----------------------------------------------------------------------------
-- Hàm quyền theo từng dòng
-- -----------------------------------------------------------------------------
create or replace function public.fn_can_write_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_active() and (
    public.fn_is_sales_admin()
    or exists (
      select 1 from public.leads l
      where l.id = p_lead and public.fn_in_sales() and l.assigned_to = auth.uid()
    )
  );
$$;

create or replace function public.fn_owns_customer(p_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.customers c where c.id = p_customer and c.owner_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Kiểm soát ghi
-- -----------------------------------------------------------------------------
create or replace function public.fn_leads_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.fn_is_system() or public.fn_is_sales_admin() then
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to
     or new.created_by is distinct from old.created_by
     or new.customer_id is distinct from old.customer_id
     or new.first_contact_due_at is distinct from old.first_contact_due_at
     or new.first_contacted_at is distinct from old.first_contacted_at
     or new.sla_notified_at is distinct from old.sla_notified_at
     or new.won_at is distinct from old.won_at then
    raise exception 'Bạn không có quyền sửa thông tin này của lead' using errcode = '42501';
  end if;
  if new.stage = 'won' and old.stage <> 'won' then
    raise exception 'Dùng nút "Chốt đơn" để chuyển lead sang Thành công' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger leads_guard before update on public.leads
  for each row execute function public.fn_leads_guard();

create or replace function public.fn_customers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.fn_is_system() or public.fn_is_sales_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
  elsif new.owner_id is distinct from old.owner_id then
    raise exception 'Chỉ trưởng nhóm Sale chuyển giao khách hàng' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger customers_guard before insert or update on public.customers
  for each row execute function public.fn_customers_guard();

create or replace function public.fn_orders_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.fn_is_system() or public.fn_is_sales_admin() then
    new.sales_id := coalesce(new.sales_id, auth.uid());
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.sales_id := auth.uid();
  elsif new.sales_id is distinct from old.sales_id then
    raise exception 'Chỉ trưởng nhóm Sale đổi người bán' using errcode = '42501';
  end if;
  if not public.fn_owns_customer(new.customer_id) then
    raise exception 'Chỉ tạo đơn cho khách hàng của bạn' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.fn_orders_guard();

-- Hoạt động đầu tiên → ghi nhận đã liên hệ; tự tiến giai đoạn theo loại hoạt động
create or replace function public.fn_lead_activities_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_order public.lead_stage[] := array['new','contacted','consulting','sample_sent','quoted']::public.lead_stage[];
  v_target public.lead_stage;
begin
  select * into v_lead from public.leads where id = new.lead_id;
  v_target := case new.type
    when 'sample' then 'sample_sent'
    when 'quote' then 'quoted'
    when 'meeting' then 'consulting'
    when 'note' then v_lead.stage
    else 'contacted'
  end;
  perform set_config('app.system', 'on', true);
  update public.leads
  set first_contacted_at = case
        when first_contacted_at is null and new.type <> 'note' then new.happened_at
        else first_contacted_at end,
      stage = case
        when stage in ('won', 'lost') then stage
        when array_position(v_order, v_target) > array_position(v_order, stage) then v_target
        else stage end
  where id = new.lead_id;
  perform set_config('app.system', '', true);
  return null;
end;
$$;
create trigger lead_activities_after after insert on public.lead_activities
  for each row execute function public.fn_lead_activities_after();

-- Check-in: chỉ sửa ghi chú / check-out của mình
create or replace function public.fn_check_ins_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.fn_is_system() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.checked_in_at := public.fn_now();
    new.checked_out_at := null;
    return new;
  end if;
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng
     or new.checked_in_at is distinct from old.checked_in_at
     or new.user_id is distinct from old.user_id
     or new.photo_drive_file_id is distinct from old.photo_drive_file_id then
    raise exception 'Không sửa được vị trí, giờ và ảnh check-in' using errcode = '42501';
  end if;
  if new.checked_out_at is not null and old.checked_out_at is null then
    new.checked_out_at := public.fn_now();
  end if;
  return new;
end;
$$;
create trigger check_ins_guard before insert or update on public.check_ins
  for each row execute function public.fn_check_ins_guard();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.orders enable row level security;
alter table public.check_ins enable row level security;

create policy leads_select on public.leads for select to authenticated
  using (
    public.fn_is_active() and (
      public.fn_can_read_all_sales()
      or (public.fn_in_sales() and (assigned_to = auth.uid() or created_by = auth.uid()))
    )
  );
create policy leads_update on public.leads for update to authenticated
  using (public.fn_can_write_lead(id)) with check (public.fn_is_active());
create policy leads_delete on public.leads for delete to authenticated
  using (public.fn_is_admin());
-- Tạo lead qua fn_create_lead (kiểm tra trùng, SLA, phân công)
revoke insert on public.leads from anon, authenticated;

create policy lead_activities_select on public.lead_activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));   -- RLS của leads áp dụng
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (user_id = auth.uid() and public.fn_can_write_lead(lead_id));
create policy lead_activities_admin on public.lead_activities for delete to authenticated
  using (public.fn_is_admin());
revoke update on public.lead_activities from anon, authenticated;

create policy customers_select on public.customers for select to authenticated
  using (public.fn_is_active() and (public.fn_can_read_all_sales() or owner_id = auth.uid()));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.fn_is_active() and (public.fn_in_sales() or public.fn_is_sales_admin()));
create policy customers_update on public.customers for update to authenticated
  using (public.fn_is_active() and (public.fn_is_sales_admin() or owner_id = auth.uid()))
  with check (public.fn_is_active());
create policy customers_delete on public.customers for delete to authenticated
  using (public.fn_is_admin());

create policy orders_select on public.orders for select to authenticated
  using (public.fn_is_active() and (public.fn_can_read_all_sales() or sales_id = auth.uid()));
create policy orders_insert on public.orders for insert to authenticated
  with check (public.fn_is_active() and (public.fn_in_sales() or public.fn_is_sales_admin()));
create policy orders_update on public.orders for update to authenticated
  using (public.fn_is_active() and (public.fn_is_sales_admin() or sales_id = auth.uid()))
  with check (public.fn_is_active());
create policy orders_delete on public.orders for delete to authenticated
  using (public.fn_is_admin());

create policy check_ins_select on public.check_ins for select to authenticated
  using (
    public.fn_is_active() and (
      user_id = auth.uid() or public.fn_is_manager() or public.fn_is_lead_of_user(user_id)
    )
  );
create policy check_ins_insert on public.check_ins for insert to authenticated
  with check (public.fn_is_active() and user_id = auth.uid());
create policy check_ins_update on public.check_ins for update to authenticated
  using (user_id = auth.uid() and public.fn_is_active()) with check (user_id = auth.uid());
revoke delete on public.check_ins from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leads;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Kiểm tra trùng theo SĐT / email / tên công ty trên toàn bộ lead + khách (chỉ trả tối thiểu)
create or replace function public.fn_find_lead_duplicates(
  p_phone text default null,
  p_email text default null,
  p_company text default null,
  p_exclude uuid default null
)
returns table (kind text, id uuid, name text, company text, stage text, owner_name text, matched text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select public.fn_norm_phone(p_phone) as phone,
           nullif(lower(trim(coalesce(p_email, ''))), '') as email,
           nullif(lower(trim(coalesce(p_company, ''))), '') as company
  )
  select 'lead', l.id, l.name, l.company, l.stage::text,
         coalesce(p.full_name, p.email),
         case when l.phone_norm = q.phone then 'phone'
              when lower(l.email) = q.email then 'email' else 'company' end
  from q, public.leads l
  left join public.profiles p on p.id = l.assigned_to
  where public.fn_is_active()
    and (public.fn_in_sales() or public.fn_in_team('marketing') or public.fn_can_read_all_sales())
    and (l.id is distinct from p_exclude)
    and ((q.phone is not null and l.phone_norm = q.phone)
      or (q.email is not null and lower(l.email) = q.email)
      or (q.company is not null and lower(trim(l.company)) = q.company))
  union all
  select 'customer', c.id, c.name, null, c.status::text,
         coalesce(p.full_name, p.email),
         case when c.phone_norm = q.phone then 'phone'
              when lower(c.email) = q.email then 'email' else 'company' end
  from q, public.customers c
  left join public.profiles p on p.id = c.owner_id
  where public.fn_is_active()
    and (public.fn_in_sales() or public.fn_in_team('marketing') or public.fn_can_read_all_sales())
    and ((q.phone is not null and c.phone_norm = q.phone)
      or (q.email is not null and lower(c.email) = q.email)
      or (q.company is not null and lower(trim(c.name)) = q.company))
  limit 20;
$$;

-- Tạo lead. Trùng mà chưa xác nhận (p_force = false) → trả danh sách trùng, không tạo.
-- Sale tạo: mặc định giao cho chính mình. MKT tạo: vào hàng chờ phân công.
create or replace function public.fn_create_lead(p jsonb, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_dups jsonb;
  v_assign uuid := nullif(p ->> 'assigned_to', '')::uuid;
  v_id uuid;
  v_name text := trim(coalesce(p ->> 'name', ''));
  v_owner uuid;
  v_now timestamptz := public.fn_now();
begin
  if not (public.fn_in_sales() or public.fn_in_team('marketing') or public.fn_is_sales_admin()) then
    raise exception 'Bạn không có quyền tạo lead' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Tên lead không được để trống' using errcode = '22023';
  end if;

  if not p_force then
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_dups
    from public.fn_find_lead_duplicates(p ->> 'phone', p ->> 'email', p ->> 'company') d;
    if jsonb_array_length(v_dups) > 0 then
      return jsonb_build_object('duplicates', v_dups);
    end if;
  end if;

  -- Phân công
  if v_assign is not null and not public.fn_is_sales_admin() and v_assign <> v_user then
    v_assign := null;
  end if;
  if v_assign is null and coalesce((p ->> 'assign_to_me')::boolean, true)
     and public.fn_in_sales() and not public.fn_is_sales_admin() then
    v_assign := v_user;
  end if;
  if v_assign is not null and not exists (
    select 1 from public.user_teams ut join public.profiles pr on pr.id = ut.user_id and pr.is_active
    where ut.user_id = v_assign and ut.team_id = 'sales_domestic'
  ) then
    raise exception 'Chỉ giao lead cho người trong team Sale' using errcode = '22023';
  end if;

  insert into public.leads (
    name, company, contact_name, phone, email, zalo, address, district, source, segment,
    product_interest, est_value_vnd, notes, next_follow_up_at,
    assigned_to, created_by, first_contact_due_at, created_at
  ) values (
    v_name,
    nullif(trim(coalesce(p ->> 'company', '')), ''),
    nullif(trim(coalesce(p ->> 'contact_name', '')), ''),
    nullif(trim(coalesce(p ->> 'phone', '')), ''),
    nullif(lower(trim(coalesce(p ->> 'email', ''))), ''),
    nullif(trim(coalesce(p ->> 'zalo', '')), ''),
    nullif(trim(coalesce(p ->> 'address', '')), ''),
    nullif(trim(coalesce(p ->> 'district', '')), ''),
    nullif(p ->> 'source', ''),
    nullif(p ->> 'segment', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'product_interest')), '{}'),
    nullif(p ->> 'est_value_vnd', '')::numeric,
    nullif(trim(coalesce(p ->> 'notes', '')), ''),
    nullif(p ->> 'next_follow_up_at', '')::timestamptz,
    v_assign, v_user,
    v_now + make_interval(hours => coalesce((public.fn_setting('lead_sla_hours'))::int, 24)),
    v_now
  )
  returning id into v_id;

  if v_assign is null then
    for v_owner in select public.fn_sales_owners() loop
      perform public.fn_notify_user(v_owner, 'lead_queue', 'Lead mới chờ phân công: ' || v_name,
        coalesce(p ->> 'source', null), '/khach?tab=queue', true);
    end loop;
  elsif v_assign <> v_user then
    perform public.fn_notify_user(v_assign, 'lead_assigned', 'Bạn được giao lead: ' || v_name,
      'Liên hệ lần đầu trong ' || coalesce(public.fn_setting('lead_sla_hours') #>> '{}', '24') || ' giờ.',
      '/khach?lead=' || v_id, true);
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Phân công / chuyển giao lead (trưởng nhóm Sale)
create or replace function public.fn_assign_lead(p_lead uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  perform public.fn_require_active_user();
  if not public.fn_is_sales_admin() then
    raise exception 'Chỉ trưởng nhóm Sale phân công lead' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_teams where user_id = p_user and team_id = 'sales_domestic') then
    raise exception 'Chỉ giao lead cho người trong team Sale' using errcode = '22023';
  end if;
  update public.leads set assigned_to = p_user where id = p_lead returning * into v_lead;
  if v_lead.id is null then
    raise exception 'Không tìm thấy lead' using errcode = '22023';
  end if;
  if p_user <> auth.uid() then
    perform public.fn_notify_user(p_user, 'lead_assigned', 'Bạn được giao lead: ' || v_lead.name,
      case when v_lead.first_contacted_at is null
        then 'Hạn liên hệ lần đầu: ' || to_char(v_lead.first_contact_due_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') end,
      '/khach?lead=' || p_lead, true);
  end if;
  -- đổi người phụ trách khách hàng đã gắn (nếu có) theo lead
  if v_lead.customer_id is not null then
    perform set_config('app.system', 'on', true);
    update public.customers set owner_id = p_user where id = v_lead.customer_id and owner_id is null;
    perform set_config('app.system', '', true);
  end if;
end;
$$;

-- Chốt lead: tạo/gắn khách hàng + đơn nháp
create or replace function public.fn_mark_lead_won(
  p_lead uuid,
  p_customer_id uuid default null,
  p_customer jsonb default null,
  p_order_value numeric default null,
  p_items text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_customer uuid := p_customer_id;
  v_order uuid;
  v_sales uuid;
begin
  perform public.fn_require_active_user();
  if not public.fn_can_write_lead(p_lead) then
    raise exception 'Bạn không có quyền với lead này' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where id = p_lead;
  if v_lead.stage = 'won' then
    raise exception 'Lead đã chốt' using errcode = '22023';
  end if;
  v_sales := coalesce(v_lead.assigned_to, auth.uid());

  perform set_config('app.system', 'on', true);
  if v_customer is null then
    insert into public.customers (name, type, contact_name, phone, email, address, district, owner_id, notes)
    values (
      coalesce(nullif(trim(p_customer ->> 'name'), ''), v_lead.company, v_lead.name),
      coalesce(nullif(p_customer ->> 'type', ''), 'other')::public.customer_type,
      coalesce(nullif(p_customer ->> 'contact_name', ''), v_lead.contact_name, v_lead.name),
      coalesce(nullif(p_customer ->> 'phone', ''), v_lead.phone),
      coalesce(nullif(p_customer ->> 'email', ''), v_lead.email),
      coalesce(nullif(p_customer ->> 'address', ''), v_lead.address),
      coalesce(nullif(p_customer ->> 'district', ''), v_lead.district),
      v_sales,
      v_lead.notes
    )
    returning id into v_customer;
  elsif not (public.fn_is_sales_admin() or public.fn_owns_customer(v_customer)) then
    perform set_config('app.system', '', true);
    raise exception 'Khách hàng này không thuộc về bạn' using errcode = '42501';
  end if;

  update public.leads
  set stage = 'won', won_at = public.fn_now(), customer_id = v_customer,
      first_contacted_at = coalesce(first_contacted_at, public.fn_now())
  where id = p_lead;

  insert into public.orders (customer_id, sales_id, lead_id, total_value_vnd, items_summary, status)
  values (v_customer, v_sales, p_lead, coalesce(p_order_value, v_lead.est_value_vnd, 0), p_items, 'draft')
  returning id into v_order;
  perform set_config('app.system', '', true);

  return jsonb_build_object('customer_id', v_customer, 'order_id', v_order);
end;
$$;

-- Gộp lead trùng (chủ dữ liệu / trưởng nhóm Sale): chuyển hoạt động sang lead giữ lại, xóa lead kia
create or replace function public.fn_merge_leads(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leads;
begin
  perform public.fn_require_active_user();
  if not public.fn_is_sales_admin() then
    raise exception 'Chỉ trưởng nhóm Sale gộp dữ liệu' using errcode = '42501';
  end if;
  if p_keep = p_remove then
    raise exception 'Chọn 2 lead khác nhau' using errcode = '22023';
  end if;
  select * into r from public.leads where id = p_remove;
  if not found or not exists (select 1 from public.leads where id = p_keep) then
    raise exception 'Không tìm thấy lead' using errcode = '22023';
  end if;
  perform set_config('app.system', 'on', true);
  update public.lead_activities set lead_id = p_keep where lead_id = p_remove;
  update public.orders set lead_id = p_keep where lead_id = p_remove;
  update public.check_ins set lead_id = p_keep where lead_id = p_remove;
  update public.leads k set
    company = coalesce(k.company, r.company),
    contact_name = coalesce(k.contact_name, r.contact_name),
    phone = coalesce(k.phone, r.phone),
    email = coalesce(k.email, r.email),
    zalo = coalesce(k.zalo, r.zalo),
    address = coalesce(k.address, r.address),
    district = coalesce(k.district, r.district),
    first_contacted_at = least(k.first_contacted_at, r.first_contacted_at),
    notes = concat_ws(E'\n', k.notes, nullif('[Gộp từ ' || r.name || '] ' || coalesce(r.notes, ''), '[Gộp từ ' || r.name || '] '))
  where k.id = p_keep;
  delete from public.leads where id = p_remove;
  perform set_config('app.system', '', true);
end;
$$;

create or replace function public.fn_merge_customers(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.customers;
begin
  perform public.fn_require_active_user();
  if not public.fn_is_sales_admin() then
    raise exception 'Chỉ trưởng nhóm Sale gộp dữ liệu' using errcode = '42501';
  end if;
  if p_keep = p_remove then
    raise exception 'Chọn 2 khách khác nhau' using errcode = '22023';
  end if;
  select * into r from public.customers where id = p_remove;
  if not found or not exists (select 1 from public.customers where id = p_keep) then
    raise exception 'Không tìm thấy khách hàng' using errcode = '22023';
  end if;
  perform set_config('app.system', 'on', true);
  update public.orders set customer_id = p_keep where customer_id = p_remove;
  update public.leads set customer_id = p_keep where customer_id = p_remove;
  update public.check_ins set customer_id = p_keep where customer_id = p_remove;
  update public.customers k set
    contact_name = coalesce(k.contact_name, r.contact_name),
    phone = coalesce(k.phone, r.phone),
    email = coalesce(k.email, r.email),
    address = coalesce(k.address, r.address),
    district = coalesce(k.district, r.district),
    lat = coalesce(k.lat, r.lat),
    lng = coalesce(k.lng, r.lng)
  where k.id = p_keep;
  delete from public.customers where id = p_remove;
  perform set_config('app.system', '', true);
end;
$$;

-- Marketing: lead mình đã tạo – chỉ trạng thái; SĐT/email chỉ hiện khi chưa giao cho Sale
create or replace function public.fn_my_submitted_leads()
returns table (
  id uuid, name text, company text, stage public.lead_stage, source text, segment text,
  assigned_name text, phone text, email text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.name, l.company, l.stage, l.source, l.segment,
         coalesce(p.full_name, p.email),
         case when l.assigned_to is null then l.phone end,
         case when l.assigned_to is null then l.email end,
         l.created_at
  from public.leads l
  left join public.profiles p on p.id = l.assigned_to
  where l.created_by = auth.uid() and public.fn_is_active()
  order by l.created_at desc
  limit 200;
$$;

-- Danh bạ tên khách (để Sale tránh trùng, chọn khi check-in): tên + người phụ trách
create or replace function public.fn_customer_directory(p_q text default '')
returns table (id uuid, name text, district text, owner_id uuid, owner_name text, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.district, c.owner_id, coalesce(p.full_name, p.email),
         case when c.owner_id = auth.uid() or public.fn_can_read_all_sales() then c.lat end,
         case when c.owner_id = auth.uid() or public.fn_can_read_all_sales() then c.lng end
  from public.customers c
  left join public.profiles p on p.id = c.owner_id
  where public.fn_is_active()
    and (public.fn_in_sales() or public.fn_can_read_all_sales())
    and c.status = 'active'
    and (coalesce(p_q, '') = '' or c.name ilike '%' || p_q || '%' or c.district ilike '%' || p_q || '%')
  order by c.name
  limit 50;
$$;

-- Số liệu trong ngày cho báo cáo cuối ngày (tự điền, cho sửa)
create or replace function public.fn_report_autofill(p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.fn_require_active_user();
  v_day date := coalesce(p_date, public.fn_today_vn());
  v_from timestamptz := public.fn_vn_at(v_day, '00:00');
  v_to timestamptz := public.fn_vn_at(v_day + 1, '00:00');
begin
  return jsonb_build_object(
    'sales_domestic', jsonb_build_object(
      'visits', (select count(*) from public.check_ins
                 where user_id = v_user and checked_in_at >= v_from and checked_in_at < v_to),
      'new_leads', (select count(*) from public.leads
                    where created_by = v_user and created_at >= v_from and created_at < v_to),
      'contacted_leads', (select count(distinct lead_id) from public.lead_activities
                          where user_id = v_user and type <> 'note'
                            and happened_at >= v_from and happened_at < v_to),
      'quotes_sent', (select count(*) from public.lead_activities
                      where user_id = v_user and type = 'quote'
                        and happened_at >= v_from and happened_at < v_to),
      'orders_closed', (select count(*) from public.orders
                        where sales_id = v_user and order_date = v_day and status <> 'cancelled'),
      'revenue_vnd', (select coalesce(sum(total_value_vnd), 0) from public.orders
                      where sales_id = v_user and order_date = v_day and status <> 'cancelled')
    ),
    'marketing', jsonb_build_object(
      'leads_collected', (select count(*) from public.leads
                          where created_by = v_user and created_at >= v_from and created_at < v_to),
      'pending_approval', (select count(*) from public.tasks
                           where assignee_id = v_user and status = 'review')
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Mục tiêu tuần tự động từ đơn hàng / lead
-- -----------------------------------------------------------------------------
create or replace function public.fn_goal_actual(p_goal uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.weekly_goals;
  v_from timestamptz;
  v_to timestamptz;
begin
  select * into g from public.weekly_goals where id = p_goal;
  if not found then
    return null;
  end if;
  v_from := public.fn_vn_at(g.week_start, '00:00');
  v_to := public.fn_vn_at(g.week_start + 7, '00:00');
  return case g.actual_source
    when 'manual' then g.actual
    when 'auto_tasks' then (
      select count(*)::numeric from public.tasks t
      where t.weekly_goal_id = g.id and t.status = 'done'
    )
    when 'auto_orders' then (
      select coalesce(sum(o.total_value_vnd), 0) from public.orders o
      where o.order_date >= g.week_start and o.order_date < g.week_start + 7
        and o.status in ('confirmed', 'delivered')
        and (case when g.owner_id is not null then o.sales_id = g.owner_id
             else exists (select 1 from public.user_teams ut
                          where ut.user_id = o.sales_id and ut.team_id = g.team_id) end)
    )
    when 'auto_leads' then (
      select count(*)::numeric from public.leads l
      where l.created_at >= v_from and l.created_at < v_to
        and (case when g.owner_id is not null then l.created_by = g.owner_id
             else exists (select 1 from public.user_teams ut
                          where ut.user_id = l.created_by and ut.team_id = g.team_id) end)
    )
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Jobs: SLA lead (mỗi giờ trong khung giờ) + nhắc follow-up (sáng)
-- -----------------------------------------------------------------------------
create or replace function public.fn_job_lead_sla_check(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead record;
  v_owner uuid;
  v_count int := 0;
  v_now timestamptz := public.fn_now();
begin
  for v_lead in
    select l.*, coalesce(p.full_name, p.email) as assignee_name
    from public.leads l
    left join public.profiles p on p.id = l.assigned_to
    where l.first_contacted_at is null
      and l.first_contact_due_at < v_now
      and l.sla_notified_at is null
      and l.stage not in ('won', 'lost')
  loop
    if v_lead.assigned_to is not null then
      perform public.fn_notify_user(v_lead.assigned_to, 'lead_sla',
        'Quá hạn liên hệ lead: ' || v_lead.name,
        'Hạn liên hệ lần đầu đã qua. Gọi/Zalo ngay và ghi hoạt động.', '/khach?lead=' || v_lead.id, true);
    end if;
    for v_owner in select public.fn_sales_owners() loop
      if v_owner is distinct from v_lead.assigned_to then
        perform public.fn_notify_user(v_owner, 'lead_sla',
          'Lead quá SLA: ' || v_lead.name,
          coalesce('Phụ trách: ' || v_lead.assignee_name, 'Chưa phân công'),
          '/khach?lead=' || v_lead.id, true);
      end if;
    end loop;
    update public.leads set sla_notified_at = v_now where id = v_lead.id;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('overdue', v_count);
end;
$$;

create or replace function public.fn_job_followup_due(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select l.assigned_to, count(*) as n, string_agg(l.name, ', ' order by l.next_follow_up_at) as names
    from public.leads l
    where l.assigned_to is not null
      and l.stage not in ('won', 'lost')
      and (l.next_follow_up_at at time zone 'Asia/Ho_Chi_Minh')::date = p_date
    group by l.assigned_to
  loop
    perform public.fn_notify_user(v_row.assigned_to, 'followup_due',
      'Hôm nay cần follow-up ' || v_row.n || ' lead', left(v_row.names, 300), '/khach?view=followup', true);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('notified', v_count);
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
  where extract(isodow from p_date) = 1
  union all
  select 'followup_due', public.fn_setting_at(p_date, 'followup_time', '08:00')
  where public.fn_is_workday(p_date)
  union all
  select 'lead_sla_check:' || lpad(h::text, 2, '0'), public.fn_vn_at(p_date, lpad(h::text, 2, '0') || ':00')
  from generate_series(
    coalesce((public.fn_setting('lead_sla_check_hours') ->> 'from')::int, 8),
    coalesce((public.fn_setting('lead_sla_check_hours') ->> 'to')::int, 18)
  ) h
  where public.fn_is_workday(p_date);
$$;

create or replace function public.fn_run_job(p_job text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_job like 'lead_sla_check:%' then
    return public.fn_job_lead_sla_check(p_date);
  end if;
  return case p_job
    when 'remind_plan' then public.fn_job_remind_plan(p_date)
    when 'summary_morning' then public.fn_job_summary_morning(p_date)
    when 'remind_report' then public.fn_job_remind_report(p_date)
    when 'summary_evening' then public.fn_job_summary_evening(p_date)
    when 'close_day' then public.fn_job_close_day(p_date)
    when 'weekly_kickoff' then public.fn_job_weekly_kickoff(p_date)
    when 'followup_due' then public.fn_job_followup_due(p_date)
  end;
end;
$$;

revoke execute on function public.fn_job_lead_sla_check(date) from public, anon, authenticated;
revoke execute on function public.fn_job_followup_due(date) from public, anon, authenticated;
revoke execute on function public.fn_job_schedule(date) from public, anon, authenticated;
revoke execute on function public.fn_run_job(text, date) from public, anon, authenticated;
