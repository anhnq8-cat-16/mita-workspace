/**
 * Dữ liệu mẫu cho bản demo (không phải dữ liệu thật). Mọi ngày tính theo hôm nay (giờ VN)
 * để dashboard luôn "đang chạy": kế hoạch sáng nay, check-in chiều nay, doanh số tháng này…
 */
import { todayVN, vnDateTime } from '@/lib/date-vn'
import { addDays, weekStart } from '@/lib/week'

type Row = Record<string, unknown>

export const TODAY = todayVN()
const at = (date: string, hhmm: string) => vnDateTime(date, hhmm).toISOString()
const iso = (h: number) => new Date(Date.now() + h * 3600e3).toISOString()

/** Số giả ngẫu nhiên ổn định theo chuỗi (cùng ngày → cùng số) */
export function seeded(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const base = {
  phone: null,
  avatar_url: null,
  notification_prefs: {},
  is_active: true,
  activated_at: '2026-01-05T02:00:00Z',
  created_at: '2026-01-05T02:00:00Z',
  updated_at: '2026-01-05T02:00:00Z',
}
const P = (id: string, full_name: string, role: string, title: string, email: string) => ({
  ...base,
  id,
  full_name,
  role,
  title,
  email: `${email}@mitaexport.com`,
})

export const profiles: Row[] = [
  P('u-admin', 'Nguyễn Quý Anh', 'admin', 'Giám đốc', 'quyanh'),
  P('u-ha', 'Phạm Thu Hà', 'manager', 'Trưởng phòng Kinh doanh', 'ha'),
  P('u-trang', 'Lê Thu Trang', 'lead', 'Trưởng nhóm Marketing', 'trang'),
  P('u-mai', 'Đỗ Ngọc Mai', 'lead', 'Trưởng nhóm Sale nội địa', 'mai'),
  P('u-long', 'Trần Văn Long', 'staff', 'Sale', 'long'),
  P('u-quan', 'Vũ Minh Quân', 'staff', 'Sale', 'quan'),
  P('u-linh', 'Hoàng Mỹ Linh', 'staff', 'Sale', 'linh'),
  P('u-kien', 'Bùi Trung Kiên', 'staff', 'Marketing + Sale', 'kien'),
  P('u-thao', 'Ngô Phương Thảo', 'staff', 'Content', 'thao'),
  P('u-hue', 'Đặng Thị Huệ', 'staff', 'Xuất khẩu', 'hue'),
]
export const nameOf = (id: string) =>
  (profiles.find((p) => p.id === id)?.full_name as string | undefined) ?? ''

const M = (user_id: string, team_id: string, is_lead = false) => ({ user_id, team_id, is_lead })
export const userTeams: Row[] = [
  M('u-admin', 'sales_domestic', true),
  M('u-admin', 'marketing', true),
  M('u-ha', 'sales_domestic'),
  M('u-ha', 'export'),
  M('u-trang', 'marketing', true),
  M('u-mai', 'sales_domestic', true),
  M('u-long', 'sales_domestic'),
  M('u-quan', 'sales_domestic'),
  M('u-linh', 'sales_domestic'),
  M('u-kien', 'marketing'),
  M('u-kien', 'sales_domestic'),
  M('u-thao', 'marketing'),
  M('u-hue', 'export'),
]
export const teamsOf = (id: string) =>
  userTeams.filter((m) => m.user_id === id).map((m) => m.team_id as string)

export const teams: Row[] = [
  { id: 'export', name: 'Xuất khẩu' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales_domestic', name: 'Sale nội địa' },
]

const S = (key: string, value: unknown, description = '') => ({
  key,
  value,
  description,
  updated_at: '2026-09-01T02:00:00Z',
})
export const settings: Row[] = [
  S('allowed_email_domains', ['mitaexport.com'], 'Domain email được phép đăng nhập'),
  S('plan_deadline', '09:00', 'Hạn nộp kế hoạch ngày'),
  S('report_deadline', '17:30', 'Hạn nộp báo cáo'),
  S('workdays', [1, 2, 3, 4, 5, 6], 'Thứ làm việc (1 = thứ Hai)'),
  S('kpi_monthly_revenue_vnd', 150000000, 'KPI doanh số tháng Team Nội địa (VNĐ)'),
  S(
    'compliance_weights',
    { plan: 30, report: 30, tasks: 30, off_plan: 10 },
    'Trọng số điểm tuân thủ',
  ),
  S('compliance_bands', { good: 90, warn: 70 }, 'Ngưỡng màu điểm tuân thủ'),
  S('escalation_thresholds', { level1: 3, level2: 5 }, 'Ngưỡng leo thang'),
  S('plan_required_roles', ['lead', 'staff'], 'Vai trò phải nộp kế hoạch'),
  S('report_templates', {}, 'Mẫu báo cáo theo team'),
  S('lead_sources', ['Fanpage', 'Website DALAC', 'Hội chợ', 'Giới thiệu', 'Zalo OA'], 'Nguồn lead'),
  S('library_channels', ['Website', 'Fanpage', 'TikTok', 'Hội chợ', 'Bán hàng'], 'Kênh sử dụng'),
  S('task_require_review', true, 'Việc cần duyệt trước khi hoàn thành'),
]

// ---------------------------------------------------------------------------
// Tình trạng hôm nay của từng người (khối "Từng người")
// ---------------------------------------------------------------------------
const STAFF = ['u-trang', 'u-mai', 'u-long', 'u-quan', 'u-linh', 'u-kien', 'u-thao', 'u-hue']
const PLACES = [
  { name: 'Highlands Lĩnh Nam', lat: 20.982, lng: 105.878 },
  { name: 'Quán Cộng Minh Khai', lat: 20.996, lng: 105.861 },
  { name: 'Đại lý Minh Anh – Hai Bà Trưng', lat: 21.005, lng: 105.855 },
  { name: 'The Coffee House Times City', lat: 20.994, lng: 105.868 },
  { name: 'Cửa hàng Phố Cổ', lat: 21.034, lng: 105.852 },
  { name: 'Katinat Kim Mã', lat: 21.031, lng: 105.822 },
]

export function dayStatus(user: string, date: string) {
  const r = seeded(`${user}|${date}`)
  const isToday = date === TODAY
  const leave = user === 'u-hue' && seeded(`leave|${date}`) < 0.35
  const planned = !leave && r > 0.12
  const late = planned && r < 0.3
  const reportOpen = !isToday || new Date().getHours() >= 16
  const reported = planned && reportOpen && r > 0.25
  const sales = teamsOf(user).includes('sales_domestic') && !['u-mai'].includes(user)
  const checkins = sales && planned ? Math.floor(seeded(`ci|${user}|${date}`) * 4) : 0
  return {
    leave,
    planned,
    late,
    reported,
    reportLate: reported && r < 0.4,
    due: Math.floor(seeded(`due|${user}|${date}`) * 4),
    overdue: user === 'u-kien' ? 3 : Math.floor(seeded(`od|${user}|${date}`) * 1.6),
    checkins,
  }
}

export function checkinsFor(date: string): Row[] {
  const out: Row[] = []
  for (const user of STAFF) {
    const s = dayStatus(user, date)
    for (let i = 0; i < s.checkins; i++) {
      const place = PLACES[Math.floor(seeded(`pl|${user}|${date}|${i}`) * PLACES.length)]!
      const hour = 9 + i * 2 + Math.floor(seeded(`h|${user}|${i}`) * 2)
      // Hôm nay: xếp lùi dần từ lúc mở trang để lúc nào xem cũng có check-in gần đây
      const ts =
        date === TODAY
          ? new Date(Date.now() - (i * 2 + seeded(`h|${user}`) * 3 + 0.3) * 3600e3).toISOString()
          : at(date, `${String(hour).padStart(2, '0')}:${i % 2 ? '40' : '10'}`)
      out.push({
        id: `ci-${user}-${date}-${i}`,
        user_id: user,
        customer_id: null,
        lead_id: null,
        checked_in_at: ts,
        lat: place.lat + (seeded(`la|${user}|${i}`) - 0.5) * 0.004,
        lng: place.lng + (seeded(`ln|${user}|${i}`) - 0.5) * 0.004,
        accuracy_m: 12,
        photo_drive_file_id: null,
        photo_web_link: null,
        place_name: place.name,
        note: i === 0 ? 'Giao mẫu Robusta Honey' : null,
        checked_out_at: null,
      })
    }
  }
  return out.sort((a, b) => String(a.checked_in_at).localeCompare(String(b.checked_in_at)))
}

export function dashboardPeople(date: string): Row[] {
  const cis = checkinsFor(date)
  return STAFF.map((user) => {
    const p = profiles.find((x) => x.id === user)!
    const s = dayStatus(user, date)
    const mine = cis.filter((c) => c.user_id === user)
    const last = mine[mine.length - 1]
    return {
      user_id: user,
      full_name: p.full_name,
      email: p.email,
      avatar_url: null,
      role: p.role,
      teams: teamsOf(user),
      plan_required: !s.leave,
      leave_type: s.leave ? 'cong_tac' : null,
      leave_approved: s.leave,
      plan_id: s.planned ? `plan-${user}-${date}` : null,
      plan_submitted_at: s.planned ? at(date, s.late ? '09:24' : '08:12') : null,
      plan_is_late: s.planned ? s.late : null,
      plan_reviewed_at: s.planned && seeded(`rv|${user}|${date}`) > 0.5 ? at(date, '10:00') : null,
      report_id: s.reported ? `rep-${user}-${date}` : null,
      report_status: s.reported ? (s.reportLate ? 'late' : 'on_time') : null,
      report_submitted_at: s.reported ? at(date, s.reportLate ? '18:05' : '17:10') : null,
      report_reviewed_at: null,
      tasks_due: s.due,
      tasks_overdue: s.overdue,
      last_checkin_at: last?.checked_in_at ?? null,
      last_checkin_place: last?.place_name ?? null,
      checkins: mine.length,
    }
  })
}

// ---------------------------------------------------------------------------
// Điểm tuân thủ
// ---------------------------------------------------------------------------
const PROFILE_SCORE: Record<string, number> = {
  'u-trang': 94,
  'u-mai': 97,
  'u-long': 92,
  'u-quan': 84,
  'u-linh': 88,
  'u-kien': 58,
  'u-thao': 76,
  'u-hue': 90,
}
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))

