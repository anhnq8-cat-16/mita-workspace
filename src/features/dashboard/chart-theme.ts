import { useSyncExternalStore } from 'react'

/**
 * Màu biểu đồ dashboard (đã kiểm tra bằng công cụ đo độ phân biệt màu, kể cả mù màu):
 * - 1 chuỗi số liệu: indigo; đường tham chiếu: slate nét đứt.
 * - Trạng thái (luôn kèm chữ): tốt / cần chú ý / thấp + xám trung tính cho "nghỉ / chưa có".
 */
export const CHART = {
  accent: '#4f46e5',
  accentSoft: '#e0e7ff',
  reference: '#94a3b8',
  grid: '#e2e8f0',
  axis: '#64748b',
  ink: '#0f172a',
  surface: '#ffffff',
} as const

export const STATUS = {
  good: '#059669',
  warn: '#e0a526',
  bad: '#e11d48',
  none: '#cbd5e1',
} as const

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia?.(QUERY)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}

/** true khi người dùng tắt hiệu ứng chuyển động trong hệ điều hành */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  )
}

/** Rút gọn tiền cho trục biểu đồ: 96.500.000 → "96,5 tr" */
export function compactVND(v: number): string {
  if (Math.abs(v) >= 1e9)
    return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  if (Math.abs(v) >= 1e6)
    return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  if (Math.abs(v) >= 1e3)
    return `${(v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}k`
  return String(v)
}

export interface CumulativePoint {
  date: string
  actual: number
  pace: number
}

/** Doanh số lũy kế theo ngày + đường tiến độ KPI đều theo ngày trong tháng */
export function cumulativeRevenue(
  daily: { date: string; revenue: number }[],
  kpi: number,
): CumulativePoint[] {
  if (daily.length === 0) return []
  const [y, m] = daily[0]!.date.split('-').map(Number) as [number, number]
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  let sum = 0
  return daily.map((d) => {
    sum += Number(d.revenue)
    const day = Number(d.date.slice(8, 10))
    return { date: d.date, actual: sum, pace: Math.round((kpi * day) / days) }
  })
}
