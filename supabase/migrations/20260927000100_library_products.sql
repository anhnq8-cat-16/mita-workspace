-- =============================================================================
-- M4: Thư viện tư liệu (Google Shared Drive) + Sản phẩm & bảng giá
-- =============================================================================

create type public.product_category as enum ('coffee', 'accessory', 'gift_set', 'fruit');
create type public.library_kind as enum ('image', 'video', 'document', 'design', 'youtube');
create type public.shared_drive_kind as enum ('library', 'sales_private');
create type public.library_status as enum ('pending', 'approved', 'rejected');

insert into public.settings (key, value, description) values
  ('library_approver_teams', '{"library": ["marketing"], "sales_private": ["sales_domestic"]}',
    'Trưởng nhóm của team nào được duyệt tư liệu (ngoài manager/admin), theo Shared Drive'),
  ('price_list_note', '"Giá bán lẻ đã gồm VAT. Giá có thể thay đổi, vui lòng liên hệ Sale để có báo giá mới nhất."',
    'Ghi chú cuối bảng giá in/PDF')
on conflict (key) do nothing;

update public.settings
set description = 'ID Shared Drive: {"library": "<ID MITA Library>", "sales_private": "<ID MITA Sales Private>"}. Thư mục con tự tạo. (tùy chọn "checkins": ID thư mục riêng)'
where key = 'drive.folders';

-- -----------------------------------------------------------------------------
-- Sản phẩm
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null check (length(trim(name)) > 0),
  line text,
  category public.product_category not null,
  origin text,
  flavor_notes text,
  pack_size_g int check (pack_size_g is null or pack_size_g > 0),
  retail_price_vnd numeric check (retail_price_vnd is null or retail_price_vnd >= 0),
  wholesale_price_vnd numeric check (wholesale_price_vnd is null or wholesale_price_vnd >= 0),
  is_active boolean not null default true,
  description text,
  position int not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category, line, position);

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  old_retail numeric,
  new_retail numeric,
  old_wholesale numeric,
  new_wholesale numeric,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index product_price_history_product_idx on public.product_price_history (product_id, changed_at desc);

create trigger products_updated_at before update on public.products
  for each row execute function public.fn_set_updated_at();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.fn_audit();

-- Manager chỉ sửa giá (+ bật/tắt bán); admin sửa tất cả. Ghi người sửa.
create or replace function public.fn_products_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.fn_is_admin() then
    if new.sku is distinct from old.sku or new.name is distinct from old.name
       or new.line is distinct from old.line or new.category is distinct from old.category
       or new.origin is distinct from old.origin or new.flavor_notes is distinct from old.flavor_notes
       or new.pack_size_g is distinct from old.pack_size_g or new.description is distinct from old.description
       or new.position is distinct from old.position then
      raise exception 'Quản lý chỉ sửa được giá và trạng thái bán' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger products_guard before insert or update on public.products
  for each row execute function public.fn_products_guard();

create or replace function public.fn_products_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.retail_price_vnd is distinct from old.retail_price_vnd
     or new.wholesale_price_vnd is distinct from old.wholesale_price_vnd then
    insert into public.product_price_history
      (product_id, old_retail, new_retail, old_wholesale, new_wholesale, changed_by, changed_at)
    values (new.id, old.retail_price_vnd, new.retail_price_vnd,
            old.wholesale_price_vnd, new.wholesale_price_vnd, auth.uid(), public.fn_now());
  end if;
  return null;
end;
$$;
create trigger products_price_history after update on public.products
  for each row execute function public.fn_products_price_history();

alter table public.products enable row level security;
alter table public.product_price_history enable row level security;

create policy products_select on public.products for select to authenticated
  using (public.fn_is_active());
create policy products_insert on public.products for insert to authenticated
  with check (public.fn_is_admin());
create policy products_update on public.products for update to authenticated
  using (public.fn_is_manager()) with check (public.fn_is_manager());
create policy products_delete on public.products for delete to authenticated
  using (public.fn_is_admin());

create policy product_price_history_select on public.product_price_history for select to authenticated
  using (public.fn_is_active());
