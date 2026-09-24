import type { LinkItem } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import { addDays, weekStart } from '@/lib/week'

export interface CampaignWeek {
  index: number
  week_start: string
  label: string
  range: string
}

/** Các tuần của chiến dịch (thứ Hai → Chủ nhật), đánh số Tuần 1, 2… */
export function campaignWeeks(start: string, end: string): CampaignWeek[] {
  const out: CampaignWeek[] = []
  for (let w = weekStart(start), i = 1; w <= end && i <= 26; w = addDays(w, 7), i++) {
    out.push({
      index: i,
      week_start: w,
      label: `Tuần ${i}`,
      range: `${formatDateVN(w).slice(0, 5)} – ${formatDateVN(addDays(w, 6)).slice(0, 5)}`,
    })
  }
  return out
}

/** Ngày kết thúc khi chọn số tuần (Chủ nhật của tuần cuối) */
export function endOfWeeks(start: string, weeks: number): string {
  return addDays(weekStart(start), 7 * Math.max(1, weeks) - 1)
}

/** Hạn mặc định của mốc: thứ Bảy của tuần (làm việc thứ 2–7) */
export function defaultDue(week: string): string {
  return addDays(week, 5)
}

/** Nhập nhanh nhiều mốc: mỗi dòng 1 mốc, bỏ dòng trống và gạch đầu dòng */
export function parseMilestoneLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.round((100 * done) / total) : 0
}

/** Link hợp lệ: có http(s); nhãn trống → lấy tên miền */
export function cleanLinks(links: LinkItem[]): LinkItem[] {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => /^https?:\/\/\S+$/i.test(l.url))
    .map((l) => ({ ...l, label: l.label || new URL(l.url).hostname.replace(/^www\./, '') }))
}

export type MilestoneState = 'done' | 'late' | 'current' | 'upcoming'

/** Trạng thái hiển thị của 1 mốc so với hôm nay */
export function milestoneState(
  m: { done_at: string | null; due_date: string; week_start: string },
  today: string,
): MilestoneState {
  if (m.done_at) return 'done'
  if (m.due_date < today) return 'late'
  if (m.week_start <= today) return 'current'
  return 'upcoming'
}
