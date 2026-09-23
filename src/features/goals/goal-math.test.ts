import { goalPercent } from './goal-math'

it('goalPercent', () => {
  expect(goalPercent(null, 10)).toBe(0)
  expect(goalPercent(5, 10)).toBe(50)
  expect(goalPercent(15, 10)).toBe(150)
  expect(goalPercent(1, 3)).toBe(33)
  expect(goalPercent(0, 0)).toBe(100)
})