revoke insert, update, delete, truncate on public.product_price_history from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Thư viện tư liệu
-- -----------------------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  kind public.library_kind not null,
  drive_file_id text unique,
  youtube_url text,
  mime_type text,
  size_bytes bigint,
  web_view_link text,
  shared_drive public.shared_drive_kind not null default 'library',
  folder_path text,
  folder_id text,
  product_id uuid references public.products (id) on delete set null,
  tags text[] not null default '{}',
  channels text[] not null default '{}',
  status public.library_status not null default 'pending',
  reject_reason text,
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'youtube') = (youtube_url is not null)),
  check (kind = 'youtube' or drive_file_id is not null),
  check (youtube_url is null or youtube_url ~* '^https://(www\.)?(youtube\.com|youtu\.be)/')
);
create index library_items_status_idx on public.library_items (status, shared_drive);
create index library_items_product_idx on public.library_items (product_id);
create index library_items_tags_idx on public.library_items using gin (tags);

create trigger library_items_updated_at before update on public.library_items
  for each row execute function public.fn_set_updated_at();
create trigger library_items_audit after insert or update or delete on public.library_items
  for each row execute function public.fn_audit();

-- task_links → thư viện
alter table public.task_links
  add constraint task_links_library_fk foreign key (library_item_id)
  references public.library_items (id) on delete cascade;

-- Người gọi duyệt được tư liệu của Shared Drive này không
create or replace function public.fn_can_approve_library(p_drive public.shared_drive_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_manager() or exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(public.fn_setting('library_approver_teams') -> p_drive::text, '[]'::jsonb)
    ) team
    where public.fn_is_lead_of_team(team)
  );
$$;

