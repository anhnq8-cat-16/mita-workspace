import {
  canReadAllSales,
  canWriteLead,
  isSalesAdmin,
  monthRange,
  normPhone,
  revenue,
  slaState,
  type SalesActor,
} from './sales-rules'

const long: SalesActor = { id: 'long', role: 'staff', teams: ['sales_domestic'], ledTeams: [] }
const mkt: SalesActor = { id: 'mkt', role: 'staff', teams: ['marketing'], ledTeams: [] }
const trang: SalesActor = {
  id: 'trang',
  role: 'lead',
  teams: ['sales_domestic'],
  ledTeams: ['sales_domestic'],
}
const ha: SalesActor = { id: 'ha', role: 'manager', teams: [], ledTeams: [] }

describe('quyền Sales', () => {
  it('trưởng nhóm Sale ghi tất cả; manager chỉ đọc', () => {
    expect(isSalesAdmin(trang)).toBe(true)
    expect(isSalesAdmin(ha)).toBe(false)
    expect(canReadAllSales(ha)).toBe(true)
    expect(canWriteLead(ha, { assigned_to: 'long' })).toBe(false)
  })
  it('Sale ghi lead được giao; MKT không', () => {
    expect(canWriteLead(long, { assigned_to: 'long' })).toBe(true)
    expect(canWriteLead(long, { assigned_to: 'kien' })).toBe(false)
    expect(canWriteLead(mkt, { assigned_to: 'mkt' })).toBe(false)
  })
})

describe('tiện ích Sales', () => {
  it('slaState', () => {
    const now = new Date('2026-09-30T03:00:00Z')
    expect(
      slaState(
        { first_contacted_at: null, first_contact_due_at: '2026-09-30T02:00:00Z', stage: 'new' },
        now,
      ),
    ).toBe('overdue')
    expect(
      slaState(
        { first_contacted_at: null, first_contact_due_at: '2026-09-30T04:00:00Z', stage: 'new' },
        now,
      ),
    ).toBe('pending')
    expect(
      slaState(
        { first_contacted_at: 'x', first_contact_due_at: '2026-09-30T02:00:00Z', stage: 'new' },
        now,
      ),
    ).toBe('contacted')
    expect(
      slaState(
        { first_contacted_at: null, first_contact_due_at: '2026-09-30T02:00:00Z', stage: 'lost' },
        now,
      ),
    ).toBe('closed')
  })
  it('monthRange', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
  it('revenue chỉ tính đơn đã xác nhận/đã giao', () => {
    expect(
      revenue([
        { status: 'confirmed', total_value_vnd: 1_000_000 },
        { status: 'delivered', total_value_vnd: 500_000 },
        { status: 'draft', total_value_vnd: 9_000_000 },
        { status: 'cancelled', total_value_vnd: 9_000_000 },
      ]),
    ).toBe(1_500_000)
  })
  it('normPhone', () => {
    expect(normPhone('+84 912 345 678')).toBe('0912345678')
    expect(normPhone('0912.345.678')).toBe('0912345678')
    expect(normPhone(null)).toBe('')
  })
})

describe('applyLeadFilters', () => {
  const base = {
    stage: 'new',
    source: 'Fanpage',
    assigned_to: 'long',
    first_contacted_at: null,
    first_contact_due_at: '2026-09-29T02:00:00Z',
    next_follow_up_at: null,
  }
  const leads = [
    { ...base, id: 'a' },
    { ...base, id: 'b', assigned_to: null, source: 'Hội chợ' },
    { ...base, id: 'c', first_contacted_at: 'x', next_follow_up_at: '2026-09-30T03:00:00Z' },
  ] as unknown as import('@/lib/database.types').LeadRow[]
  const none = { stage: '', source: '', assignee: '', overdue: false, followup: false }
  const now = new Date('2026-09-30T05:00:00Z')

  it('lọc chưa phân công, nguồn, quá SLA, follow-up hôm nay', async () => {
    const { applyLeadFilters } = await import('./sales-rules')
    const ids = (f: Partial<typeof none>) =>
      applyLeadFilters(leads, { ...none, ...f }, now).map((l) => l.id)
    expect(ids({ assignee: 'none' })).toEqual(['b'])
    expect(ids({ source: 'Hội chợ' })).toEqual(['b'])
    expect(ids({ overdue: true })).toEqual(['a', 'b'])
    expect(ids({ followup: true })).toEqual(['c'])
  })
})
