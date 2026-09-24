/**
 * Thay cho src/lib/supabase.ts trong bản demo (vite.demo.config.ts): client Supabase thật
 * nhưng mọi request đi vào demoFetch, phiên đăng nhập giả lưu trong bộ nhớ, không mở Realtime.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { demoFetch } from './mock-server'

const URL = 'https://demo.mita.invalid'
const KEY = 'sb-demo-auth-token'
const now = Math.floor(Date.now() / 1000)
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const user = {
  id: 'u-admin',
  email: 'quyanh@mitaexport.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-05T02:00:00Z',
}
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: now + 86400 * 30, iat: now })}.demo`,
  refresh_token: 'demo',
  token_type: 'bearer',
  expires_in: 86400 * 30,
  expires_at: now + 86400 * 30,
  user,
}

const memory = new Map<string, string>([[KEY, JSON.stringify(session)]])
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
}

/** WebSocket không kết nối (trang xem thử không có Realtime) */
class NoSocket {
  readyState = 3
  onopen: unknown = null
  onclose: unknown = null
  onerror: unknown = null
  onmessage: unknown = null
  send() {}
  close() {}
}

export const supabase = createClient<Database>(URL, 'demo-anon-key', {
  auth: {
    storage,
    storageKey: KEY,
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: demoFetch },
  realtime: { transport: NoSocket as unknown as typeof WebSocket },
})