-- Người gọi xem được Shared Drive này không (khi tư liệu đã duyệt)
create or replace function public.fn_can_view_drive(p_drive public.shared_drive_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_is_active() and (
    p_drive = 'library' or public.fn_in_sales() or public.fn_is_manager()
  );
$$;

-- Tạo trực tiếp chỉ cho link YouTube (file Drive tạo qua Edge Function drive-upload-complete).
-- Trạng thái duyệt chỉ đổi qua Edge Function drive-move.
create or replace function public.fn_library_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.fn_is_system() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.drive_file_id is not null then
      raise exception 'Tải file qua chức năng Tải lên của Thư viện' using errcode = '42501';
    end if;
    if new.shared_drive = 'sales_private' and not (public.fn_in_sales() or public.fn_is_manager()) then
      raise exception 'Chỉ team Sale thêm tư liệu nội bộ Sales' using errcode = '42501';
    end if;
    new.uploaded_by := v_uid;
    new.status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
    new.reject_reason := null;
    return new;
  end if;

  if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at or new.folder_id is distinct from old.folder_id
     or new.folder_path is distinct from old.folder_path or new.drive_file_id is distinct from old.drive_file_id
     or new.shared_drive is distinct from old.shared_drive or new.uploaded_by is distinct from old.uploaded_by
     or new.kind is distinct from old.kind or new.youtube_url is distinct from old.youtube_url then
    raise exception 'Duyệt/từ chối tư liệu bằng nút Duyệt trong Thư viện' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger library_items_guard before insert or update on public.library_items
  for each row execute function public.fn_library_items_guard();

alter table public.library_items enable row level security;

create policy library_items_select on public.library_items for select to authenticated
  using (
    public.fn_is_active() and (
      (status = 'approved' and public.fn_can_view_drive(shared_drive))
      or uploaded_by = auth.uid()
      or public.fn_can_approve_library(shared_drive)
    )
  );
create policy library_items_insert on public.library_items for insert to authenticated
  with check (public.fn_is_active());
-- Người tải lên sửa thông tin khi còn chờ duyệt; người duyệt sửa bất cứ lúc nào
create policy library_items_update on public.library_items for update to authenticated
  using (
    public.fn_is_active() and (
      (uploaded_by = auth.uid() and status = 'pending') or public.fn_can_approve_library(shared_drive)
    )
  )
  with check (public.fn_is_active());
create policy library_items_delete on public.library_items for delete to authenticated
  using (public.fn_is_admin() or (uploaded_by = auth.uid() and status <> 'approved'));

-- Thông báo người duyệt khi có tư liệu chờ duyệt; người tải lên khi được duyệt/từ chối
create or replace function public.fn_library_items_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(full_name, email) into v_name from public.profiles where id = new.uploaded_by;
    for v_user in
      select p.id from public.profiles p
      where p.is_active and p.id <> coalesce(new.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          p.role in ('manager', 'admin')
          or exists (
            select 1 from public.user_teams ut
            where ut.user_id = p.id and ut.is_lead and p.role = 'lead'
              and ut.team_id in (
                select jsonb_array_elements_text(
                  coalesce(public.fn_setting('library_approver_teams') -> new.shared_drive::text, '[]'::jsonb))
              )
          )
        )
    loop
      perform public.fn_notify_user(v_user, 'library_pending', 'Tư liệu chờ duyệt: ' || new.title,
        coalesce(v_name, '') || ' vừa tải lên', '/thu-vien?tab=review', false);
    end loop;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.uploaded_by is not null then
    if new.status = 'approved' then
      perform public.fn_notify_user(new.uploaded_by, 'library_approved', 'Đã duyệt tư liệu: ' || new.title,
        new.folder_path, '/thu-vien?item=' || new.id, false);
    elsif new.status = 'rejected' then
      perform public.fn_notify_user(new.uploaded_by, 'library_rejected', 'Tư liệu bị từ chối: ' || new.title,
        new.reject_reason, '/thu-vien?tab=mine', true);
    end if;
  end if;
  return null;
end;
$$;
create trigger library_items_notify after insert or update on public.library_items
  for each row execute function public.fn_library_items_notify();

-- -----------------------------------------------------------------------------
-- Dữ liệu sản phẩm ban đầu (SPEC mục 15). Giá để trống: chưa chốt, quản lý cập nhật sau.
-- -----------------------------------------------------------------------------
insert into public.products (sku, name, line, category, origin, flavor_notes, pack_size_g, position)
select
  l.code || '-' || s.size,
  l.line || ' ' || case when s.size >= 1000 then (s.size / 1000) || 'kg' else s.size || 'g' end,
  l.line, 'coffee', l.origin, l.flavor, s.size, l.pos * 10 + s.pos
from (values
  ('AN', 'Arabica Natural', 'Cầu Đất, Lâm Đồng', 'Trái cây chín · Berry · Mật ong', 1),
  ('AH', 'Arabica Honey', 'Cầu Đất, Lâm Đồng', 'Mật ong nhẹ · Caramel · Ngọt hậu', 2),
  ('RN', 'Robusta Natural', 'M''Nông, Lâm Đồng', 'Cacao · Gỗ · Socola đậm', 3),
  ('RH', 'Robusta Honey', 'M''Nông, Lâm Đồng', 'Mật ong · Cacao · Caramel', 4),
  ('MX', 'Mix 80/20', 'Robusta & Arabica', 'Trái cây chín · Socola · Cacao', 5),
  ('CR', 'Culi Robusta', 'M''Nông, Lâm Đồng', 'Hạt dẻ · Socola · Caramel cháy', 6),
  ('PT', 'Phin Truyền Thống', 'M''Nông, Lâm Đồng', 'Socola đen · Cacao rang · Caramel', 7)
) as l(code, line, origin, flavor, pos)
cross join (values (100, 1), (250, 2), (500, 3), (1000, 4)) as s(size, pos)
on conflict (sku) do nothing;

insert into public.products (sku, name, line, category, description, position) values
  ('PK-PHIN', 'Phin cà phê DALAC', 'Phụ kiện', 'accessory', 'Phin nhôm phủ màu', 1),
  ('PK-TUITHOM', 'Túi thơm cà phê rang', 'Phụ kiện', 'accessory', 'Treo ô tô, phòng, tủ đồ', 2),
  ('QT-SIGNATURE', 'Combo Signature', 'Bộ quà tặng', 'gift_set', 'Robusta Natural + Phin + Túi thơm', 1),
  ('QT-PREMIUM', 'Combo Premium', 'Bộ quà tặng', 'gift_set', 'Arabica Natural + Phin + Túi thơm', 2),
  ('HQ-SAURIENG', 'Sầu riêng', 'Hoa quả bán lẻ', 'fruit', 'Trái tươi', 1),
  ('HQ-CHANHDAY', 'Chanh dây', 'Hoa quả bán lẻ', 'fruit', 'Trái tươi', 2),
  ('B2B-IQF', 'Hoa quả IQF / đông lạnh', 'B2B hoa quả', 'fruit', 'Bán B2B', 3),
  ('B2B-TUOI', 'Hoa quả trái tươi (B2B)', 'B2B hoa quả', 'fruit', 'Bán B2B', 4),
  ('B2B-SAY', 'Hoa quả sấy / chế biến', 'B2B hoa quả', 'fruit', 'Bán B2B', 5)
on conflict (sku) do nothing;
