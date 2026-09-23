import { vi } from '@/i18n/vi'

interface PgLikeError {
  code?: string
  message?: string
}

/** Đổi lỗi Supabase/Postgres sang câu tiếng Việt cho người dùng */
export function toUserMessage(error: unknown): string {
  if (!error) return vi.common.error
  const e = error as PgLikeError
  const message = e.message ?? String(error)
  // Lỗi do trigger của hệ thống ném ra đã là tiếng Việt
  if (/[àáảãạăâđèéêìíòóôơùúưỳý]/i.test(message)) return message
  if (e.code === '42501' || /row-level security/i.test(message)) return vi.errors.permission
  if (e.code === '23505') return 'Dữ liệu đã tồn tại'
  if (/failed to fetch|network/i.test(message)) return vi.errors.network
  return message || vi.common.error
}

export class UserFacingError extends Error {}

/** Ném lỗi đã chuyển sang tiếng Việt (dùng trong queryFn/mutationFn) */
export function throwIfError(error: unknown): void {
  if (error) throw new UserFacingError(toUserMessage(error))
}
