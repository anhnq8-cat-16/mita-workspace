import { beforePlanDeadline, gateBlocks, planState, reportState } from './day-status'
import type { DayDetail } from './types'

function day(partial: Partial<DayDetail> = {}): DayDetail {
  return {
    user_id: 'u',
    date: '2026-09-29',
    now: '2026-09-29T01:00:00Z',
    is_today: true,
    is_workday: true,
    plan_required: true,
    leave: null,
    plan_min_items: 3,
    deadlines: {
      plan_deadline: '2026-09-29T02:00:00Z', // 09:00 VN
      report_open: '2026-09-29T09:00:00Z', // 16:00
      report_deadline: '2026-09-29T10:30:00Z', // 17:30
      report_missed: '2026-09-29T16:59:00Z',
    },
    plan: null,
    report: null,
    ...partial,
  }
}
const plan = { id: 'p', is_late: false, items: [] } as unknown as DayDetail['plan']

describe('trạng thái ngày', () => {
  it('cổng chặn khi bắt buộc mà chưa có kế hoạch', () => {
    expect(gateBlocks(day())).toBe(true)
    expect(gateBlocks(day({ plan }))).toBe(false)
    expect(gateBlocks(day({ plan_required: false }))).toBe(false)
    expect(gateBlocks(undefined)).toBe(false)
  })

  it('planState', () => {
    expect(planState(day())).toBe('none')
    expect(planState(day({ plan }))).toBe('on_time')
    expect(planState(day({ plan: { ...plan!, is_late: true } }))).toBe('late')
    expect(planState(day({ plan_required: false }))).toBe('not_required')
  })

  it('hạn chót kế hoạch theo mốc server', () => {
    expect(beforePlanDeadline(day(), new Date('2026-09-29T01:59:00Z'))).toBe(true)
    expect(beforePlanDeadline(day(), new Date('2026-09-29T02:01:00Z'))).toBe(false)
  })

  it('reportState theo giờ mở/hạn chót', () => {
    const d = day({ plan })
    expect(reportState(d, new Date('2026-09-29T08:00:00Z'))).toBe('not_open')
    expect(reportState(d, new Date('2026-09-29T09:30:00Z'))).toBe('open')
    expect(reportState(d, new Date('2026-09-29T11:00:00Z'))).toBe('open_late')
    expect(reportState(day())).toBe('no_plan')
    const locked = day({
      plan,
      report: { submitted_at: 'x', status: 'on_time' } as DayDetail['report'],
    })
    expect(reportState(locked)).toBe('locked')
    const missed = day({
      plan,
      report: { submitted_at: null, status: 'missed' } as DayDetail['report'],
    })
    expect(reportState(missed)).toBe('missed')
  })
})
