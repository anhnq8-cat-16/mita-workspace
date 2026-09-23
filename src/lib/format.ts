const vndFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** 1250000 → "1.250.000đ" */
export function formatVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return ''
  return `${vndFormatter.format(Math.round(n))}đ`
}

/** Số có dấu chấm ngăn cách hàng nghìn: 1250000 → "1.250.000" */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return vndFormatter.format(value)
}

/** "1.250.000đ" / "1250000" → 1250000 */
export function parseVND(value: string): number | null {
  const digits = value.replace(/[^\d-]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/** Chữ cái đầu để làm avatar: "Nguyễn Quý Anh" → "QA" */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const letters = parts.length >= 2 ? [parts[parts.length - 2], parts[parts.length - 1]] : parts
  return letters
    .map((p) => p?.[0] ?? '')
    .join('')
    .toUpperCase()
}
