export type Band = 'good' | 'warn' | 'bad' | 'none'

export interface Bands {
  good: number
  warn: number
}

export const DEFAULT_BANDS: Bands = { good: 90, warn: 70 }

/** Xanh ≥ good, vàng ≥ warn, đỏ còn lại; null = chưa có dữ liệu */
export function scoreBand(score: number | null | undefined, bands: Bands = DEFAULT_BANDS): Band {
  if (score === null || score === undefined) return 'none'
  if (score >= bands.good) return 'good'
  if (score >= bands.warn) return 'warn'
  return 'bad'
}

export function formatScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

/** % (0–100), mẫu số 0 → null */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((1000 * part) / whole) / 10 : null
}
