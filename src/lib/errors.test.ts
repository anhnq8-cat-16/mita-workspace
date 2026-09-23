import { toUserMessage } from './errors'

describe('toUserMessage', () => {
  it('giữ nguyên thông báo tiếng Việt từ trigger', () => {
    expect(
      toUserMessage({ code: '42501', message: 'Không thể khóa quản trị viên cuối cùng' }),
    ).toBe('Không thể khóa quản trị viên cuối cùng')
  })
  it('lỗi RLS → câu tiếng Việt', () => {
    expect(
      toUserMessage({ code: '42501', message: 'new row violates row-level security policy' }),
    ).toBe('Bạn không có quyền thực hiện thao tác này')
  })
  it('trùng khóa', () => {
    expect(toUserMessage({ code: '23505', message: 'duplicate key' })).toBe('Dữ liệu đã tồn tại')
  })
})
