import { describe, expect, it } from 'vitest'
import { formatScore, ratio, scoreBand } from './compliance'

describe('compliance', () => {
  it('ngưỡng màu theo SPEC: ≥90 xanh, 70–89 vàng, <70 đỏ', () => {
    expect(scoreBand(90)).toBe('good')
    expect(scoreBand(89.9)).toBe('warn')
    expect(scoreBand(70)).toBe('warn')
    expect(scoreBand(69.9)).toBe('bad')
    expect(scoreBand(null)).toBe('none')
    expect(scoreBand(80, { good: 80, warn: 60 })).toBe('good')
  })

  it('định dạng điểm và tỉ lệ', () => {
    expect(formatScore(51.7)).toBe('51,7')
    expect(formatScore(100)).toBe('100')
    expect(formatScore(null)).toBe('—')
    expect(ratio(2, 3)).toBe(66.7)
    expect(ratio(1, 0)).toBeNull()
  })
})
