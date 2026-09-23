import { todayVN } from './date-vn'

const DAY = 86_400_000
const toDate = (d: string) => new Date(`${d}T00:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)

/** Thứ Hai của tuần chứa ngày d (yyyy-MM-dd) */
export function weekStart(d: string = todayVN()): string {
  const date = toDate(d)
  const iso = (date.getUTCDay() + 6) % 7 // thứ Hai = 0
  return fmt(new Date(date.getTime() - iso * DAY))
}

export function addDays(d: string, n: number): string {
  return fmt(new Date(toDate(d).getTime() + n * DAY))
}
