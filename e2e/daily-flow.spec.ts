import { expect, test } from '@playwright/test'
import { mockSupabase } from './mock-supabase.ts'

test('Cổng kế hoạch → nộp kế hoạch → báo cáo cuối ngày', async ({ page }) => {
  const state = await mockSupabase(page, 'long')
  await page.goto('/')

  // Chưa nộp kế hoạch: cổng chặn mọi trang, kể cả /thu-vien
  await expect(page.getByRole('heading', { name: 'Kế hoạch hôm nay' })).toBeVisible()
  await page.goto('/thu-vien')
  await expect(page.getByRole('heading', { name: 'Kế hoạch hôm nay' })).toBeVisible()

  // Cần tối thiểu 3 việc
  const add = page.getByRole('textbox', { name: 'Gõ nhanh việc cần làm…' })
  for (const title of ['Gọi 10 khách cũ', 'Viết bài fanpage', 'Họp team 15h']) {
    await add.fill(title)
    await add.press('Enter')
  }
  await expect(page.getByText('3/3 việc tối thiểu')).toBeVisible()
  await page.getByRole('button', { name: 'Nộp kế hoạch' }).click()

  // Cổng mở ngay trang đang muốn vào (/thu-vien)
  await expect(page.getByRole('heading', { name: 'Thư viện tư liệu' })).toBeVisible()
  // Trang Hôm nay: kế hoạch + báo cáo đang mở
  await page.getByRole('link', { name: 'Mita Workspace' }).click()
  await expect(page.getByRole('button', { name: 'Nộp báo cáo' })).toBeVisible()
  expect(state.planSubmits).toHaveLength(1)
  expect((state.planSubmits[0] as { p_items: unknown[] }).p_items).toHaveLength(3)

  // Báo cáo: chọn kết quả từng việc
  const radios = page.getByRole('radio', { name: 'Hoàn thành' })
  await expect(radios).toHaveCount(3)
  for (let i = 0; i < 3; i++) await radios.nth(i).click()
  await page.getByRole('button', { name: 'Nộp báo cáo' }).click()

  await expect(page.getByRole('button', { name: 'Nộp báo cáo' })).toHaveCount(0)
  expect(state.reportSubmits).toHaveLength(1)
  const items = (state.reportSubmits[0] as { p_items: { result: string }[] }).p_items
  expect(items.map((i) => i.result)).toEqual(['done', 'done', 'done'])
})

test('Báo cáo thiếu kết quả bị chặn ở trình duyệt', async ({ page }) => {
  const state = await mockSupabase(page, 'long')
  await page.goto('/')
  const add = page.getByRole('textbox', { name: 'Gõ nhanh việc cần làm…' })
  for (const title of ['A', 'B', 'C']) {
    await add.fill(title)
    await add.press('Enter')
  }
  await page.getByRole('button', { name: 'Nộp kế hoạch' }).click()
  await page.getByRole('button', { name: 'Nộp báo cáo' }).click()
  await expect(page.getByText('Chọn kết quả cho việc "A"')).toBeVisible()
  expect(state.reportSubmits).toHaveLength(0)
})
