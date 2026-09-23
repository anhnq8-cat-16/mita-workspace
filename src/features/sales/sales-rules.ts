import type {
  CustomerType,
  LeadRow,
  LeadStage,
  OrderRow,
  OrderStatus,
  Role,
} from '@/lib/database.types'
import { todayVN } from '@/lib/date-vn'

export const STAGES: LeadStage[] = [
  'new',
  'contacted',
  'consulting',
  'sample_sent',
  'quoted',
  'won',
  'lost',
]
export const OPEN_STAGES: LeadStage[] = ['new', 'contacted', 'consulting', 'sample_sent', 'quoted']

export interface SalesActor {
  id: string
  role: Role
  teams: string[]
  ledTeams: string[]
}

/** Trưởng nhóm Sale hoặc admin: RW toàn bộ (khớp fn_is_sales_admin) */
export function isSalesAdmin(a: SalesActor): boolean {
  return a.role === 'admin' || (a.role !== 'staff' && a.ledTeams.includes('sales_domestic'))
}

export function inSales(a: SalesActor): boolean {
  return a.teams.includes('sales_domestic')
}

/** Đọc toàn bộ dữ liệu Sales (manager chỉ đọc) */
export function canReadAllSales(a: SalesActor): boolean {
  return a.role === 'manager' || isSalesAdmin(a)
}

/** Khớp fn_can_write_lead */
export function canWriteLead(a: SalesActor, lead: Pick<LeadRow, 'assigned_to'>): boolean {
  return isSalesAdmin(a) || (inSales(a) && lead.assigned_to === a.id)
}

export type SlaState = 'contacted' | 'overdue' | 'pending' | 'closed'

export function slaState(
  lead: Pick<LeadRow, 'first_contacted_at' | 'first_contact_due_at' | 'stage'>,
  now: Date = new Date(),
): SlaState {
  if (lead.first_contacted_at) return 'contacted'
  if (lead.stage === 'won' || lead.stage === 'lost') return 'closed'
  return new Date(lead.first_contact_due_at).getTime() < now.getTime() ? 'overdue' : 'pending'
}

/** Ngày đầu/cuối tháng dạng yyyy-MM-dd */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

/** Doanh số tính KPI: đơn đã xác nhận hoặc đã giao */
export function revenue(orders: Pick<OrderRow, 'status' | 'total_value_vnd'>[]): number {
  return orders
    .filter((o) => o.status === 'confirmed' || o.status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total_value_vnd), 0)
}

/** Khớp fn_norm_phone: bỏ ký tự khác số, +84 → 0 */
export function normPhone(p: string | null | undefined): string {
  const d = (p ?? '').replace(/\D/g, '')
  return /^84\d{9}$/.test(d) ? `0${d.slice(2)}` : d
}

export const CUSTOMER_TYPES: CustomerType[] = [
  'cafe',
  'agent',
  'retail_store',
  'corporate_gift',
  'individual',
  'fruit_b2b',
  'other',
]
export const ORDER_STATUSES: OrderStatus[] = ['draft', 'confirmed', 'delivered', 'cancelled']

export function orderStatusVariant(s: OrderStatus) {
  return s === 'delivered'
    ? 'success'
    : s === 'confirmed'
      ? 'default'
      : s === 'cancelled'
        ? 'destructive'
        : 'secondary'
}

export interface LeadFilters {
  stage: string
  source: string
  assignee: string
  overdue: boolean
  followup: boolean
}

export function applyLeadFilters(leads: LeadRow[], f: LeadFilters, now = new Date()): LeadRow[] {
  const today = todayVN(now)
  return leads.filter(
    (l) =>
      (!f.stage || l.stage === f.stage) &&
      (!f.source || l.source === f.source) &&
      (!f.assignee || (f.assignee === 'none' ? !l.assigned_to : l.assigned_to === f.assignee)) &&
      (!f.overdue || slaState(l, now) === 'overdue') &&
      (!f.followup ||
        (l.next_follow_up_at !== null &&
          todayVN(new Date(l.next_follow_up_at)) <= today &&
          l.stage !== 'won' &&
          l.stage !== 'lost')),
  )
}
