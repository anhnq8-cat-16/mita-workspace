import type { Page, Route } from '@playwright/test'

/**
 * Supabase giả lập cho test E2E: chặn mọi request tới SUPABASE_URL và trả dữ liệu mẫu.
 * Trạng thái (kế hoạch/báo cáo đã nộp) thay đổi theo RPC mà ứng dụng gọi, nên luồng
 * "Cổng kế hoạch → Báo cáo" chạy đầy đủ như với máy chủ thật.
 */
export const SUPABASE_URL = 'http://127.0.0.1:54321'

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const iso = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3600e3).toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())

const base = {
  phone: null,
  avatar_url: null,
  title: null,
  notification_prefs: {},
  created_at: '2026-09-20T02:00:00Z',
  updated_at: '2026-09-20T02:00:00Z',
  is_active: true,
  activated_at: '2026-09-20T02:00:00Z',
}
export const USERS = {
  admin: { ...base, id: 'u-admin', email: 'admin@mita.test', full_name: 'Quản Trị', role: 'admin' },
  long: { ...base, id: 'u-long', email: 'long@mita.test', full_name: 'Long', role: 'staff' },
} as const

const userTeams = [
  { user_id: 'u-admin', team_id: 'sales_domestic', is_lead: true },
  { user_id: 'u-long', team_id: 'marketing', is_lead: false },
]

const settings = [
  ['allowed_email_domains', ['mita.test']],
  ['plan_deadline', '09:00'],
  ['report_templates', {}],
  ['library_channels', ['Website']],
  ['compliance_weights', { plan: 30, report: 30, tasks: 30, off_plan: 10 }],
  ['compliance_bands', { good: 90, warn: 70 }],
  ['plan_required_roles', ['lead', 'staff']],
  ['kpi_monthly_revenue_vnd', 150000000],
].map(([key, value]) => ({ key, value, description: '', updated_at: '2026-09-20T02:00:00Z' }))

export interface MockState {
  planSubmits: unknown[]
  reportSubmits: unknown[]
}

export async function mockSupabase(page: Page, who: keyof typeof USERS): Promise<MockState> {
  const me = USERS[who]
  const state: MockState = { planSubmits: [], reportSubmits: [] }
  let plan: Record<string, unknown> | null = null
  let report: Record<string, unknown> | null = null

  const day = () => ({
    user_id: me.id,
    date: today,
    now: new Date().toISOString(),
    is_today: true,
    is_workday: true,
    plan_required: me.role !== 'admin',
    leave: null,
    plan_min_items: 3,
    // Kế hoạch còn hạn; báo cáo đã mở và chưa trễ
    deadlines: {
      plan_deadline: iso(1),
      report_open: iso(-1),
      report_deadline: iso(2),
      report_missed: iso(6),
    },
    plan,
    report,
  })

  const rpc: Record<string, (body: Record<string, unknown>) => unknown> = {
    fn_my_day: day,
    fn_plan_prefill: () => [],
    fn_report_autofill: () => ({}),
    fn_submit_daily_plan: (body) => {
      state.planSubmits.push(body)
      const items = (body.p_items as { title: string; kind: string }[]).map((it, i) => ({
        id: `item-${i}`,
        plan_id: 'plan-1',
        title: it.title,
        kind: it.kind ?? 'task',
        task_id: null,
        estimate_minutes: null,
        position: i,
        is_carried_over: false,
        carried_from_item_id: null,
        is_off_plan: false,
        removed_at: null,
        removed_reason: null,
        created_at: new Date().toISOString(),
        task_status: null,
        task_due_date: null,
      }))
      plan = {
        id: 'plan-1',
        user_id: me.id,
        plan_date: today,
        submitted_at: new Date().toISOString(),
        is_late: false,
        route_plan: null,
        note: null,
        reviewed_by: null,
        reviewed_at: null,
        review_comment: null,
        items,
      }
      return 'plan-1'
    },
    fn_submit_daily_report: (body) => {
      state.reportSubmits.push(body)
      report = {
        id: 'report-1',
        user_id: me.id,
        report_date: today,
        submitted_at: new Date().toISOString(),
        status: 'on_time',
        metrics: {},
        blockers: null,
        need_decision: null,
        tomorrow_note: null,
        reviewed_by: null,
        reviewed_at: null,
        review_comment: null,
        items: (body.p_items as { plan_item_id: string; result: string }[]).map((it, i) => ({
          id: `ri-${i}`,
          report_id: 'report-1',
          plan_item_id: it.plan_item_id,
          result: it.result,
          reason: null,
        })),
        amendments: [],
      }
      return 'report-1'
    },
    fn_dashboard_people: () => [],
    fn_dashboard_inbox: () => ({
      plans: [],
      reports: [],
      decisions: [],
      tasks_review: [],
      library_pending: 0,
      leaves_pending: [],
      escalations: [],
    }),
    fn_compliance_scores: () => [],
    fn_compliance_trend: () => [],
    fn_compliance_score: () => ({
      score: null,
      plan: null,
      report: null,
      tasks: null,
      off_plan: null,
    }),
    fn_dashboard_sales: () => ({
      new_leads: 0,
      contacted_in_sla: 0,
      sla_due: 0,
      overdue_now: 0,
      won: 0,
      lost: 0,
      revenue: 0,
      revenue_month: 0,
      kpi_month: 150000000,
      pipeline: [],
      lost_reasons: [],
      by_source: [],
      revenue_daily: [],
    }),
    fn_weekly_goals: () => [],
  }

  const tables: Record<string, (url: URL) => unknown[]> = {
    profiles: (url) => {
      const id = url.searchParams.get('id')
      return Object.values(USERS).filter((u) => !id || id === `eq.${u.id}`)
    },
    user_teams: (url) => {
      const id = url.searchParams.get('user_id')
      return userTeams.filter((m) => !id || id === `eq.${m.user_id}`)
    },
    teams: () => [
      { id: 'marketing', name: 'Marketing' },
      { id: 'sales_domestic', name: 'Sale nội địa' },
    ],
    settings: () => settings,
  }

  await page.route(`${SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace('/rest/v1/', '')
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path.startsWith('rpc/')) {
      const fn = rpc[path.slice(4)]
      const body = (req.postDataJSON() as Record<string, unknown> | null) ?? {}
      return json(200, fn ? fn(body) : null)
    }
    if (url.pathname.startsWith('/auth/')) return json(200, {})
    const rows = tables[path]?.(url) ?? []
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    return json(200, single ? (rows[0] ?? null) : rows)
  })

  // Phiên đăng nhập giả (supabase-js đọc từ localStorage)
  const now = Math.floor(Date.now() / 1000)
  const session = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: me.id, email: me.email, role: 'authenticated', aud: 'authenticated', exp: now + 36000, iat: now })}.sig`,
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 36000,
    expires_at: now + 36000,
    user: {
      id: me.id,
      email: me.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: base.created_at,
    },
  }
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k, v),
    ['sb-127-auth-token', JSON.stringify(session)],
  )
  return state
}
