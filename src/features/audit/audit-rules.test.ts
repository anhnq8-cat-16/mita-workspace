import { describe, expect, it } from 'vitest'
import { changedFields, formatValue, recordLabel } from './audit-rules'

describe('nhật ký', () => {
  it('sửa: liệt kê trường đổi, bỏ trường kỹ thuật', () => {
    const c = changedFields({
      action: 'update',
      diff: {
        status: { old: 'doing', new: 'review' },
        position: { old: 1, new: 2 },
      },
    })
    expect(c).toEqual([{ field: 'status', label: 'Trạng thái', old: 'doing', new: 'review' }])
  })

  it('tạo mới: lấy các trường có giá trị', () => {
    const c = changedFields({
      action: 'insert',
      diff: { new: { id: 'x', title: 'Gọi khách', due_date: null, tags: [] } },
    })
    expect(c.map((x) => x.field)).toEqual(['title'])
    expect(c[0]!.new).toBe('Gọi khách')
  })

  it('tên bản ghi', () => {
    expect(recordLabel({ action: 'insert', row_id: '1', diff: { new: { title: 'A' } } })).toBe('A')
    expect(recordLabel({ action: 'update', row_id: 'plan_deadline', diff: { value: {} } })).toBe(
      'plan_deadline',
    )
    expect(recordLabel({ action: 'delete', row_id: '1', diff: { old: { name: 'Mộc' } } })).toBe(
      'Mộc',
    )
    const upd = {
      action: 'update' as const,
      row_id: 'uuid',
      diff: { _label: 'Gửi báo giá', status: { old: 'todo', new: 'doing' } },
    }
    expect(recordLabel(upd)).toBe('Gửi báo giá')
    expect(changedFields(upd).map((f) => f.field)).toEqual(['status'])
  })

  it('định dạng giá trị', () => {
    expect(formatValue('retail_price_vnd', 130000)).toBe('130.000đ')
    expect(formatValue('is_active', false)).toBe('Không')
    expect(formatValue('due_date', '2026-10-05')).toBe('05/10/2026')
    expect(formatValue('x', null)).toBe('—')
    expect(formatValue('assignee_id', '11111111-2222-3333-4444-555555555555', () => 'Long')).toBe(
      'Long',
    )
  })
})
