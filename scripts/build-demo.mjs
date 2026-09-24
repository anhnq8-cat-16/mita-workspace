// Gộp bản build demo (dist-demo) thành 1 file HTML duy nhất: dist-demo/mita-demo.html.
// Chạy: npm run build:demo   (vite build --config vite.demo.config.ts && node scripts/build-demo.mjs)
// File chỉ chứa phần nội dung trang (title, style, script) – không gọi mạng ngoài Google Fonts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'dist-demo'
const assets = readdirSync(`${dir}/assets`)
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))
if (!js || !css) throw new Error('Chưa build: npx vite build --config vite.demo.config.ts')

const dataUri = (file, type) =>
  `data:${type};base64,${readFileSync(`public/${file}`).toString('base64')}`

let code = readFileSync(`${dir}/assets/${js}`, 'utf8')
  .replaceAll('`/favicon.svg`', `\`${dataUri('favicon.svg', 'image/svg+xml')}\``)
  .replaceAll('`/pwa-192.png`', `\`${dataUri('pwa-192.png', 'image/png')}\``)
  // không để chuỗi "</script" đóng thẻ script sớm
  .replaceAll('</script', '<\\/script')
  // ký tự U+FFFD thật trong thư viện Markdown → dạng escape (giữ nguyên ý nghĩa trong JS)
  .replaceAll('\uFFFD', '\\uFFFD')
const style = readFileSync(`${dir}/assets/${css}`, 'utf8').replaceAll('</style', '<\\/style')

const html = `<title>Mita Workspace Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
<style>${style}</style>
<div id="root"></div>
<script type="module">${code}</script>
`
writeFileSync(`${dir}/mita-demo.html`, html)
console.log(`${dir}/mita-demo.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
