import { formatDateVN, todayVN } from '@/lib/date-vn'
import { addDays, weekStart } from '@/lib/week'

export type PeriodMode = 'day' | 'week' | 'month'

export interface Period {
  mode: PeriodMode
  /** Ngày neo (yyyy-MM-dd) */
  date: string
  from: string
  to: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function lastOfMonth(d: string): string {
  const [y, m] = d.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function periodOf(mode: PeriodMode, date: string): Period {
  if (mode === 'week') {
    const from = weekStart(date)
    return { mode, date, from, to: addDays(from, 6) }
  }
  if (mode === 'month') return { mode, date, from: `${date.slice(0, 8)}01`, to: lastOfMonth(date) }
  return { mode, date, from: date, to: date }
}

/** Đọc kỳ từ URL (?mode=week&date=2026-10-05); giá trị lạ → hôm nay theo ngày */
export function parsePeriod(mode: string | null, date: string | null, today = todayVN()): Period {
  const m: PeriodMode = mode === 'week' || mode === 'month' ? mode : 'day'
  const d = date && DATE_RE.test(date) && !Number.isNaN(Date.parse(date)) ? date : today
  return periodOf(m, d > today ? today : d)
}

/** Lùi/tiến 1 kỳ; không vượt quá hôm nay */
export function shiftPeriod(p: Period, dir: -1 | 1, today = todayVN()): Period {
  let d: string
  if (p.mode === 'day') d = addDays(p.date, dir)
  else if (p.mode === 'week') d = addDays(p.from, 7 * dir)
  else {
    const [y, m] = p.from.split('-').map(Number) as [number, number]
    d = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)
  }
  if (d > today) d = today
  return periodOf(p.mode, d)
}

/** Ngày dùng cho các khối "trong ngày" (người, check-in): cuối kỳ nhưng không quá hôm nay */
export function focusDate(p: Period, today = todayVN()): string {
  return p.to > today ? today : p.to
}

export function periodLabel(p: Period): string {
  if (p.mode === 'day') return formatDateVN(p.from)
  if (p.mode === 'week') return `Tuần ${formatDateVN(p.from).slice(0, 5)} – ${formatDateVN(p.to)}`
  return `Tháng ${p.from.slice(5, 7)}/${p.from.slice(0, 4)}`
}
