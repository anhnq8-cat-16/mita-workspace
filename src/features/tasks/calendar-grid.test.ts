import { monthGrid } from './calendar-grid'

it('lưới tháng bắt đầu từ thứ Hai, đủ tuần', () => {
  const cells = monthGrid(2026, 9) // 01/09/2026 là thứ Ba
  expect(cells[0]).toBe('2026-08-31')
  expect(cells).toContain('2026-09-30')
  expect(cells.length % 7).toBe(0)
  expect(cells.at(-1)).toBe('2026-10-04')
})
