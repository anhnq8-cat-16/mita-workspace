-- =============================================================================
-- Cho phép email cá nhân (vd Gmail) đăng nhập NẾU admin đã mời đúng email đó.
-- Email thuộc allowed_email_domains vẫn đăng nhập được như cũ (chờ kích hoạt nếu
-- chưa mời). Email ngoài domain mà chưa có lời mời → vẫn bị từ chối.
-- =============================================================================

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

  if not (v_allowed @> to_jsonb(v_domain))
     and not exists (select 1 from public.invitations i where i.email = v_email) then
    raise exception 'Email % chưa được mời: chỉ tài khoản domain công ty hoặc email đã được admin mời mới đăng nhập được.', v_email
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
