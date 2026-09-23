-- =============================================================================
-- Danh sách khởi tạo (SPEC mục 2.4). Sao chép file, thay [DOMAIN] và email thật,
-- rồi chạy 1 lần trong Supabase → SQL Editor. Chạy lại an toàn (on conflict).
-- Mỗi người sẽ được kích hoạt tự động khi đăng nhập Google lần đầu.
-- =============================================================================

-- 1) Domain công ty được phép đăng nhập
update public.settings set value = '["[DOMAIN]"]' where key = 'allowed_email_domains';
update public.settings set value = '"https://work.[DOMAIN]"' where key = 'app_origin';

-- 2) Lời mời
insert into public.invitations (email, full_name, role, teams, lead_teams, title) values
  ('[EMAIL_QUY_ANH]@[DOMAIN]', 'Nguyễn Quý Anh', 'admin',   '{sales_domestic,marketing}',        '{sales_domestic,marketing}',        'Chủ hệ thống'),
  ('[EMAIL_HA]@[DOMAIN]',      '[Tên chị Hà]',   'manager', '{sales_domestic,marketing,export}', '{sales_domestic,marketing,export}', 'TP Kinh doanh'),
  ('[EMAIL_TRANG]@[DOMAIN]',   'Trang',          'lead',    '{sales_domestic,marketing,export}', '{sales_domestic,marketing,export}', 'Chủ dữ liệu Sales'),
  ('[EMAIL_MAI]@[DOMAIN]',     'Mai',            'lead',    '{sales_domestic}',                  '{sales_domestic}',                  null),
  ('[EMAIL_KIEN]@[DOMAIN]',    'Kiên',           'staff',   '{marketing,sales_domestic}',        '{}',                                null),
  ('[EMAIL_LONG]@[DOMAIN]',    'Long',           'staff',   '{sales_domestic}',                  '{}',                                null),
  ('[EMAIL_QUY]@[DOMAIN]',     'Quý',            'staff',   '{sales_domestic}',                  '{}',                                null),
  ('[EMAIL_HUE]@[DOMAIN]',     'Huệ',            'staff',   '{export}',                          '{}',                                null)
on conflict (email) do update
  set full_name = excluded.full_name, role = excluded.role, teams = excluded.teams,
      lead_teams = excluded.lead_teams, title = excluded.title;
