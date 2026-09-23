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
