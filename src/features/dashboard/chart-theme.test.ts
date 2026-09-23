import { describe, expect, it } from 'vitest'
import { compactVND, cumulativeRevenue } from './chart-theme'

describe('chart-theme', () => {
  it('rút gọn tiền cho trục', () => {
    expect(compactVND(96_500_000)).toBe('96,5 tr')
    expect(compactVND(1_500_000_000)).toBe('1,5 tỷ')
    expect(compactVND(250_000)).toBe('250k')
    expect(compactVND(0)).toBe('0')
  })

  it('lũy kế doanh số và tiến độ KPI theo ngày', () => {
    const pts = cumulativeRevenue(
      [
        { date: '2026-09-01', revenue: 1_000_000 },
        { date: '2026-09-02', revenue: 0 },
        { date: '2026-09-03', revenue: 2_000_000 },
      ],
      30_000_000,
    )
    expect(pts.map((p) => p.actual)).toEqual([1_000_000, 1_000_000, 3_000_000])
    expect(pts.map((p) => p.pace)).toEqual([1_000_000, 2_000_000, 3_000_000])
    expect(cumulativeRevenue([], 1)).toEqual([])
  })
})
