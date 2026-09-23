import { formatDuration } from './use-now'

it('formatDuration', () => {
  expect(formatDuration(12 * 60_000)).toBe('12 phút')
  expect(formatDuration(65 * 60_000)).toBe('1 giờ 5 phút')
  expect(formatDuration(120 * 60_000)).toBe('2 giờ')
  expect(formatDuration(-5)).toBe('0 phút')
})
