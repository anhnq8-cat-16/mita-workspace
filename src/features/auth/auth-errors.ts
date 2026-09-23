import { vi } from '@/i18n/vi'

/** Chuẩn hóa thông báo lỗi từ Supabase/Google khi đăng nhập thất bại */
export function describeAuthError(raw: string | null): string {
  if (!raw) return vi.auth.callbackError
  const text = raw.replace(/\+/g, ' ')
  // Trigger DB từ chối email ngoài domain → Supabase trả "Database error saving new user"
  if (/database error saving new user/i.test(text) || /domain/i.test(text)) {
    return vi.auth.wrongDomain
  }
  return `${vi.auth.callbackError}: ${text}`
}
