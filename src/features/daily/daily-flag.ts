import { useSettings } from '@/features/settings/api'

/**
 * Kế hoạch hôm nay + Báo cáo cuối ngày có đang bật không (settings.daily_enabled).
 * undefined khi đang tải; thiếu key hoặc lỗi đọc → coi như bật (hành vi cũ).
 */
export function useDailyEnabled(): boolean | undefined {
  const q = useSettings()
  if (q.data) return q.data.find((s) => s.key === 'daily_enabled')?.value !== false
  return q.isError ? true : undefined
}
