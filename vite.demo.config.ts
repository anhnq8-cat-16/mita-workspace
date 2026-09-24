import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Bản xem thử (dữ liệu mẫu, không cần Supabase): npm run build:demo → dist-demo/.
 * Thay src/lib/supabase.ts bằng src/demo/supabase-demo.ts; gộp toàn bộ JS/CSS vào 1 file.
 */
const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/lib\/supabase$/, replacement: src('demo/supabase-demo.ts') },
      { find: '@', replacement: src('') },
    ],
  },
  base: './',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: fileURLToPath(new URL('./demo.html', import.meta.url)),
      output: { inlineDynamicImports: true },
    },
  },
})
