import { describe, expect, it } from 'vitest'
import { focusDate, parsePeriod, periodLabel, periodOf, shiftPeriod } from './period'

const TODAY = '2026-10-14'

describe('period', () => {
  it('tuần bắt đầu thứ Hai, tháng đủ ngày', () => {
    expect(periodOf('week', '2026-10-08')).toMatchObject({ from: '2026-10-05', to: '2026-10-11' })
    expect(periodOf('month', '2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodOf('day', '2026-10-08')).toMatchObject({ from: '2026-10-08', to: '2026-10-08' })
  })

  it('URL lạ hoặc tương lai → hôm nay', () => {
    expect(parsePeriod('x', 'abc', TODAY)).toMatchObject({ mode: 'day', from: TODAY })
    expect(parsePeriod('week', '2027-01-01', TODAY)).toMatchObject({ from: '2026-10-12' })
  })

  it('lùi/tiến kỳ không quá hôm nay', () => {
    const w = periodOf('week', '2026-10-08')
    expect(shiftPeriod(w, -1, TODAY)).toMatchObject({ from: '2026-09-28', to: '2026-10-04' })
    expect(shiftPeriod(periodOf('week', TODAY), 1, TODAY).from).toBe('2026-10-12')
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1, TODAY).from).toBe('2025-12-01')
    expect(shiftPeriod(periodOf('day', TODAY), 1, TODAY).from).toBe(TODAY)
  })

  it('ngày trọng tâm và nhãn', () => {
    expect(focusDate(periodOf('week', TODAY), TODAY)).toBe(TODAY)
    expect(focusDate(periodOf('week', '2026-10-01'), TODAY)).toBe('2026-10-04')
    expect(periodLabel(periodOf('week', '2026-10-08'))).toBe('Tuần 05/10 – 11/10/2026')
    expect(periodLabel(periodOf('month', '2026-10-08'))).toBe('Tháng 10/2026')
  })
})
