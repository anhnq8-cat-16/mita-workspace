import { describe, expect, it } from 'vitest'
import {
  campaignWeeks,
  cleanLinks,
  defaultDue,
  endOfWeeks,
  milestoneState,
  parseMilestoneLines,
  percent,
} from './campaign-rules'

describe('chiến dịch', () => {
  it('chia tuần từ thứ Hai, đánh số', () => {
    const w = campaignWeeks('2026-10-05', '2026-11-01')
    expect(w.map((x) => x.week_start)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ])
    expect(w[0]).toMatchObject({ label: 'Tuần 1', range: '05/10 – 11/10' })
    expect(endOfWeeks('2026-10-05', 4)).toBe('2026-11-01')
    expect(defaultDue('2026-10-05')).toBe('2026-10-10')
  })

  it('nhập nhanh nhiều mốc', () => {
    expect(
      parseMilestoneLines('- Chuẩn bị bao bì\n\n2. Đóng gói sản phẩm\n• Tính giá bán '),
    ).toEqual(['Chuẩn bị bao bì', 'Đóng gói sản phẩm', 'Tính giá bán'])
  })

  it('link và tiến độ', () => {
    expect(
      cleanLinks([
        { label: '', url: 'https://www.canva.com/design/x' },
        { label: 'Sai', url: 'canva' },
      ]),
    ).toEqual([{ label: 'canva.com', url: 'https://www.canva.com/design/x' }])
    expect(percent(2, 6)).toBe(33)
    expect(percent(0, 0)).toBe(0)
  })

  it('trạng thái mốc', () => {
    const m = { done_at: null, week_start: '2026-10-05', due_date: '2026-10-10' }
    expect(milestoneState(m, '2026-10-07')).toBe('current')
    expect(milestoneState(m, '2026-10-11')).toBe('late')
    expect(milestoneState(m, '2026-10-01')).toBe('upcoming')
    expect(milestoneState({ ...m, done_at: 'x' }, '2026-10-11')).toBe('done')
  })
})
