import {
  ChevronRight,
  CircleSlash,
  ExternalLink,
  Funnel,
  Gauge,
  Inbox,
  MapPin,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MapView } from '@/components/MapView'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useCheckIns } from '@/features/checkin/api'
import { PlanBadge, ReportBadge } from '@/features/daily/badges'
import { useWeeklyGoals } from '@/features/goals/api'
import { goalPercent } from '@/features/goals/goal-math'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type {
  ComplianceScoreRow,
  ComplianceTrendRow,
  DashboardPersonRow,
  SalesSummary,
} from '@/lib/database.types'
import { formatDateVN, formatTimeVN } from '@/lib/date-vn'
import { formatNumber, formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { addDays, weekStart } from '@/lib/week'
import {
  useBands,
  useComplianceScores,
  useComplianceTrend,
  useDashboardInbox,
  useDashboardPeople,
  useResolveEscalation,
  useSalesSummary,
  useWeights,
} from './api'
import { compactVND, cumulativeRevenue, STATUS } from './chart-theme'
import { formatScore, ratio, scoreBand } from './compliance'
import { planText, reportText, teamNames } from './labels'
import {
  BentoCard,
  CsvButton,
  HBarChart,
  KpiTile,
  MiniArea,
  ProgressBar,
  RevenueChart,
  Ring,
  Sparkline,
  StatusBar,
} from './parts'
import type { Period } from './period'
import { ScoreBadge } from './score-badge'

const t = vi.dashboard

function Loading({ error, pending }: { error: unknown; pending: boolean }) {
  if (error) return <ErrorBox error={error} />
  if (pending)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  return null
}

const name = (r: { full_name: string | null; email: string }) => r.full_name ?? r.email

/** Điểm trung bình team theo tuần (bỏ qua người chưa có điểm) */
function teamAverage(rows: ComplianceTrendRow[], users: Set<string> | null) {
  const weeks = [...new Set(rows.map((r) => r.week_start))].sort()
  return weeks.map((w) => {
    const vals = rows
      .filter((r) => r.week_start === w && r.score !== null && (!users || users.has(r.user_id)))
      .map((r) => Number(r.score))
    return {
      label: t.compliance.weekOf(formatDateVN(w).slice(0, 5)),
      value: vals.length
        ? Math.round((10 * vals.reduce((a, b) => a + b, 0)) / vals.length) / 10
        : null,
    }
  })
}

function planCounts(rows: DashboardPersonRow[]) {
  const req = rows.filter((r) => r.plan_required || r.plan_id)
  return {
    required: req.length,
    onTime: req.filter((r) => r.plan_id && !r.plan_is_late).length,
    late: req.filter((r) => r.plan_id && r.plan_is_late).length,
    none: req.filter((r) => !r.plan_id && !r.leave_type).length,
    leave: rows.filter((r) => !r.plan_id && r.leave_type).length,
  }
}

function reportCounts(rows: DashboardPersonRow[]) {
  const req = rows.filter((r) => r.plan_required || r.report_submitted_at)
  return {
    required: req.length,
    submitted: req.filter((r) => r.report_submitted_at).length,
    late: req.filter((r) => r.report_submitted_at && r.report_status === 'late').length,
    none: req.filter((r) => !r.report_submitted_at).length,
  }
}

// ---------------------------------------------------------------------------
// Hàng thẻ chỉ số
// ---------------------------------------------------------------------------
export function KpiRow({
  date,
  team,
  trendEnd,
  sales,
}: {
  date: string
  team: string
  trendEnd: string
  sales: Period | null
}) {
  const people = useDashboardPeople(date)
  const trend = useComplianceTrend(trendEnd)
  const salesQ = useSalesSummary(sales?.from ?? '', sales?.to ?? '', Boolean(sales))
  const bands = useBands()
  const rows = (people.data ?? []).filter((r) => !team || r.teams.includes(team))
  const p = planCounts(rows)
  const r = reportCounts(rows)
  const inTeam = team ? new Set(rows.map((x) => x.user_id)) : null
  const avg = teamAverage(trend.data ?? [], inTeam)
  const last = [...avg].reverse().find((x) => x.value !== null)?.value ?? null
  const overduePeople = rows.filter((x) => x.tasks_overdue > 0).length
  const overdueTotal = rows.reduce((s, x) => s + x.tasks_overdue, 0)
  const s = salesQ.data
  const kpiPct = s && s.kpi_month > 0 ? (100 * s.revenue_month) / s.kpi_month : 0

  return (
    <>
      <KpiTile
        delay={0}
        label={`${t.kpi.plans} · ${formatDateVN(date).slice(0, 5)}`}
        value={
          <>
            {p.onTime + p.late}
            <span className="text-base font-medium text-muted-foreground">/{p.required}</span>
          </>
        }
        foot={t.kpi.planFoot(p.late, p.none)}
        visual={
          <Ring
            percent={ratio(p.onTime + p.late, p.required) ?? 0}
            label={t.kpi.plans}
            color={p.none ? '#4f46e5' : STATUS.good}
          />
        }
      />
      <KpiTile
        delay={60}
        label={`${t.kpi.reports} · ${formatDateVN(date).slice(0, 5)}`}
        value={
          <>
            {r.submitted}
            <span className="text-base font-medium text-muted-foreground">/{r.required}</span>
          </>
        }
        foot={t.kpi.reportFoot(r.late, r.none)}
        visual={<Ring percent={ratio(r.submitted, r.required) ?? 0} label={t.kpi.reports} />}
      />
      <KpiTile
        delay={120}
        label={t.kpi.avgScore}
        value={formatScore(last)}
        foot={<ScoreBadge score={last} bands={bands} />}
        visual={avg.length > 0 ? <MiniArea points={avg} /> : undefined}
      />
      {sales ? (
        <KpiTile
          delay={180}
          label={t.kpi.revenueMonth}
          value={s ? `${compactVND(s.revenue_month)}` : '—'}
          foot={
            s
              ? `${formatVND(s.revenue_month)} / ${t.kpi.kpiOf(compactVND(s.kpi_month))}`
              : undefined
          }
          visual={s ? <Ring percent={kpiPct} label={t.kpi.revenueMonth} /> : undefined}
        />
      ) : (
        <KpiTile
          delay={180}
          label={t.kpi.overdue}
          value={overdueTotal}
          tone={overdueTotal ? 'bad' : undefined}
          foot={t.kpi.overdueFoot(overduePeople)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Khối 1: từng người trong ngày
// ---------------------------------------------------------------------------
export function PeopleBlock({
  date,
  team,
  className,
}: {
  date: string
  team: string
  className?: string
}) {
  const q = useDashboardPeople(date)
  const rows = (q.data ?? []).filter((r) => !team || r.teams.includes(team))
  const c = planCounts(rows)
  const link = (r: DashboardPersonRow) => `/bao-cao/${r.user_id}/${date}`
  const header = [
    t.people.person,
    t.csv.email,
    t.goals.team,
    t.people.plan,
    t.people.report,
    t.people.due,
    t.people.overdue,
    t.people.lastCheckin,
    t.people.checkins,
  ]

  return (
    <BentoCard
      className={className}
      hover="subtle"
      delay={240}
      icon={Users}
      title={t.people.title(formatDateVN(date))}
      subtitle={
        q.data
          ? t.people.summary(
              c.onTime + c.late,
              c.required,
              rows.filter((r) => r.report_submitted_at).length,
            )
          : undefined
      }
      actions={
        <CsvButton
          filename={`quan-ly-nguoi-${date}`}
          header={header}
          rows={() =>
            rows.map((r) => [
              name(r),
              r.email,
              teamNames(r.teams),
              planText(r),
              reportText(r),
              r.tasks_due,
              r.tasks_overdue,
              r.last_checkin_at
                ? `${formatDateVN(r.last_checkin_at)} ${formatTimeVN(r.last_checkin_at)} ${r.last_checkin_place ?? ''}`.trim()
                : '',
              r.checkins,
            ])
          }
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{vi.reports.teamEmpty}</p>
      )}
      {rows.length > 0 && (
        <div className="grid gap-5">
          <StatusBar
            segments={[
              { key: 'on', label: vi.daily.planOnTime, value: c.onTime, color: STATUS.good },
              { key: 'late', label: vi.daily.planLate, value: c.late, color: STATUS.warn },
              {
                key: 'none',
                label: vi.daily.planNone,
                value: c.none,
                color: STATUS.bad,
              },
              { key: 'leave', label: vi.daily.planLeave, value: c.leave, color: STATUS.none },
            ]}
          />
          {/* Mobile: danh sách */}
          <ul className="-mx-2 grid gap-1 md:hidden">
            {rows.map((r) => (
              <li key={r.user_id}>
                <Link
                  to={link(r)}
                  className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
                >
                  <Avatar name={name(r)} src={r.avatar_url} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name(r)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <PersonBadges r={r} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <PersonNumbers r={r} />
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
          {/* Desktop: bảng */}
          <div className="-mx-2 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-slate-100">
                  <th className="px-2 pb-2 font-medium">{t.people.person}</th>
                  <th className="px-2 pb-2 font-medium">{t.people.plan}</th>
                  <th className="px-2 pb-2 font-medium">{t.people.report}</th>
                  <th className="px-2 pb-2 text-right font-medium">{t.people.due}</th>
                  <th className="px-2 pb-2 text-right font-medium">{t.people.overdue}</th>
                  <th className="px-2 pb-2 font-medium">{t.people.lastCheckin}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80"
                  >
                    <td className="px-2 py-2.5">
                      <Link to={link(r)} className="flex items-center gap-2.5 font-medium">
                        <Avatar name={name(r)} src={r.avatar_url} className="size-8" />
                        <span className="truncate hover:text-primary">{name(r)}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <PlanBadge
                        submitted={Boolean(r.plan_id)}
                        isLate={r.plan_is_late}
                        onLeave={Boolean(r.leave_type)}
                        required={r.plan_required}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <ReportBadge
                        submitted={Boolean(r.report_submitted_at)}
                        status={r.report_status}
                        required={r.plan_required}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.tasks_due}</td>
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right tabular-nums',
                        r.tasks_overdue > 0 && 'font-semibold text-rose-600',
                      )}
                    >
                      {r.tasks_overdue}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      <CheckinText r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BentoCard>
  )
}

function PersonBadges({ r }: { r: DashboardPersonRow }) {
  return (
    <>
      <PlanBadge
        prefix
        submitted={Boolean(r.plan_id)}
        isLate={r.plan_is_late}
        onLeave={Boolean(r.leave_type)}
        required={r.plan_required}
      />
      <ReportBadge
        prefix
        submitted={Boolean(r.report_submitted_at)}
        status={r.report_status}
        required={r.plan_required}
      />
    </>
  )
}

function PersonNumbers({ r }: { r: DashboardPersonRow }) {
  return (
    <>
      {t.people.due} {r.tasks_due} ·{' '}
      <span className={r.tasks_overdue ? 'font-semibold text-rose-600' : ''}>
        {t.people.overdue} {r.tasks_overdue}
      </span>
      {r.last_checkin_at && r.checkins > 0 && (
        <>
          {' '}
          · {t.people.lastCheckin.toLowerCase()} {formatTimeVN(r.last_checkin_at)}
        </>
      )}
    </>
  )
}

function CheckinText({ r }: { r: DashboardPersonRow }) {
  if (!r.last_checkin_at) return <>—</>
  const sameDay = r.checkins > 0
  return (
    <>
      {sameDay ? formatTimeVN(r.last_checkin_at) : formatDateVN(r.last_checkin_at)}
      {r.last_checkin_place ? ` · ${r.last_checkin_place}` : ''}
      {sameDay && r.checkins > 1 ? ` (${r.checkins})` : ''}
    </>
  )
}

// ---------------------------------------------------------------------------
// Khối 2: chờ tôi xử lý
// ---------------------------------------------------------------------------
function InboxSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {title}
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
          {count}
        </span>
      </h3>
      <ul className="grid gap-1">{children}</ul>
    </section>
  )
}

function InboxLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="group flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-secondary"
      >
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </li>
  )
}

export function InboxBlock({ className }: { className?: string }) {
  const q = useDashboardInbox()
  const resolve = useResolveEscalation()
  const d = q.data
  const total = d
    ? d.plans.length +
      d.reports.length +
      d.decisions.length +
      d.tasks_review.length +
      d.library_pending +
      d.leaves_pending.length +
      d.escalations.length
    : 0
  const csvRows = () => {
    if (!d) return []
    return [
      ...d.escalations.map((e) => [
        t.inbox.escalations,
        e.name,
        formatDateVN(e.period_month),
        e.reason,
      ]),
      ...d.decisions.map((x) => [t.inbox.decisions, x.name, formatDateVN(x.date), x.text]),
      ...d.plans.map((x) => [
        t.inbox.plans,
        x.name,
        formatDateVN(x.date),
        x.is_late ? t.inbox.late : '',
      ]),
      ...d.reports.map((x) => [
        t.inbox.reports,
        x.name,
        formatDateVN(x.date),
        vi.daily[x.status === 'late' ? 'reportLate' : 'reportOnTime'],
      ]),
      ...d.tasks_review.map((x) => [
        t.inbox.tasks,
        x.name ?? '',
        formatDateVN(x.due_date),
        x.title,
      ]),
      ...d.leaves_pending.map((x) => [
        t.inbox.leaves,
        x.name,
        formatDateVN(x.date),
        vi.leaveTypes[x.type],
      ]),
      ...(d.library_pending
        ? [[t.inbox.library, '', '', t.inbox.libraryCount(d.library_pending)]]
        : []),
    ]
  }

  return (
    <BentoCard
      className={className}
      hover="subtle"
      delay={300}
      icon={Inbox}
      title={
        <span className="flex items-center gap-2">
          {t.inbox.title}
          {d && (
            <span
              className={cn(
                'rounded-full px-2 text-xs font-semibold tabular-nums',
                total ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500',
              )}
            >
              {total}
            </span>
          )}
        </span>
      }
      actions={
        <CsvButton
          filename="quan-ly-cho-xu-ly"
          header={[t.csv.type, t.people.person, vi.reports.date, t.csv.content]}
          rows={csvRows}
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {d && total === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t.inbox.empty}</p>
      )}
      {d && (
        <div className="grid gap-5">
          <InboxSection title={t.inbox.escalations} count={d.escalations.length}>
            {d.escalations.map((e) => (
              <li
                key={e.id}
                className={cn(
                  'grid gap-2 rounded-xl p-3 text-sm ring-1 ring-inset',
                  e.level === 2 ? 'bg-rose-50/70 ring-rose-200' : 'bg-amber-50/70 ring-amber-200',
                )}
              >
                <p>
                  <span
                    className={cn(
                      'mr-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                      e.level === 2 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800',
                    )}
                  >
                    {t.inbox.level(e.level)}
                  </span>
                  <strong>{e.name}</strong> · {e.reason}
                </p>
                <div className="flex flex-wrap gap-2">
                  {e.task_id && (
                    <Link to={`/viec?task=${e.task_id}`}>
                      <Button size="sm" variant="outline" className="rounded-lg bg-white">
                        <ExternalLink /> {t.inbox.openTask}
                      </Button>
                    </Link>
                  )}
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={resolve.isPending}
                    onClick={() => {
                      const note = window.prompt(t.inbox.resolvePrompt)
                      if (note?.trim()) resolve.mutate({ id: e.id, note })
                    }}
                  >
                    {t.inbox.resolve}
                  </Button>
                </div>
              </li>
            ))}
          </InboxSection>
          <FieldError>{resolve.error?.message}</FieldError>
          <InboxSection title={t.inbox.decisions} count={d.decisions.length}>
            {d.decisions.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong className="font-medium">{x.name}</strong>
                <span className="text-muted-foreground"> · {formatDateVN(x.date)}</span>
                <span className="mt-0.5 block text-xs text-rose-600">{x.text}</span>
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.plans} count={d.plans.length}>
            {d.plans.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong className="font-medium">{x.name}</strong>
                <span className="text-muted-foreground"> · {formatDateVN(x.date)}</span>
                {x.is_late && <span className="text-amber-700"> · {t.inbox.late}</span>}
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.reports} count={d.reports.length}>
            {d.reports.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong className="font-medium">{x.name}</strong>
                <span className="text-muted-foreground"> · {formatDateVN(x.date)}</span>
                {x.status === 'late' && <span className="text-amber-700"> · {t.inbox.late}</span>}
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.tasks} count={d.tasks_review.length}>
            {d.tasks_review.map((x) => (
              <InboxLink key={x.id} to={`/viec?task=${x.id}`}>
                <span className="font-medium">{x.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {x.name ?? '—'}
                  {x.due_date ? ` · ${formatDateVN(x.due_date)}` : ''}
                </span>
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.leaves} count={d.leaves_pending.length}>
            {d.leaves_pending.map((x) => (
              <InboxLink key={x.id} to="/bao-cao?tab=team">
                <strong className="font-medium">{x.name}</strong>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatDateVN(x.date)} · {vi.leaveTypes[x.type]}
                </span>
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.library} count={d.library_pending}>
            <InboxLink to="/thu-vien?tab=review">
              {t.inbox.libraryCount(d.library_pending)}
            </InboxLink>
          </InboxSection>
        </div>
      )}
    </BentoCard>
  )
}

// ---------------------------------------------------------------------------
// Khối 3: điểm tuân thủ + xu hướng 4 tuần
// ---------------------------------------------------------------------------
export function ComplianceBlock({
  from,
  to,
  label,
  trendEnd,
  team,
  className,
}: {
  from: string
  to: string
  label: string
  trendEnd: string
  team: string
  className?: string
}) {
  const bands = useBands()
  const weights = useWeights()
  const q = useComplianceScores(from, to)
  const trend = useComplianceTrend(trendEnd)
  const rows = (q.data ?? []).filter((r) => !team || r.teams.includes(team))
  const weeks = [...new Set((trend.data ?? []).map((x) => x.week_start))].sort()
  const trendOf = (uid: string) =>
    weeks.map((w) => ({
      label: t.compliance.weekOf(formatDateVN(w).slice(0, 5)),
      value: trend.data?.find((x) => x.user_id === uid && x.week_start === w)?.score ?? null,
    }))
  const cols: {
    key: keyof Pick<ComplianceScoreRow, 'plan' | 'report' | 'tasks' | 'off_plan'>
    label: string
  }[] = [
    { key: 'plan', label: t.compliance.plan },
    { key: 'report', label: t.compliance.report },
    { key: 'tasks', label: t.compliance.tasks },
    { key: 'off_plan', label: t.compliance.offPlan },
  ]
  const bandCount = (b: 'good' | 'warn' | 'bad') =>
    rows.filter((r) => scoreBand(r.score, bands) === b).length

  return (
    <BentoCard
      className={className}
      hover="subtle"
      delay={360}
      icon={Gauge}
      title={`${t.compliance.title} · ${label}`}
      subtitle={t.compliance.hint(weights)}
      actions={
        <CsvButton
          filename={`quan-ly-tuan-thu-${from}_${to}`}
          header={[
            t.people.person,
            t.csv.email,
            t.goals.team,
            t.compliance.score,
            t.csv.band,
            ...cols.map((c) => c.label),
            ...weeks.map((w) => t.compliance.weekOf(formatDateVN(w))),
          ]}
          rows={() =>
            rows.map((r) => [
              name(r),
              r.email,
              teamNames(r.teams),
              r.score,
              t.compliance.bands[scoreBand(r.score, bands)],
              ...cols.map((c) => r[c.key]),
              ...trendOf(r.user_id).map((p) => p.value),
            ])
          }
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
      )}
      {rows.length > 0 && (
        <div className="grid gap-4">
          <StatusBar
            segments={[
              {
                key: 'good',
                label: t.compliance.bands.good,
                value: bandCount('good'),
                color: STATUS.good,
              },
              {
                key: 'warn',
                label: t.compliance.bands.warn,
                value: bandCount('warn'),
                color: STATUS.warn,
              },
              {
                key: 'bad',
                label: t.compliance.bands.bad,
                value: bandCount('bad'),
                color: STATUS.bad,
              },
              {
                key: 'none',
                label: t.compliance.bands.none,
                value: rows.length - bandCount('good') - bandCount('warn') - bandCount('bad'),
                color: STATUS.none,
              },
            ]}
          />
          {/* Mobile: danh sách */}
          <ul className="-mx-2 grid gap-1 sm:hidden">
            {rows.map((r) => (
              <li key={r.user_id} className="grid gap-1 rounded-xl px-2 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{name(r)}</p>
                  <ScoreBadge score={r.score} bands={bands} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {cols.map((c) => `${c.label} ${formatScore(r[c.key])}`).join(' · ')}
                  </p>
                  {trend.data && <Sparkline points={trendOf(r.user_id)} bands={bands} />}
                </div>
              </li>
            ))}
          </ul>
          <div className="-mx-2 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-slate-100">
                  <th className="px-2 pb-2 font-medium">{t.people.person}</th>
                  <th className="px-2 pb-2 font-medium">{t.compliance.score}</th>
                  {cols.map((c) => (
                    <th key={c.key} className="px-2 pb-2 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 pb-2 font-medium">{t.compliance.trend}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80"
                  >
                    <td className="px-2 py-2 font-medium">{name(r)}</td>
                    <td className="px-2 py-2">
                      <ScoreBadge score={r.score} bands={bands} />
                    </td>
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className="px-2 py-2 text-right text-slate-600 tabular-nums"
                        title={detailTitle(r, c.key)}
                      >
                        {formatScore(r[c.key])}
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      {trend.data && <Sparkline points={trendOf(r.user_id)} bands={bands} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BentoCard>
  )
}

function detailTitle(r: ComplianceScoreRow, key: string): string {
  const d = r.detail
  if (key === 'plan' || key === 'report')
    return t.compliance.days(key === 'plan' ? d.plan_days : d.report_days)
  if (key === 'tasks') return t.compliance.tasksDetail(d.tasks_done_on_time, d.tasks_due)
  return t.compliance.itemsDetail(d.off_plan_items, d.plan_items)
}

// ---------------------------------------------------------------------------
// Khối 4: Sales (4 thẻ)
// ---------------------------------------------------------------------------
function salesCsv(s: SalesSummary | undefined, monthLabel: string) {
  if (!s) return []
  const sla = ratio(s.contacted_in_sla, s.sla_due)
  return [
    [t.sales.newLeads, s.new_leads, ''],
    [
      t.sales.sla,
      sla === null ? '' : `${formatScore(sla)}%`,
      t.sales.slaDetail(s.contacted_in_sla, s.sla_due),
    ],
    [t.sales.overdue, s.overdue_now, ''],
    [t.sales.won, s.won, ''],
    [t.sales.lost, s.lost, ''],
    [t.sales.revenue, s.revenue, ''],
    [t.sales.revenueMonth(monthLabel), s.revenue_month, `KPI ${s.kpi_month}`],
    ...s.pipeline.map((p) => [`${t.sales.pipeline}: ${vi.stages[p.stage]}`, p.count, p.value]),
    ...s.lost_reasons.map((r) => [
      `${t.sales.lostReasons}: ${r.reason ?? t.sales.noReason}`,
      r.count,
      '',
    ]),
    ...(s.revenue_daily ?? []).map((d) => [
      `${t.sales.revenue}: ${formatDateVN(d.date)}`,
      d.revenue,
      '',
    ]),
  ]
}

export function SalesBlocks({
  period,
  label,
  classNames,
}: {
  period: Period
  label: string
  classNames: { revenue: string; leads: string; pipeline: string; lost: string }
}) {
  const q = useSalesSummary(period.from, period.to, true)
  const s = q.data
  const [y, m] = period.to.split('-').map(Number) as [number, number]
  const monthLabel = `${String(m).padStart(2, '0')}/${y}`
  const slaPct = s ? ratio(s.contacted_in_sla, s.sla_due) : null
  const csv = (
    <CsvButton
      filename={`quan-ly-sales-${period.from}_${period.to}`}
      header={[t.csv.metric, t.csv.value, t.csv.note]}
      rows={() => salesCsv(s, monthLabel)}
    />
  )

  return (
    <>
      <BentoCard
        className={classNames.revenue}
        delay={420}
        icon={TrendingUp}
        title={t.sales.revenueTrend(monthLabel)}
        subtitle={t.sales.revenueTrendHint}
        actions={csv}
      >
        <Loading error={q.error} pending={q.isPending} />
        {s && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatVND(s.revenue_month)}
              </p>
              <p className="text-sm text-muted-foreground">
                / {formatVND(s.kpi_month)} ·{' '}
                <strong className="text-foreground">
                  {formatScore(s.kpi_month ? (100 * s.revenue_month) / s.kpi_month : 0)}%
                </strong>
              </p>
            </div>
            <RevenueChart
              data={cumulativeRevenue(s.revenue_daily ?? [], s.kpi_month)}
              kpi={s.kpi_month}
            />
          </div>
        )}
      </BentoCard>

      <BentoCard
        className={classNames.leads}
        delay={480}
        icon={Users}
        title={`${t.sales.leads} · ${label}`}
      >
        <Loading error={q.error} pending={q.isPending} />
        {s && (
          <div className="grid gap-4">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
              <Ring percent={slaPct ?? 0} size={72} label={t.sales.sla} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t.sales.sla}</p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {slaPct === null ? '—' : `${formatScore(slaPct)}%`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.sales.slaDetail(s.contacted_in_sla, s.sla_due)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  [t.sales.newLeads, formatNumber(s.new_leads), false],
                  [t.sales.overdue, formatNumber(s.overdue_now), s.overdue_now > 0],
                  [t.sales.won, formatNumber(s.won), false],
                  [t.sales.lost, formatNumber(s.lost), false],
                ] as const
              ).map(([k, v, bad]) => (
                <div key={k} className="rounded-xl border border-slate-100 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-xl font-semibold tabular-nums',
                      bad && 'text-rose-600',
                    )}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              {t.sales.revenue}: <strong className="text-foreground">{formatVND(s.revenue)}</strong>
            </p>
          </div>
        )}
      </BentoCard>

      <BentoCard
        className={classNames.pipeline}
        delay={540}
        icon={Funnel}
        title={t.sales.pipeline}
        subtitle={
          s
            ? `${formatNumber(s.pipeline.reduce((a, p) => a + p.count, 0))} lead · ${t.sales.value} ${formatVND(s.pipeline.reduce((a, p) => a + Number(p.value), 0))}`
            : undefined
        }
      >
        {s &&
          (s.pipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <HBarChart
              name={t.sales.count}
              rows={s.pipeline.map((p) => ({
                key: p.stage,
                label: vi.stages[p.stage],
                value: p.count,
                detail: `${t.sales.value} ${formatVND(p.value)}`,
              }))}
            />
          ))}
      </BentoCard>

      <BentoCard
        className={classNames.lost}
        delay={600}
        icon={CircleSlash}
        title={t.sales.lostReasons}
        subtitle={label}
      >
        {s &&
          (s.lost_reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <HBarChart
              name={t.sales.count}
              rows={s.lost_reasons.map((r, i) => ({
                key: `${r.reason ?? ''}-${i}`,
                label: r.reason ?? t.sales.noReason,
                value: r.count,
              }))}
            />
          ))}
      </BentoCard>
    </>
  )
}

// ---------------------------------------------------------------------------
// Khối 5: mục tiêu tuần
// ---------------------------------------------------------------------------
export function GoalsBlock({
  date,
  team,
  className,
}: {
  date: string
  team: string
  className?: string
}) {
  const week = weekStart(date)
  const q = useWeeklyGoals(week)
  const rows = (q.data ?? []).filter((g) => !team || g.team_id === team)
  const label = `${formatDateVN(week).slice(0, 5)} – ${formatDateVN(addDays(week, 6))}`
  return (
    <BentoCard
      className={className}
      delay={660}
      icon={Target}
      title={t.goals.title(label)}
      actions={
        <CsvButton
          filename={`quan-ly-muc-tieu-${week}`}
          header={[
            t.goals.goal,
            t.goals.team,
            t.goals.target,
            t.goals.actual,
            t.csv.unit,
            t.goals.percent,
          ]}
          rows={() =>
            rows.map((g) => [
              g.title,
              vi.teams[g.team_id] ?? g.team_id,
              g.target,
              g.actual,
              g.unit,
              goalPercent(g.actual, g.target),
            ])
          }
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t.goals.empty}{' '}
          <Link to="/muc-tieu" className="font-medium text-primary hover:underline">
            {vi.nav.goals}
          </Link>
        </p>
      )}
      <ul className="grid gap-5">
        {rows.map((g) => {
          const pct = goalPercent(g.actual, g.target)
          return (
            <li key={g.id} className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {g.title}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {vi.teams[g.team_id] ?? g.team_id}
                  </span>
                </p>
                <p className="text-sm tabular-nums">
                  <strong className={pct >= 100 ? 'text-emerald-600' : ''}>{pct}%</strong>{' '}
                  <span className="text-muted-foreground">
                    {formatNumber(g.actual ?? 0)}/{formatNumber(g.target)} {g.unit ?? ''}
                  </span>
                </p>
              </div>
              <ProgressBar percent={pct} label={g.title} />
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}

// ---------------------------------------------------------------------------
// Khối 6: bản đồ check-in trong ngày
// ---------------------------------------------------------------------------
export function CheckinMapBlock({
  date,
  team,
  className,
}: {
  date: string
  team: string
  className?: string
}) {
  const q = useCheckIns(date, null)
  const users = useUsers()
  const userOf = (id: string) => users.data?.find((u) => u.id === id)
  const nameOf = (id: string) => userOf(id)?.full_name ?? userOf(id)?.email ?? ''
  const rows = (q.data ?? []).filter(
    (c) => !team || userOf(c.user_id)?.teams.some((m) => m.team_id === team),
  )
  return (
    <BentoCard
      className={className}
      hover="lift"
      delay={720}
      icon={MapPin}
      title={t.map.title(formatDateVN(date))}
      subtitle={rows.length ? `${rows.length} check-in` : undefined}
      actions={
        <CsvButton
          filename={`quan-ly-check-in-${date}`}
          header={[t.map.time, t.people.person, t.map.place, t.csv.lat, t.csv.lng]}
          rows={() =>
            rows.map((c) => [
              formatTimeVN(c.checked_in_at),
              nameOf(c.user_id),
              c.place_name,
              c.lat,
              c.lng,
            ])
          }
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && (
        <div className="grid gap-4">
          <MapView
            className="h-64 rounded-xl border-slate-100 md:h-72"
            points={rows.map((c) => ({
              id: c.id,
              lat: c.lat,
              lng: c.lng,
              color: '#4f46e5',
              popup: (
                <span>
                  <strong>{formatTimeVN(c.checked_in_at)}</strong> · {nameOf(c.user_id)}
                  <br />
                  {c.place_name}
                </span>
              ),
            }))}
          />
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.map.empty}</p>
          ) : (
            <ol className="relative grid gap-3 border-l border-slate-200 pl-4 text-sm">
              {rows.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary ring-4 ring-white" />
                  <span className="font-semibold tabular-nums">
                    {formatTimeVN(c.checked_in_at)}
                  </span>{' '}
                  <span>{nameOf(c.user_id)}</span>
                  <span className="text-muted-foreground"> · {c.place_name}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </BentoCard>
  )
}
