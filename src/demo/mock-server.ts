/**
 * "Máy chủ" giả cho bản demo: nhận request mà supabase-js gửi (PostgREST /rest/v1, RPC,
 * auth, functions) và trả dữ liệu mẫu. Không có request nào ra mạng.
 */
import { addDays } from '@/lib/week'
import * as D from './mock-data'

type Row = Record<string, unknown>
type Body = Record<string, unknown>

const tables: Record<string, () => Row[]> = {
  profiles: () => D.profiles,
  user_teams: () => D.userTeams,
  teams: () => D.teams,
  settings: () => D.settings,
  tasks: () => D.tasks,
  leads: () => D.leads,
  customers: () => D.customers,
  orders: () => D.orders,
  products: () => D.products,
  notifications: () => D.notifications,
  audit_log: () => D.auditLog,
  cron_runs: () => D.cronRuns,
  weekly_goals: () => D.weeklyGoals(D.TODAY),
  holidays: () => [{ date: '2026-09-02', name: 'Quốc khánh' }],
  extra_workdays: () => [],
  invitations: () => [],
  outbox: () => [],
  campaigns: () => D.campaigns,
  campaign_milestones: () => D.milestones,
}

/** Áp dụng bộ lọc PostgREST đơn giản: eq, neq, in, is, gt(e), lt(e) */
function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  const skip = new Set([
    'select',
    'order',
    'limit',
    'offset',
    'or',
    'and',
    'on_conflict',
    'columns',
  ])
  let out = rows
  params.forEach((value, col) => {
    if (skip.has(col)) return
    const i = value.indexOf('.')
    const op = value.slice(0, i)
    const arg = value.slice(i + 1)
    const v = (r: Row) => (r[col] === null || r[col] === undefined ? null : String(r[col]))
    out = out.filter((r) => {
      const x = v(r)
      switch (op) {
        case 'eq':
          return x === arg
        case 'neq':
          return x !== arg
        case 'in':
          return arg
            .replace(/^\(|\)$/g, '')
            .split(',')
            .includes(x ?? '')
        case 'is':
          return arg === 'null' ? x === null : String(x) === arg
        case 'gte':
          return x !== null && x >= arg
        case 'gt':
          return x !== null && x > arg
        case 'lte':
          return x !== null && x <= arg
        case 'lt':
          return x !== null && x < arg
        default:
          return true
      }
    })
  })
  const order = params.get('order')
  if (order) {
    const [col, dir] = order.split(',')[0]!.split('.')
    out = [...out].sort(
      (a, b) =>
        String(a[col!] ?? '').localeCompare(String(b[col!] ?? '')) * (dir === 'desc' ? -1 : 1),
    )
  }
  const limit = Number(params.get('limit') ?? 0)
  return limit ? out.slice(0, limit) : out
}

const rpc: Record<string, (b: Body) => unknown> = {
  fn_today_vn: () => D.TODAY,
  fn_my_day: () => ({
    ...D.dayDetail('u-admin', D.TODAY),
    plan_required: false,
    plan: null,
    report: null,
  }),
  fn_day_detail: (b) => D.dayDetail(String(b.p_user), String(b.p_date)),
  fn_plan_prefill: () => [],
  fn_report_autofill: () => ({}),
  fn_team_day: () => [],
  fn_dashboard_people: (b) => D.dashboardPeople(String(b.p_date ?? D.TODAY)),
  fn_dashboard_inbox: () => D.inbox(),
  fn_compliance_scores: (b) => D.complianceScores(String(b.p_from)),
  fn_compliance_trend: (b) => D.complianceTrend(String(b.p_end ?? D.TODAY), Number(b.p_weeks ?? 4)),
  fn_compliance_score: (b) => D.complianceFor(String(b.p_user), String(b.p_from)),
  fn_dashboard_sales: (b) => D.salesSummary(String(b.p_from), String(b.p_to)),
  fn_weekly_goals: (b) => D.weeklyGoals(String(b.p_week_start)),
  fn_can_approve_library: () => true,
  fn_customer_directory: () => D.customers,
  fn_my_submitted_leads: () => [],
  fn_campaigns: () => D.campaignRows(),
  fn_milestones: (b) =>
    D.milestoneRows(
      b.p_campaign ? String(b.p_campaign) : undefined,
      b.p_week ? String(b.p_week) : undefined,
    ),
  fn_campaign_pull_forward: () => 0,
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  })

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : null
  const url = new URL(req ? req.url : String(input))
  const method = (init?.method ?? req?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? req?.headers)
  const path = url.pathname

  if (path.startsWith('/auth/')) return json({})
  if (path.startsWith('/functions/'))
    return json({ error: 'Bản xem thử không kết nối Google Drive' }, 400)

  const rest = path.replace(/^\/rest\/v1\//, '')
  if (rest.startsWith('rpc/')) {
    const raw = init?.body ?? (req ? await req.text() : null)
    let body: Body
    try {
      body = raw ? (JSON.parse(String(raw)) as Body) : Object.fromEntries(url.searchParams)
    } catch {
      body = {}
    }
    const fn = rpc[rest.slice(4)]
    return json(fn ? fn(body) : null)
  }

  // Ghi (thêm/sửa/xóa): bản xem thử không lưu, trả về thành công
  if (method !== 'GET' && method !== 'HEAD') return json([], 201)

  const rows = applyFilters(tables[rest]?.() ?? checkins(rest, url) ?? [], url.searchParams)
  const range = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }
  if (method === 'HEAD') return new Response(null, { status: 200, headers: range })
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  return json(single ? (rows[0] ?? null) : rows, 200, range)
}

/** check_ins: tạo theo khoảng ngày được hỏi (bộ lọc gte/lt checked_in_at) */
function checkins(table: string, url: URL): Row[] | null {
  if (table !== 'check_ins') return null
  const gte = url.searchParams.getAll('checked_in_at').find((v) => v.startsWith('gte.'))
  const from = gte ? new Date(gte.slice(4)) : new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(from.getTime() + 3600e3),
  )
  return [...D.checkinsFor(date), ...(gte ? [] : D.checkinsFor(addDays(D.TODAY, -1)))]
}
