// Tạo icon PWA (PNG) từ logo chữ "M". Chạy: node scripts/gen-icons.mjs
// Cần Chromium của Playwright (có sẵn khi cài devDependencies).
import { chromium } from '@playwright/test'

const BROWN = '#7a4520'
const svg = (size, { rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${BROWN}"/>
  <text x="32" y="${32 + 11 * scale}" font-family="Arial,Helvetica,sans-serif" font-size="${34 * scale}"
    font-weight="700" text-anchor="middle" fill="#fff">M</text>
</svg>`

const ICONS = [
  { file: 'pwa-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'pwa-512.png', size: 512, rounded: true, scale: 1 },
  // maskable: tràn nền, logo nằm trong vùng an toàn 80%
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.8 },
  // iOS tự bo góc
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 },
]

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage()
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(icon.size, icon)}</body></html>`,
  )
  await page.locator('svg').screenshot({ path: `public/${icon.file}`, omitBackground: true })
  console.log('public/' + icon.file)
}
await browser.close()