export function complianceFor(user: string, from: string) {
  const baseScore = PROFILE_SCORE[user] ?? 85
  const j = (k: string) => (seeded(`${k}|${user}|${from}`) - 0.5) * 16
  const plan = clamp(baseScore + j('p'))
  const report = clamp(baseScore + 2 + j('r'))
  const tasks = user === 'u-thao' && seeded(from) > 0.5 ? null : clamp(baseScore - 4 + j('t'))
  const off = clamp(96 + j('o') / 2)
  const parts: [number | null, number][] = [
    [plan, 30],
    [report, 30],
    [tasks, 30],
    [off, 10],
  ]
  const w = parts.filter(([v]) => v !== null)
  const score = clamp(w.reduce((s, [v, k]) => s + v! * k, 0) / w.reduce((s, [, k]) => s + k, 0))
  return {
    score,
    plan,
    report,
    tasks,
    off_plan: off,
    plan_days: 6,
    report_days: 5,
    tasks_due: tasks === null ? 0 : 6,
    tasks_done_on_time: tasks === null ? 0 : Math.round((tasks / 100) * 6),
    plan_items: 24,
    off_plan_items: Math.round(((100 - off) / 200) * 24),
  }
}

export function complianceScores(from: string): Row[] {
  return STAFF.map((user) => {
    const p = profiles.find((x) => x.id === user)!
    const c = complianceFor(user, from)
    return {
      user_id: user,
      full_name: p.full_name,
      email: p.email,
      avatar_url: null,
      teams: teamsOf(user),
      score: c.score,
      plan: c.plan,
      report: c.report,
      tasks: c.tasks,
      off_plan: c.off_plan,
      detail: c,
    }
  }).sort((a, b) => (a.score as number) - (b.score as number))
}

