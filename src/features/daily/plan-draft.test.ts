import {
  draftFromPrefill,
  removeDraftItem,
  restoreDraftItem,
  toSubmitPayload,
  validateDraft,
  type DraftItem,
} from './plan-draft'

const prefill = draftFromPrefill([
  {
    source: 'carried',
    task_id: 't1',
    title: 'Báo giá',
    kind: 'task',
    estimate_minutes: 30,
    carried_from_item_id: 'i1',
  },
  { source: 'due', task_id: 't2', title: 'Gọi khách', kind: 'task', estimate_minutes: null },
])
const extra: DraftItem = {
  key: 'x',
  source: 'new',
  title: 'Ghé quán',
  kind: 'visit',
  task_id: null,
  estimate_minutes: null,
  carried_from_item_id: null,
  removed_reason: null,
}

describe('bản nháp kế hoạch', () => {
  it('tối thiểu số việc', () => {
    expect(validateDraft(prefill, 3)).toMatch(/ít nhất 3/)
    expect(validateDraft([...prefill, extra], 3)).toBeNull()
  })

  it('việc tồn phải có lý do mới bỏ được', () => {
    const carried = prefill[0]!
    expect(() => removeDraftItem(prefill, carried.key)).toThrow(/lý do/)
    const next = removeDraftItem(prefill, carried.key, 'Khách hủy')
    expect(next).toHaveLength(2)
    expect(next[0]!.removed_reason).toBe('Khách hủy')
    // bỏ rồi thì không tính vào số việc
    expect(validateDraft([...next, extra], 3)).toMatch(/hiện có 2/)
    expect(restoreDraftItem(next, carried.key)[0]!.removed_reason).toBeNull()
  })

  it('việc thường bỏ thì xóa hẳn', () => {
    const next = removeDraftItem(prefill, prefill[1]!.key)
    expect(next).toHaveLength(1)
  })

  it('payload: việc tồn bị bỏ vẫn gửi kèm lý do', () => {
    const next = removeDraftItem([...prefill, extra], prefill[0]!.key, 'Khách hủy')
    const payload = toSubmitPayload(next)
    expect(payload).toHaveLength(3)
    expect(payload[0]).toMatchObject({ carried_from_item_id: 'i1', removed_reason: 'Khách hủy' })
    expect(payload[2]).toMatchObject({ title: 'Ghé quán', kind: 'visit', removed_reason: null })
  })

  it('không cho trùng việc', () => {
    const dup = { ...prefill[1]!, key: 'dup' }
    expect(validateDraft([...prefill, dup], 3)).toMatch(/trùng/)
  })
})
