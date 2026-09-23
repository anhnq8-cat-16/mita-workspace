import {
  formatDateTimeVN,
  formatDateVN,
  isoWeekday,
  isPastTimeVN,
  parseHHmm,
  todayVN,
  vnDateTime,
  weekdayVN,
} from './date-vn'

describe('giờ Việt Nam', () => {
  it('todayVN đổi ngày theo giờ VN, không theo UTC', () => {
    // 17:30 UTC ngày 22/09 = 00:30 ngày 23/09 giờ VN
    expect(todayVN(new Date('2026-09-22T17:30:00Z'))).toBe('2026-09-23')
    expect(todayVN(new Date('2026-09-22T16:59:00Z'))).toBe('2026-09-22')
  })

  it('formatDateVN dd/MM/yyyy', () => {
    expect(formatDateVN('2026-09-23')).toBe('23/09/2026')
    expect(formatDateVN(new Date('2026-09-22T17:30:00Z'))).toBe('23/09/2026')
    expect(formatDateVN(null)).toBe('')
    expect(formatDateTimeVN('2026-09-23T02:05:00Z')).toBe('23/09/2026 09:05')
  })

  it('parseHHmm', () => {
    expect(parseHHmm('09:00')).toBe(540)
    expect(parseHHmm('23:59')).toBe(1439)
    expect(() => parseHHmm('25:00')).toThrow()
    expect(() => parseHHmm('9h')).toThrow()
  })

  it('vnDateTime: 09:00 giờ VN = 02:00 UTC', () => {
    expect(vnDateTime('2026-09-23', '09:00').toISOString()).toBe('2026-09-23T02:00:00.000Z')
  })

  it('isPastTimeVN', () => {
    expect(isPastTimeVN('09:00', new Date('2026-09-23T02:00:01Z'))).toBe(true)
    expect(isPastTimeVN('09:00', new Date('2026-09-23T01:59:00Z'))).toBe(false)
  })

  it('thứ trong tuần', () => {
    expect(isoWeekday('2026-09-21')).toBe(1)
    expect(isoWeekday('2026-09-27')).toBe(7)
    expect(weekdayVN('2026-09-21T05:00:00Z')).toBe('Thứ Hai')
    expect(weekdayVN('2026-09-27T05:00:00Z')).toBe('Chủ nhật')
  })
})
