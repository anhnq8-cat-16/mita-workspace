-- Seed cho môi trường local/dev. KHÔNG chạy trên production.
-- Danh sách nhân sự thật: dùng supabase/roster.example.sql (điền email rồi chạy trên SQL Editor).
update public.settings set value = '["mita.test"]' where key = 'allowed_email_domains';
update public.settings set value = '"http://localhost:5173"' where key = 'app_origin';
