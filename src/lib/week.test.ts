import { addDays, weekStart } from './week'

it('weekStart / addDays', () => {
  expect(weekStart('2026-09-23')).toBe('2026-09-21')
  expect(weekStart('2026-09-21')).toBe('2026-09-21')
  expect(weekStart('2026-09-27')).toBe('2026-09-21') // Chủ nhật thuộc tuần bắt đầu thứ Hai trước đó
  expect(addDays('2026-09-28', -7)).toBe('2026-09-21')
  expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
})
