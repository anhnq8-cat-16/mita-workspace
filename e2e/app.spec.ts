import { expect, test } from '@playwright/test'
import { mockSupabase } from './mock-supabase.ts'

test('Dashboard quản lý mở được với admin', async ({ page }) => {
  await mockSupabase(page, 'admin')
  await page.goto('/quan-ly')
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible()
  await expect(page.getByText('Chờ tôi xử lý')).toBeVisible()
  await expect(page.getByText('Không có việc nào cần xử lý')).toBeVisible()
})

test('Nhân viên không mở được dashboard và nhật ký', async ({ page }) => {
  await mockSupabase(page, 'long')
  // Nộp kế hoạch trước để qua cổng
  await page.goto('/')
  const add = page.getByRole('textbox', { name: 'Gõ nhanh việc cần làm…' })
  for (const title of ['A', 'B', 'C']) {
    await add.fill(title)
    await add.press('Enter')
  }
  await page.getByRole('button', { name: 'Nộp kế hoạch' }).click()
  await expect(page.getByRole('button', { name: 'Nộp báo cáo' })).toBeVisible()
  for (const path of ['/quan-ly', '/nhat-ky']) {
    await page.goto(path)
    await expect(page.getByText('Bạn không có quyền truy cập trang này.')).toBeVisible()
  }
})

test('PWA: manifest và service worker', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.name).toBe('Mita Workspace')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain('512x512')
  expect((await request.get('/sw.js')).ok()).toBe(true)
  expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true)
  await mockSupabase(page, 'admin')
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  )
})
