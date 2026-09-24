import { expect, test } from '@playwright/test'
import { mockSupabase } from './mock-supabase.ts'

test('Chiến dịch: xem mốc theo tuần → giao việc cho mốc', async ({ page }) => {
  const state = await mockSupabase(page, 'admin')
  await page.goto('/muc-tieu?tab=campaigns')
  await page.getByText('Set quà cà phê 20/10').click()

  await expect(page.getByText('Bán 300 set trước 20/10')).toBeVisible()
  await expect(page.getByText('Tuần 1', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Chuẩn bị bao bì')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Brief' })).toHaveAttribute('href', /docs\.google/)

  await page.getByRole('button', { name: 'Giao việc' }).first().click()
  await expect(page.getByLabel('Gắn với')).toHaveValue('ms:m1')
  await page.getByRole('button', { name: 'Long' }).click()
  await page.getByLabel('Tên việc 1').fill('Chọn nhà in hộp')
  await page.getByLabel('Kết quả cần đạt 1').fill('Báo giá 3 nhà in')
  await page.getByRole('button', { name: 'Tạo 1 việc' }).click()

  await expect.poll(() => state.writes.filter((w) => w.table === 'tasks').length).toBe(1)
  const body = state.writes.find((w) => w.table === 'tasks')!.body as Record<string, unknown>[]
  expect(body[0]).toMatchObject({
    title: 'Chọn nhà in hộp',
    team_id: 'marketing',
    assignee_id: 'u-long',
    milestone_id: 'm1',
    weekly_goal_id: null,
    expected_result: 'Báo giá 3 nhà in',
  })
})

test('Kanban: chú thích màu team, chip chiến dịch trên thẻ', async ({ page }) => {
  await mockSupabase(page, 'admin')
  await page.goto('/viec')
  await expect(page.getByText('Màu theo team:')).toBeVisible()
  // lớp bọc kéo-thả cũng có role=button → lấy thẻ bên trong
  const card = page.getByRole('button', { name: /Đặt in hộp quà/ }).last()
  await expect(card).toContainText('Set quà cà phê 20/10 · Chuẩn bị bao bì')
  await expect(card).toContainText('300 hộp đúng mẫu')
})
