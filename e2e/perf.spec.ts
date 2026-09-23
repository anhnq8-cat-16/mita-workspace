import { expect, test } from '@playwright/test'
import { mockSupabase } from './mock-supabase.ts'

// Đo thời gian mở trang chính trên mạng 4G giả lập (SPEC: < 2 giây).
// Chạy riêng: PERF=1 npx playwright test perf --project=desktop
test.skip(!process.env.PERF, 'Chỉ chạy khi PERF=1')

const PROFILES = {
  // Chrome DevTools "Fast 4G" và "Slow 4G"
  'Fast 4G': {
    latency: 60,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (1.5 * 1024 * 1024) / 8,
  },
  'Slow 4G': {
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  },
}

for (const [label, net] of Object.entries(PROFILES)) {
  test(`Trang Hôm nay (lần đầu, chưa có cache) – ${label}`, async ({ page, context }) => {
    await mockSupabase(page, 'long')
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net })
    const t0 = Date.now()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Kế hoạch hôm nay' })).toBeVisible({
      timeout: 15_000,
    })
    const ms = Date.now() - t0
    const bytes = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .reduce((s, e) => s + ((e as PerformanceResourceTiming).transferSize || 0), 0),
    )
    console.log(`${label}: ${ms} ms, tải ${(bytes / 1024).toFixed(0)} KB`)
    test.info().annotations.push({ type: 'perf', description: `${label}: ${ms} ms` })
    if (label === 'Fast 4G') expect(ms).toBeLessThan(2000)
  })
}
