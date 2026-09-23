-- M4: thư viện (quyền xem theo Shared Drive, duyệt), sản phẩm & lịch sử giá
begin;
set local search_path = public, extensions, tests;
select plan(24);

select tests.seed_roster();

-- ---------------------------------------------------------------------------
-- Sản phẩm
-- ---------------------------------------------------------------------------
select is((select count(*)::int from products where category = 'coffee'), 28, 'Seed 7 dòng cà phê × 4 quy cách');
select is((select count(*)::int from products where retail_price_vnd is not null), 0, 'Giá để trống (chưa chốt)');

select tests.authenticate_as('long@mita.test');
select cmp_ok((select count(*)::int from products), '>', 30, 'Staff đọc được sản phẩm');
select is_empty($$ update products set retail_price_vnd = 1 where sku = 'AN-100' returning id $$, 'Staff không sửa giá');

select tests.authenticate_as('manager@mita.test');
select lives_ok($$ update products set retail_price_vnd = 130000 where sku = 'AN-100' $$, 'Manager sửa giá');
select throws_ok($$ update products set name = 'x' where sku = 'AN-100' $$, '42501', null, 'Manager không sửa tên sản phẩm');
select is(
  (select new_retail from product_price_history h join products p on p.id = h.product_id where p.sku = 'AN-100'),
  130000::numeric, 'NT4: sửa giá tạo bản ghi lịch sử'
);
select is(
  (select updated_by from products where sku = 'AN-100'), tests.get_user_id('manager@mita.test'),
  'Ghi người cập nhật cuối'
);
select throws_ok($$ insert into product_price_history (product_id) values ((select id from products limit 1)) $$,
  '42501', null, 'Không ghi tay lịch sử giá');

select tests.authenticate_as('admin@mita.test');
select lives_ok($$ insert into products (sku, name, category) values ('NEW-1', 'Sản phẩm mới', 'coffee') $$, 'Admin thêm sản phẩm');

-- ---------------------------------------------------------------------------
-- Thư viện: file Drive được tạo bởi Edge Function (service role) – giả lập ở đây
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
insert into library_items (title, kind, drive_file_id, shared_drive, uploaded_by, status, approved_at)
values
  ('Ảnh Arabica Natural', 'image', 'f-lib-1', 'library', get_user_id('kien@mita.test'), 'approved', now()),
  ('Bảng giá đại lý', 'document', 'f-sp-1', 'sales_private', get_user_id('long@mita.test'), 'approved', now()),
  ('Video mới chờ duyệt', 'video', 'f-lib-2', 'library', get_user_id('kien@mita.test'), 'pending', null);

select tests.authenticate_as('mkt@mita.test');
select is((select count(*)::int from library_items where status = 'approved'), 1, 'NT3: MKT thấy thư viện chung');
select is((select count(*)::int from library_items where shared_drive = 'sales_private'), 0, 'NT3: MKT không thấy tư liệu sales_private');
select is((select count(*)::int from library_items where status = 'pending'), 0, 'Staff không thấy tư liệu chờ duyệt của người khác');
select throws_ok(
  $$ insert into library_items (title, kind, drive_file_id) values ('x', 'image', 'fake') $$, '42501', null,
  'Không tự tạo item file Drive (phải qua Edge Function)'
);
select lives_ok(
  $$ insert into library_items (title, kind, youtube_url, channels) values ('Video TikTok', 'youtube', 'https://youtu.be/abc', '{TikTok}') $$,
  'Thêm link YouTube'
);
select is((select status::text from library_items where title = 'Video TikTok'), 'pending', 'Link YouTube cũng chờ duyệt');
select throws_ok(
  $$ update library_items set status = 'approved' where title = 'Video TikTok' $$, '42501', null,
  'Không tự duyệt'
);
select lives_ok($$ update library_items set tags = '{review}' where title = 'Video TikTok' $$, 'Người tải lên sửa khi còn chờ');
select throws_ok(
  $$ insert into library_items (title, kind, youtube_url, shared_drive) values ('x', 'youtube', 'https://youtu.be/x', 'sales_private') $$,
  '42501', null, 'MKT không thêm tư liệu Sales nội bộ'
);

select tests.authenticate_as('long@mita.test');
select is((select count(*)::int from library_items where status = 'approved'), 2, 'Sale thấy cả thư viện chung + Sales nội bộ');

select tests.authenticate_as('trang@mita.test');
select ok(fn_can_approve_library('library'), 'Trưởng nhóm Marketing duyệt thư viện chung');
select is((select count(*)::int from library_items where status = 'pending'), 2, 'Người duyệt thấy tư liệu chờ duyệt');
select tests.authenticate_as('mai@mita.test');
select ok(not fn_can_approve_library('library'), 'Trưởng nhóm chỉ Sale không duyệt thư viện chung');
select tests.clear_authentication();
select ok(exists (select 1 from notifications where user_id = get_user_id('trang@mita.test') and type = 'library_pending'),
  'Người duyệt nhận thông báo tư liệu mới');

select * from finish();
rollback;
