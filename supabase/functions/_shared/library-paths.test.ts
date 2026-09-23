import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { kindFromMime, suggestSection, targetPath } from './library-paths.ts'

Deno.test('đường dẫn sản phẩm theo loại file', () => {
  assertEquals(
    targetPath({
      drive: 'library',
      section: 'products',
      kind: 'image',
      productLine: 'Arabica Natural',
    }),
    ['01_San-pham', 'Arabica Natural', 'Anh'],
  )
  assertEquals(
    targetPath({ drive: 'library', section: 'products', kind: 'video', productLine: 'Mix 80/20' }),
    ['01_San-pham', 'Mix 80 20', 'Video'],
  )
})

Deno.test('sự kiện cần tên, có tháng', () => {
  assertEquals(
    targetPath({
      drive: 'library',
      section: 'events',
      kind: 'image',
      eventName: 'Coffee Expo',
      eventMonth: '2026-10',
    }),
    ['04_Su-kien', '2026-10 Coffee Expo'],
  )
  assertThrows(() => targetPath({ drive: 'library', section: 'events', kind: 'image' }))
})

Deno.test('không cho thư mục khác Shared Drive', () => {
  assertThrows(() => targetPath({ drive: 'library', section: 'quotes', kind: 'document' }))
  assertEquals(targetPath({ drive: 'sales_private', section: 'quotes', kind: 'document' }), [
    'Bao-gia',
  ])
})

Deno.test('gợi ý + nhận loại file', () => {
  assertEquals(suggestSection('library', 'image', true), 'products')
  assertEquals(suggestSection('library', 'design', false), 'brand')
  assertEquals(suggestSection('sales_private', 'document', true), 'sales_docs')
  assertEquals(kindFromMime('image/jpeg'), 'image')
  assertEquals(kindFromMime('video/mp4'), 'video')
  assertEquals(kindFromMime('image/vnd.adobe.photoshop'), 'image')
  assertEquals(kindFromMime('application/illustrator'), 'design')
  assertEquals(kindFromMime('application/pdf'), 'document')
})
