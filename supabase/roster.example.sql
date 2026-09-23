-- =============================================================================
-- Danh sách khởi tạo (SPEC mục 2.4). Sao chép file, điền email thật (@mitaexport.com)
-- rồi chạy 1 lần trong Supabase → SQL Editor. Chạy lại an toàn (on conflict).
-- Domain mitaexport.com đã được migration khai báo sẵn trong settings.
-- Mỗi người sẽ được kích hoạt tự động khi đăng nhập Google lần đầu.
-- =============================================================================

insert into public.invitations (email, full_name, role, teams, lead_teams, title) values
  ('[EMAIL_QUY_ANH]@mitaexport.com', 'Nguyễn Quý Anh', 'admin',   '{sales_domestic,marketing}',        '{sales_domestic,marketing}',        'Chủ hệ thống'),
  ('[EMAIL_HA]@mitaexport.com',      '[Tên chị Hà]',   'manager', '{sales_domestic,marketing,export}', '{sales_domestic,marketing,export}', 'TP Kinh doanh'),
  ('[EMAIL_TRANG]@mitaexport.com',   'Trang',          'lead',    '{sales_domestic,marketing,export}', '{sales_domestic,marketing,export}', 'Chủ dữ liệu Sales'),
  ('[EMAIL_MAI]@mitaexport.com',     'Mai',            'lead',    '{sales_domestic}',                  '{sales_domestic}',                  null),
  ('[EMAIL_KIEN]@mitaexport.com',    'Kiên',           'staff',   '{marketing,sales_domestic}',        '{}',                                null),
  ('[EMAIL_LONG]@mitaexport.com',    'Long',           'staff',   '{sales_domestic}',                  '{}',                                null),
  ('[EMAIL_QUY]@mitaexport.com',     'Quý',            'staff',   '{sales_domestic}',                  '{}',                                null),
  ('[EMAIL_HUE]@mitaexport.com',     'Huệ',            'staff',   '{export}',                          '{}',                                null)
on conflict (email) do update
  set full_name = excluded.full_name, role = excluded.role, teams = excluded.teams,
      lead_teams = excluded.lead_teams, title = excluded.title;

-- Lưu ý: sale05@mitaexport.com là tài khoản hệ thống (gửi email, quản lý Drive).
-- Nếu đó cũng là tài khoản của 1 nhân viên thì thêm người đó vào danh sách trên như bình thường.
