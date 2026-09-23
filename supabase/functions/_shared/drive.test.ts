import { assertEquals } from 'jsr:@std/assert@1'
import { monthFolderName } from './drive.ts'

Deno.test('thư mục tháng theo giờ Việt Nam', () => {
  // 17:30 UTC 30/09 = 00:30 01/10 giờ VN
  assertEquals(monthFolderName(new Date('2026-09-30T17:30:00Z')), '2026-10')
  assertEquals(monthFolderName(new Date('2026-09-30T16:00:00Z')), '2026-09')
})
