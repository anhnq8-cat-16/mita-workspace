import { vi } from '@/i18n/vi'
import type { DashboardPersonRow } from '@/lib/database.types'

/** Chữ trạng thái kế hoạch/báo cáo (dùng cho CSV, khớp nhãn trên màn hình) */
export function planText(r: DashboardPersonRow): string {
  if (r.plan_id) return r.plan_is_late ? vi.daily.planLate : vi.daily.planOnTime
  if (r.leave_type)
    return `${vi.daily.planLeave}${r.leave_approved ? '' : ` (${vi.dashboard.people.leavePending})`}`
  if (!r.plan_required) return vi.reports.notRequired
  return vi.daily.planNone
}

export function reportText(r: DashboardPersonRow): string {
  if (r.report_status === 'missed') return vi.daily.reportMissedShort
  if (r.report_submitted_at)
    return r.report_status === 'late' ? vi.daily.reportLate : vi.daily.reportOnTime
  if (!r.plan_required) return ''
  return vi.daily.planNone
}

export const teamNames = (ids: string[]) => ids.map((id) => vi.teams[id] ?? id).join(', ')
