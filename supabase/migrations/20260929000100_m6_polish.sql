-- =============================================================================
-- M6: hoàn thiện – doanh số theo ngày cho biểu đồ, chỉ mục trang Nhật ký
-- =============================================================================

-- Dashboard Sales: thêm doanh số từng ngày của tháng chứa p_to (đến p_to) để vẽ lũy kế
create or replace function public.fn_dashboard_sales(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.fn_require_active_user();
  if not public.fn_can_read_all_sales() then
    raise exception 'Bạn không có quyền xem số liệu Sales' using errcode = '42501';
  end if;
  return public.fn_sales_summary(p_from, p_to) || jsonb_build_object(
    'revenue_daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', d::date, 'revenue', coalesce(o.v, 0)) order by d)
      from generate_series(date_trunc('month', p_to)::date, p_to, interval '1 day') d
      left join lateral (
        select sum(total_value_vnd) as v from public.orders
        where status in ('confirmed', 'delivered') and order_date = d::date
      ) o on true
    ), '[]'::jsonb)
  );
end;
$$;

-- Trang Nhật ký: lọc theo người thực hiện / bảng theo thời gian
create index if not exists audit_log_actor_at_idx on public.audit_log (actor_id, at desc);
create index if not exists audit_log_table_at_idx on public.audit_log (table_name, at desc);

-- Nhật ký: bản ghi "sửa" lưu thêm nhãn dễ đọc (_label = tiêu đề/tên/key) để trang Nhật ký
-- không phải hiện mã ID. Giữ nguyên định dạng cũ cho các trường thay đổi.
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
  v_label text;
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
    v_label := coalesce(v_new ->> 'title', v_new ->> 'name', v_new ->> 'full_name',
                        v_new ->> 'email', v_new ->> 'key');
    if v_label is null and v_new ? 'user_id' then
      select coalesce(p.full_name, p.email) || coalesce(' · ' || to_char(
               coalesce((v_new ->> 'plan_date')::date, (v_new ->> 'report_date')::date), 'DD/MM/YYYY'), '')
        into v_label
      from public.profiles p where p.id = (v_new ->> 'user_id')::uuid;
    end if;
    if v_label is not null then
      v_diff := v_diff || jsonb_build_object('_label', v_label);
    end if;
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
