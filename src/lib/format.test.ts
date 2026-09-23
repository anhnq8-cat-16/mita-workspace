import { formatVND, initials, parseVND } from './format'

describe('định dạng tiền', () => {
  it('formatVND', () => {
    expect(formatVND(1250000)).toBe('1.250.000đ')
    expect(formatVND(0)).toBe('0đ')
    expect(formatVND('150000000')).toBe('150.000.000đ')
    expect(formatVND(null)).toBe('')
  })
  it('parseVND', () => {
    expect(parseVND('1.250.000đ')).toBe(1250000)
    expect(parseVND('')).toBeNull()
  })
  it('initials', () => {
    expect(initials('Nguyễn Quý Anh')).toBe('QA')
    expect(initials('Trang')).toBe('T')
    expect(initials(null)).toBe('?')
  })
})
