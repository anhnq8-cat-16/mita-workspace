import { expect, test } from '@playwright/test'
import { mockSupabase } from './mock-supabase.ts'

test('Tạm ẩn Kế hoạch/Báo cáo ngày: không chặn, không có tab Hôm nay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockSupabase(page, 'long', { daily: false })
  await page.goto('/')

  // Không bị cổng kế hoạch chặn; "/" chuyển sang tab chính đầu tiên (Việc)
  await expect(page).toHaveURL(/\/viec$/)
  await expect(page.getByRole('heading', { name: 'Kế hoạch hôm nay' })).toHaveCount(0)
  const tabs = page.locator('nav.fixed')
  await expect(tabs.getByRole('link', { name: 'Hôm nay' })).toHaveCount(0)
  await expect(tabs.getByRole('link', { name: 'Việc' })).toBeVisible()

  // Trang Báo cáo chỉ còn Nghỉ phép
  await page.goto('/bao-cao')
  await expect(page.getByRole('heading', { name: 'Nghỉ phép', level: 1 })).toBeVisible()

  // /thu-vien mở thẳng
  await page.goto('/thu-vien')
  await expect(page.getByRole('heading', { name: 'Thư viện tư liệu' })).toBeVisible()
})