export function complianceTrend(end: string, weeks = 4): Row[] {
  const last = weekStart(end)
  const out: Row[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(last, -7 * i)
    for (const user of STAFF)
      out.push({ user_id: user, week_start: ws, score: complianceFor(user, ws).score })
  }
  return out
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
function dailyRevenue(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (d === 0) return 0
  const r = seeded(`rev|${date}`)
  return r < 0.25 ? 0 : Math.round((1.5 + r * 9) * 10) * 100000
}

export function salesSummary(from: string, to: string) {
  const end = to > TODAY ? TODAY : to
  const days: string[] = []
  for (let d = from; d <= end; d = addDays(d, 1)) days.push(d)
  const n = Math.max(1, days.length)
  const monthStart = `${end.slice(0, 8)}01`
  const monthDays: string[] = []
  for (let d = monthStart; d <= end; d = addDays(d, 1)) monthDays.push(d)
  const revenue = days.reduce((s, d) => s + dailyRevenue(d), 0)
  const newLeads = Math.round(n * 2.2 + seeded(`nl|${from}`) * 3)
  const slaDue = Math.max(1, newLeads - 1)
  return {
    new_leads: newLeads,
    contacted_in_sla: Math.round(slaDue * (0.72 + seeded(`sla|${from}`) * 0.2)),
    sla_due: slaDue,
    overdue_now: 2,
    won: Math.round(n * 0.45 + 1),
    lost: Math.round(n * 0.25 + 1),
    revenue,
    revenue_month: monthDays.reduce((s, d) => s + dailyRevenue(d), 0),
    kpi_month: 150000000,
    pipeline: [
      { stage: 'new', count: 7, value: 0 },
      { stage: 'contacted', count: 6, value: 18000000 },
      { stage: 'consulting', count: 4, value: 32000000 },
      { stage: 'sample_sent', count: 3, value: 21000000 },
      { stage: 'quoted', count: 2, value: 26000000 },
    ],
    lost_reasons: [
      { reason: 'Giá cao hơn nhà cung cấp hiện tại', count: 3 + Math.round(n / 10) },
      { reason: 'Đã có nhà cung cấp', count: 2 + Math.round(n / 15) },
      { reason: 'Chưa có nhu cầu', count: 1 + Math.round(n / 20) },
      { reason: null, count: 1 },
    ],
    by_source: [],
    revenue_daily: monthDays.map((d) => ({ date: d, revenue: dailyRevenue(d) })),
  }
}

// ---------------------------------------------------------------------------
// Chờ tôi xử lý
// ---------------------------------------------------------------------------
export function inbox() {
  const y = addDays(TODAY, -1)
  return {
    plans: [
      { id: 'pl1', user_id: 'u-long', name: nameOf('u-long'), date: TODAY, is_late: false },
      { id: 'pl2', user_id: 'u-kien', name: nameOf('u-kien'), date: TODAY, is_late: true },
      { id: 'pl3', user_id: 'u-quan', name: nameOf('u-quan'), date: y, is_late: false },
    ],
    reports: [
      { id: 'rp1', user_id: 'u-linh', name: nameOf('u-linh'), date: y, status: 'on_time' },
      { id: 'rp2', user_id: 'u-kien', name: nameOf('u-kien'), date: y, status: 'late' },
    ],
    decisions: [
      {
        id: 'rp1',
        user_id: 'u-linh',
        name: nameOf('u-linh'),
        date: y,
        text: 'Đại lý Minh Anh xin chiết khấu 12% cho đơn 50kg Robusta Honey – duyệt không?',
      },
    ],
    tasks_review: [
      {
        id: 't3',
        title: 'Bộ ảnh sản phẩm Arabica Natural cho fanpage',
        assignee_id: 'u-thao',
        name: nameOf('u-thao'),
        due_date: TODAY,
      },
      {
        id: 't7',
        title: 'Báo giá quà Tết 200 hộp – Công ty ABC',
        assignee_id: 'u-long',
        name: nameOf('u-long'),
        due_date: addDays(TODAY, 2),
      },
    ],
    library_pending: 3,
    leaves_pending: [
      {
        id: 'lv1',
        user_id: 'u-quan',
        name: nameOf('u-quan'),
        date: addDays(TODAY, 3),
        type: 'nghi_phep',
      },
    ],
    escalations: [
      {
        id: 'es1',
        user_id: 'u-kien',
        name: nameOf('u-kien'),
        level: 1,
        reason: `3 lần trễ/bỏ lỡ trong tháng ${TODAY.slice(5, 7)}/${TODAY.slice(0, 4)}`,
        period_month: `${TODAY.slice(0, 8)}01`,
        task_id: 't9',
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Mục tiêu tuần, công việc, lead, khách, đơn, sản phẩm, thư viện, nhật ký
// ---------------------------------------------------------------------------
export function weeklyGoals(week: string): Row[] {
  const G = (
    id: string,
    team_id: string,
    title: string,
    target: number,
    actual: number | null,
    unit: string,
    src = 'manual',
  ) => ({
    id: `${id}-${week}`,
    week_start: week,
    team_id,
    owner_id: null,
    title,
    metric: null,
    target,
    unit,
    actual,
    actual_source: src,
    status: 'open',
    created_by: 'u-mai',
    task_total: 4,
    task_done: 2,
  })
  const k = seeded(week)
  return [
    G(
      'g1',
      'sales_domestic',
      'Doanh số tuần Team Nội địa',
      40000000,
      Math.round(40000000 * (0.55 + k * 0.5)),
      'VNĐ',
      'auto_orders',
    ),
    G('g2', 'sales_domestic', 'Chào hàng quán mới', 12, Math.round(12 * (0.5 + k * 0.6)), 'quán'),
    G(
      'g3',
      'marketing',
      'Lead mới từ fanpage & website',
      20,
      Math.round(20 * (0.6 + k * 0.5)),
      'lead',
      'auto_leads',
    ),
    G('g4', 'marketing', 'Video TikTok sản phẩm Honey', 3, 3, 'video'),
  ]
}

const T = (p: Row): Row => ({
  description: null,
  team_id: 'sales_domestic',
  assignee_id: 'u-long',
  created_by: 'u-mai',
  weekly_goal_id: null,
  milestone_id: null,
  expected_result: null,
  status: 'todo',
  priority: 'normal',
  start_date: null,
  due_date: null,
  estimate_minutes: null,
  position: 1000,
  is_sensitive: false,
  is_off_plan: false,
  carried_over_count: 0,
  completed_at: null,
  approved_by: null,
  blocked_reason: null,
  created_at: iso(-72),
  updated_at: iso(-3),
  ...p,
})
export const tasks: Row[] = [
  T({
    id: 't1',
    title: 'Gửi báo giá Highlands Lĩnh Nam',
    status: 'doing',
    due_date: addDays(TODAY, -1),
    priority: 'high',
    carried_over_count: 2,
  }),
  T({
    id: 't2',
    title: 'Chào hàng 5 quán mới khu Hoàng Mai',
    due_date: addDays(TODAY, 2),
    assignee_id: 'u-quan',
  }),
  T({
    id: 't3',
    title: 'Bộ ảnh sản phẩm Arabica Natural cho fanpage',
    status: 'review',
    team_id: 'marketing',
    assignee_id: 'u-thao',
    created_by: 'u-trang',
    due_date: TODAY,
  }),
  T({
    id: 't4',
    title: 'Chuẩn bị hội chợ Coffee Expo',
    status: 'doing',
    team_id: 'marketing',
    assignee_id: 'u-trang',
    created_by: 'u-admin',
    due_date: addDays(TODAY, 5),
    priority: 'urgent',
  }),
  T({
    id: 't5',
    title: 'Viết bài fanpage DALAC Honey',
    status: 'done',
    team_id: 'marketing',
    assignee_id: 'u-kien',
    completed_at: iso(-20),
  }),
  T({
    id: 't6',
    title: 'Gọi đại lý Minh Anh chốt giá sỉ',
    status: 'blocked',
    blocked_reason: 'Chờ duyệt chiết khấu',
    assignee_id: 'u-linh',
    due_date: TODAY,
  }),
  T({
    id: 't7',
    title: 'Báo giá quà Tết 200 hộp – Công ty ABC',
    status: 'review',
    due_date: addDays(TODAY, 2),
  }),
  T({
    id: 't8',
    title: 'Hồ sơ mẫu xuất khẩu sang Hàn Quốc',
    team_id: 'export',
    assignee_id: 'u-hue',
    created_by: 'u-ha',
    status: 'doing',
    due_date: addDays(TODAY, 4),
  }),
  T({
    id: 't9',
    title: `Gặp 1-1 với ${nameOf('u-kien')}`,
    team_id: 'marketing',
    assignee_id: 'u-trang',
    created_by: null,
    priority: 'high',
    is_sensitive: true,
    due_date: addDays(TODAY, 2),
  }),
  T({
    id: 't10',
    title: 'Cập nhật bảng giá đại lý quý 4',
    assignee_id: 'u-mai',
    status: 'todo',
    due_date: addDays(TODAY, 6),
  }),
]

const L = (p: Row): Row => ({
  company: null,
  contact_name: null,
  phone: null,
  phone_norm: null,
  email: null,
  zalo: null,
  address: null,
  district: null,
  source: 'Fanpage',
  segment: 'Quán cà phê',
  product_interest: [],
  stage: 'new',
  lost_reason: null,
  lost_at: null,
  assigned_to: 'u-long',
  created_by: 'u-long',
  first_contact_due_at: iso(6),
  first_contacted_at: null,
  sla_notified_at: null,
  next_follow_up_at: null,
  est_value_vnd: null,
  notes: null,
  customer_id: null,
  won_at: null,
  created_at: iso(-20),
  updated_at: iso(-2),
  ...p,
})
export const leads: Row[] = [
  L({
    id: 'l1',
    name: 'Quán Cà Phê Mộc',
    company: 'Mộc Coffee',
    phone: '0912 345 678',
    first_contact_due_at: iso(-4),
  }),
  L({
    id: 'l2',
    name: 'Đại lý Minh Anh',
    stage: 'quoted',
    first_contacted_at: iso(-30),
    est_value_vnd: 26000000,
    assigned_to: 'u-linh',
  }),
  L({
    id: 'l3',
    name: 'Cửa hàng Phố Cổ',
    stage: 'sample_sent',
    first_contacted_at: iso(-40),
    est_value_vnd: 8000000,
    assigned_to: 'u-quan',
  }),
  L({
    id: 'l4',
    name: 'Công ty ABC – quà Tết',
    assigned_to: null,
    source: 'Website DALAC',
    created_by: 'u-kien',
    segment: 'Quà tặng doanh nghiệp',
    est_value_vnd: 60000000,
  }),
  L({
    id: 'l5',
    name: 'Katinat Kim Mã',
    stage: 'consulting',
    first_contacted_at: iso(-50),
    est_value_vnd: 15000000,
  }),
  L({
    id: 'l6',
    name: 'Highlands Lĩnh Nam',
    stage: 'won',
    first_contacted_at: iso(-200),
    customer_id: 'c1',
    won_at: iso(-100),
  }),
]
export const customers: Row[] = [
  {
    id: 'c1',
    name: 'Highlands Lĩnh Nam',
    type: 'cafe',
    contact_name: 'Anh Tuấn',
    phone: '0988 000 111',
    email: null,
    address: '12 Lĩnh Nam',
    district: 'Hoàng Mai',
    lat: 20.982,
    lng: 105.878,
    owner_id: 'u-long',
    status: 'active',
    notes: null,
    created_at: iso(-300),
    updated_at: iso(-10),
  },
  {
    id: 'c2',
    name: 'Quán Cộng Minh Khai',
    type: 'cafe',
    contact_name: 'Chị Hạnh',
    phone: null,
    email: null,
    address: 'Minh Khai',
    district: 'Hai Bà Trưng',
    lat: 20.996,
    lng: 105.861,
    owner_id: 'u-quan',
    status: 'active',
    notes: null,
    created_at: iso(-300),
    updated_at: iso(-10),
  },
]
export const orders: Row[] = [
  {
    id: 'o1',
    customer_id: 'c1',
    sales_id: 'u-long',
    lead_id: 'l6',
    order_date: addDays(TODAY, -2),
    total_value_vnd: 12500000,
    items_summary: '5kg Robusta Honey rang xay',
    status: 'confirmed',
    note: null,
  },
  {
    id: 'o2',
    customer_id: 'c2',
    sales_id: 'u-quan',
    lead_id: null,
    order_date: addDays(TODAY, -1),
    total_value_vnd: 3200000,
    items_summary: '10 túi 250g Arabica Natural',
    status: 'delivered',
    note: null,
  },
]

const PR = (
  sku: string,
  name: string,
  line: string,
  category: string,
  size: number | null,
  retail: number | null,
  i: number,
) => ({
  id: sku,
  sku,
  name,
  line,
  category,
  origin: category === 'coffee' ? 'Cầu Đất, Lâm Đồng' : null,
  flavor_notes: category === 'coffee' ? 'Trái cây chín · Berry · Mật ong' : null,
  pack_size_g: size,
  retail_price_vnd: retail,
  wholesale_price_vnd: retail ? Math.round(retail * 0.85) : null,
  is_active: true,
  description: null,
  position: i,
  updated_by: 'u-admin',
  created_at: iso(-500),
  updated_at: iso(-48),
})
export const products: Row[] = [
  PR('AN-250', 'Arabica Natural 250g', 'Arabica Natural', 'coffee', 250, 195000, 1),
  PR('AN-500', 'Arabica Natural 500g', 'Arabica Natural', 'coffee', 500, 360000, 2),
  PR('RH-250', 'Robusta Honey 250g', 'Robusta Honey', 'coffee', 250, 150000, 3),
  PR('RH-1000', 'Robusta Honey 1kg', 'Robusta Honey', 'coffee', 1000, 320000, 4),
  PR('PK-PHIN', 'Phin cà phê DALAC', 'Phụ kiện', 'accessory', null, 85000, 5),
  PR('QT-SIGNATURE', 'Combo Signature', 'Bộ quà tặng', 'gift_set', null, null, 6),
]

export const notifications: Row[] = [
  {
    id: 'n1',
    user_id: 'u-admin',
    type: 'weekly_report',
    title: 'Báo cáo tuần đã sẵn sàng',
    body: 'Doanh số, lead, điểm tuân thủ từng người.',
    link: '/quan-ly?mode=week',
    read_at: null,
    created_at: iso(-5),
  },
  {
    id: 'n2',
    user_id: 'u-admin',
    type: 'escalation',
    title: `Leo thang cấp 1: ${nameOf('u-kien')}`,
    body: '3 lần trễ/bỏ lỡ trong tháng',
    link: '/quan-ly',
    read_at: null,
    created_at: iso(-20),
  },
]

export const auditLog: Row[] = [
  {
    id: 'a1',
    table_name: 'tasks',
    row_id: 't3',
    action: 'update',
    actor_id: 'u-thao',
    at: iso(-0.5),
    diff: {
      _label: 'Bộ ảnh sản phẩm Arabica Natural cho fanpage',
      status: { old: 'doing', new: 'review' },
    },
  },
  {
    id: 'a2',
    table_name: 'products',
    row_id: 'AN-250',
    action: 'update',
    actor_id: 'u-admin',
    at: iso(-3),
    diff: { _label: 'Arabica Natural 250g', retail_price_vnd: { old: 180000, new: 195000 } },
  },
  {
    id: 'a3',
    table_name: 'leads',
    row_id: 'l2',
    action: 'update',
    actor_id: 'u-linh',
    at: iso(-6),
    diff: { _label: 'Đại lý Minh Anh', stage: { old: 'sample_sent', new: 'quoted' } },
  },
  {
    id: 'a4',
    table_name: 'settings',
    row_id: 'plan_deadline',
    action: 'update',
    actor_id: 'u-admin',
    at: iso(-30),
    diff: { _label: 'plan_deadline', value: { old: '08:45', new: '09:00' } },
  },
  {
    id: 'a5',
    table_name: 'daily_reports',
    row_id: 'r0',
    action: 'insert',
    actor_id: null,
    at: iso(-34),
    diff: { new: { user_id: 'u-kien', status: 'missed' } },
  },
]
export const cronRuns: Row[] = [
  {
    job: 'close_day',
    run_date: addDays(TODAY, -1),
    ran_at: at(addDays(TODAY, -1), '23:59'),
    result: { missed: 1, escalations: 1 },
    error: null,
  },
  {
    job: 'summary_evening',
    run_date: addDays(TODAY, -1),
    ran_at: at(addDays(TODAY, -1), '18:00'),
    result: { sent: 4 },
    error: null,
  },
  {
    job: 'summary_morning',
    run_date: TODAY,
    ran_at: at(TODAY, '09:15'),
    result: { sent: 4 },
    error: null,
  },
]

/** Kế hoạch + báo cáo của 1 người 1 ngày (trang chi tiết khi bấm vào tên) */
export function dayDetail(user: string, date: string) {
  const s = dayStatus(user, date)
  const items = [
    'Gửi báo giá Highlands Lĩnh Nam',
    'Ghé 3 quán khu Hoàng Mai',
    'Gọi lại 10 khách cũ',
    'Cập nhật CRM',
  ].map((title, i) => ({
    id: `it-${user}-${i}`,
    plan_id: `plan-${user}-${date}`,
    title,
    kind: i === 1 ? 'visit' : 'task',
    task_id: null,
    estimate_minutes: 60,
    position: i,
    is_carried_over: i === 0,
    carried_from_item_id: null,
    is_off_plan: i === 3,
    removed_at: null,
    removed_reason: null,
    created_at: at(date, '08:10'),
    task_status: null,
    task_due_date: null,
  }))
  return {
    user_id: user,
    date,
    now: new Date().toISOString(),
    is_today: date === TODAY,
    is_workday: true,
    plan_required: !s.leave,
    leave: null,
    plan_min_items: 3,
    deadlines: {
      plan_deadline: at(date, '09:00'),
      report_open: at(date, '16:00'),
      report_deadline: at(date, '17:30'),
      report_missed: at(date, '23:59'),
    },
    plan: s.planned
      ? {
          id: `plan-${user}-${date}`,
          user_id: user,
          plan_date: date,
          submitted_at: at(date, s.late ? '09:24' : '08:12'),
          is_late: s.late,
          route_plan: 'Hoàng Mai: 3 quán · Hai Bà Trưng: 1 đại lý',
          note: null,
          reviewed_by: null,
          reviewed_at: null,
          review_comment: null,
          items,
        }
      : null,
    report: s.reported
      ? {
          id: `rep-${user}-${date}`,
          user_id: user,
          report_date: date,
          submitted_at: at(date, '17:10'),
          status: s.reportLate ? 'late' : 'on_time',
          metrics: {},
          blockers: null,
          need_decision: null,
          tomorrow_note: 'Chốt đơn Minh Anh',
          reviewed_by: null,
          reviewed_at: null,
          review_comment: null,
          items: items.map((it, i) => ({
            id: `ri-${i}`,
            report_id: `rep-${user}-${date}`,
            plan_item_id: it.id,
            result: i === 2 ? 'partial' : 'done',
            reason: i === 2 ? 'Mới gọi được 6/10 khách' : null,
          })),
          amendments: [],
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Chiến dịch (KPI theo đầu mục)
// ---------------------------------------------------------------------------
const CW = weekStart(TODAY)
export const campaigns: Row[] = [
  {
    id: 'cp1',
    team_id: 'marketing',
    title: 'Set quà cà phê 20/10',
    goal: 'Ra mắt set quà 20/10, bán 300 set trước ngày 20/10',
    description:
      'Tuần 1: bao bì + duyệt mẫu. Tuần 2: đóng gói, tính giá. Tuần 3: bảng giá + chụp ảnh. Tuần 4: tung ra thị trường (fanpage, đại lý, quán quen).',
    start_date: addDays(CW, -7),
    end_date: addDays(CW, 20),
    status: 'active',
    owner_id: 'u-trang',
    links: [
      { label: 'Brief chiến dịch', url: 'https://docs.google.com/document/d/demo' },
      { label: 'Thiết kế hộp (Canva)', url: 'https://www.canva.com/design/demo' },
    ],
    created_by: 'u-trang',
  },
  {
    id: 'cp2',
    team_id: 'marketing',
    title: 'Video TikTok dòng Honey',
    goal: '4 video ngắn, 50.000 lượt xem',
    description: 'Mỗi tuần 1 video: quy trình rang, pha phin, pha lạnh, review khách.',
    start_date: CW,
    end_date: addDays(CW, 27),
    status: 'planning',
    owner_id: 'u-thao',
    links: [],
    created_by: 'u-trang',
  },
]
const MS = (
  id: string,
  cp: string,
  week: number,
  title: string,
  done: boolean,
  owner: string,
  dueOffset = 5,
) => ({
  id,
  campaign_id: cp,
  title,
  description: null,
  week_start: addDays(CW, 7 * week),
  due_date: addDays(CW, 7 * week + dueOffset),
  owner_id: owner,
  links: [],
  position: 0,
  done_at: done ? iso(-30) : null,
  done_by: null,
})
export const milestones: Row[] = [
  MS('m1', 'cp1', -1, 'Chuẩn bị bao bì', true, 'u-thao'),
  MS('m2', 'cp1', -1, 'Duyệt mẫu hộp quà', true, 'u-trang'),
  MS('m3', 'cp1', 0, 'Đóng gói sản phẩm', false, 'u-kien'),
  MS('m4', 'cp1', 0, 'Tính giá bán', true, 'u-trang', 2),
  MS('m5', 'cp1', 1, 'Lên bảng giá set quà', false, 'u-trang'),
  MS('m6', 'cp1', 1, 'Chụp ảnh sản phẩm', false, 'u-thao'),
  MS('m7', 'cp1', 2, 'Tung ra thị trường', false, 'u-trang'),
  MS('m8', 'cp2', 0, 'Video quy trình rang', false, 'u-thao'),
  MS('m9', 'cp2', 1, 'Video pha phin', false, 'u-thao'),
]
tasks.push(
  T({
    id: 't11',
    title: 'Đóng gói 100 set mẫu đợt 1',
    team_id: 'marketing',
    assignee_id: 'u-kien',
    created_by: 'u-trang',
    status: 'done',
    milestone_id: 'm3',
    expected_result: '100 set hoàn chỉnh, có thiệp',
    due_date: addDays(CW, 2),
    completed_at: iso(-10),
  }),
  T({
    id: 't12',
    title: 'Đóng gói 200 set đợt 2',
    team_id: 'marketing',
    assignee_id: 'u-kien',
    created_by: 'u-trang',
    status: 'doing',
    milestone_id: 'm3',
    expected_result: '200 set, kiểm tra hạn dùng',
    start_date: addDays(CW, 2),
    due_date: addDays(CW, 5),
  }),
  T({
    id: 't13',
    title: 'Chụp bộ ảnh set quà trên nền gỗ',
    team_id: 'marketing',
    assignee_id: 'u-thao',
    created_by: 'u-trang',
    status: 'todo',
    milestone_id: 'm6',
    expected_result: '12 ảnh đã chỉnh, đủ cho fanpage + website',
    due_date: addDays(CW, 11),
  }),
)

const msCounts = (id: string) => {
  const list = tasks.filter((t) => t.milestone_id === id)
  return { task_total: list.length, task_done: list.filter((t) => t.status === 'done').length }
}

export function milestoneRows(campaign?: string, week?: string): Row[] {
  return milestones
    .filter((m) => (!campaign || m.campaign_id === campaign) && (!week || m.week_start === week))
    .map((m) => {
      const c = campaigns.find((x) => x.id === m.campaign_id)!
      return { ...m, campaign_title: c.title, team_id: c.team_id, ...msCounts(String(m.id)) }
    })
}

export function campaignRows(): Row[] {
  return campaigns.map((c) => {
    const ms = milestones.filter((m) => m.campaign_id === c.id)
    const cur = ms.filter((m) => m.week_start === CW)
    const pending = ms.filter((m) => !m.done_at)
    return {
      ...c,
      milestone_total: ms.length,
      milestone_done: ms.filter((m) => m.done_at).length,
      current_week_total: cur.length,
      current_week_done: cur.filter((m) => m.done_at).length,
      can_pull:
        pending.length > 0 &&
        !pending.some((m) => String(m.week_start) <= CW) &&
        pending.some((m) => String(m.week_start) > CW),
      can_manage: true,
    }
  })
}
