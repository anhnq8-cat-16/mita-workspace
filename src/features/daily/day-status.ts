import type { DayDetail } from './types'

export type PlanState = 'none' | 'on_time' | 'late' | 'leave' | 'not_required'
export type ReportState = 'locked' | 'not_open' | 'open' | 'open_late' | 'missed' | 'no_plan'

export function planState(day: DayDetail): PlanState {
  if (day.plan) return day.plan.is_late ? 'late' : 'on_time'
  if (day.leave) return 'leave'
  if (!day.plan_required) return 'not_required'
  return 'none'
}

/** Còn trong hạn chót kế hoạch không (được sửa/bỏ việc) */
export function beforePlanDeadline(day: DayDetail, now = new Date()): boolean {
  return now.getTime() <= new Date(day.deadlines.plan_deadline).getTime()
}

export function reportState(day: DayDetail, now = new Date()): ReportState {
  if (day.report?.status === 'missed') return 'missed'
  if (day.report?.submitted_at) return 'locked'
  if (!day.plan) return 'no_plan'
  const t = now.getTime()
  if (t < new Date(day.deadlines.report_open).getTime()) return 'not_open'
  if (t > new Date(day.deadlines.report_deadline).getTime()) return 'open_late'
  return 'open'
}

/** Cổng kế hoạch có chặn không */
export function gateBlocks(day: DayDetail | undefined): boolean {
  return Boolean(day && day.is_today && day.plan_required && !day.plan)
}
