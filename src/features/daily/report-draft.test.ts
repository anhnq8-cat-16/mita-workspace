import {
  initialMetrics,
  normalizeMetrics,
  templatesFor,
  toReportItems,
  validateReport,
} from './report-draft'
import type { PlanItem } from './types'

const item = (id: string, title: string, removed: string | null = null) =>
  ({ id, title, removed_reason: removed }) as PlanItem

describe('bản nháp báo cáo', () => {
  const items = [item('a', 'Gọi khách'), item('b', 'Báo giá'), item('c', 'Đã bỏ', 'Khách hủy')]

  it('bắt buộc chọn kết quả và lý do khi chưa xong', () => {
    expect(validateReport(items, {})).toMatch(/Gọi khách/)
    expect(
      validateReport(items, {
        a: { result: 'done', reason: '' },
        b: { result: 'partial', reason: ' ' },
      }),
    ).toMatch(/lý do.*Báo giá/)
    expect(
      validateReport(items, {
        a: { result: 'done', reason: '' },
        b: { result: 'not_done', reason: 'Chờ giá' },
      }),
    ).toBeNull()
  })

  it('bỏ qua việc đã bỏ; không gửi lý do cho việc hoàn thành', () => {
    const payload = toReportItems(items, {
      a: { result: 'done', reason: 'x' },
      b: { result: 'partial', reason: ' Chờ giá ' },
    })
    expect(payload).toEqual([
      { plan_item_id: 'a', result: 'done', reason: null },
      { plan_item_id: 'b', result: 'partial', reason: 'Chờ giá' },
    ])
  })

  it('template theo team', () => {
    const templates = {
      sales_domestic: [{ key: 'visits', label: 'Điểm', type: 'number' as const }],
      marketing: [{ key: 'posts', label: 'Bài', type: 'links' as const }],
    }
    expect(templatesFor(['marketing'], templates).map((g) => g.team)).toEqual(['marketing'])
    expect(templatesFor(['export'], templates)).toEqual([])
  })

  it('chuẩn hóa chỉ số', () => {
    const groups = [
      {
        team: 'sales_domestic',
        fields: [
          { key: 'visits', label: '', type: 'number' as const },
          { key: 'revenue_vnd', label: '', type: 'money' as const },
          { key: 'empty', label: '', type: 'number' as const },
        ],
      },
    ]
    expect(
      normalizeMetrics(groups, {
        sales_domestic: { visits: '3', revenue_vnd: '1.250.000', empty: '' },
      }),
    ).toEqual({ sales_domestic: { visits: 3, revenue_vnd: 1250000 } })
  })
})

it('initialMetrics chỉ điền ô có auto', () => {
  const groups = [
    {
      team: 'sales_domestic',
      fields: [
        { key: 'visits', label: '', type: 'number' as const, auto: 'check_ins' },
        { key: 'manual', label: '', type: 'number' as const },
      ],
    },
  ]
  expect(initialMetrics(groups, { sales_domestic: { visits: 3, manual: 9 } })).toEqual({
    sales_domestic: { visits: '3' },
  })
  expect(initialMetrics(groups, {})).toEqual({ sales_domestic: {} })
})
