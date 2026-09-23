import { ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MapView } from '@/components/MapView'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useCheckIns } from '@/features/checkin/api'
import { PlanBadge, ReportBadge } from '@/features/daily/badges'
import { useWeeklyGoals } from '@/features/goals/api'
import { goalPercent } from '@/features/goals/goal-math'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { ComplianceScoreRow, DashboardPersonRow } from '@/lib/database.types'
import { formatDateVN, formatTimeVN } from '@/lib/date-vn'
import { formatNumber, formatVND } from '@/lib/format'
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
import { formatScore, ratio, scoreBand } from './compliance'
import { planText, reportText, teamNames } from './labels'
import { BarList, Block, CsvButton, ProgressBar, ScoreBadge, Sparkline, Stat } from './parts'
import type { Period } from './period'

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

// ---------------------------------------------------------------------------
// Khối 1: từng người trong ngày
// ---------------------------------------------------------------------------
export function PeopleBlock({ date, team }: { date: string; team: string }) {
  const q = useDashboardPeople(date)
  const rows = (q.data ?? []).filter((r) => !team || r.teams.includes(team))
  const required = rows.filter((r) => r.plan_required)
  const summary = t.people.summary(
    required.filter((r) => r.plan_id).length,
    required.length,
    required.filter((r) => r.report_submitted_at).length,
  )
  const link = (r: DashboardPersonRow) => `/bao-cao/${r.user_id}/${date}`
  const header = [
    t.people.person,
    t.csv.email,
    vi.dashboard.goals.team,
    t.people.plan,
    t.people.report,
    t.people.due,
    t.people.overdue,
    t.people.lastCheckin,
    t.people.checkins,
  ]

  return (
    <Block
      title={t.people.title(formatDateVN(date))}
      description={q.data ? summary : undefined}
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
      contentClassName="p-0"
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && rows.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">{vi.reports.teamEmpty}</p>
      )}
      {/* Mobile: danh sách */}
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.user_id} className="border-t border-border">
            <Link
              to={link(r)}
              className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted"
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
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {/* Desktop: bảng */}
      {rows.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t.people.person}</th>
                <th className="px-2 py-2 font-medium">{t.people.plan}</th>
                <th className="px-2 py-2 font-medium">{t.people.report}</th>
                <th className="px-2 py-2 text-right font-medium">{t.people.due}</th>
                <th className="px-2 py-2 text-right font-medium">{t.people.overdue}</th>
                <th className="px-4 py-2 font-medium">{t.people.lastCheckin}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user_id}
                  className="border-b border-border last:border-b-0 hover:bg-muted"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={link(r)}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Avatar name={name(r)} src={r.avatar_url} className="size-7" />
                      <span className="truncate">{name(r)}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <PlanBadge
                      submitted={Boolean(r.plan_id)}
                      isLate={r.plan_is_late}
                      onLeave={Boolean(r.leave_type)}
                      required={r.plan_required}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <ReportBadge
                      submitted={Boolean(r.report_submitted_at)}
                      status={r.report_status}
                      required={r.plan_required}
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.tasks_due}</td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${r.tasks_overdue ? 'font-semibold text-destructive' : ''}`}
                  >
                    {r.tasks_overdue}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    <CheckinText r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
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
      <span className={r.tasks_overdue ? 'font-semibold text-destructive' : ''}>
        {t.people.overdue} {r.tasks_overdue}
      </span>
      {r.last_checkin_at && (
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
    <section className="grid gap-1">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
        {title} <Badge variant="secondary">{count}</Badge>
      </h3>
      <ul className="divide-y divide-border rounded-lg border border-border">{children}</ul>
    </section>
  )
}

function InboxLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}

export function InboxBlock() {
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
    <Block
      title={
        <span className="flex items-center gap-2">
          {t.inbox.title}{' '}
          {d && <Badge variant={total ? 'destructive' : 'secondary'}>{total}</Badge>}
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
      {d && total === 0 && <p className="text-sm text-muted-foreground">{t.inbox.empty}</p>}
      {d && (
        <div className="grid gap-4">
          <InboxSection title={t.inbox.escalations} count={d.escalations.length}>
            {d.escalations.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <p className="w-full">
                  <Badge variant={e.level === 2 ? 'destructive' : 'warning'}>
                    {t.inbox.level(e.level)}
                  </Badge>{' '}
                  <strong>{e.name}</strong> · {e.reason}
                </p>
                {e.task_id && (
                  <Link to={`/viec?task=${e.task_id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink /> {t.inbox.openTask}
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  disabled={resolve.isPending}
                  onClick={() => {
                    const note = window.prompt(t.inbox.resolvePrompt)
                    if (note?.trim()) resolve.mutate({ id: e.id, note })
                  }}
                >
                  {t.inbox.resolve}
                </Button>
              </li>
            ))}
          </InboxSection>
          <FieldError>{resolve.error?.message}</FieldError>
          <InboxSection title={t.inbox.decisions} count={d.decisions.length}>
            {d.decisions.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong>{x.name}</strong> · {formatDateVN(x.date)}
                <span className="block text-xs text-destructive">{x.text}</span>
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.plans} count={d.plans.length}>
            {d.plans.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong>{x.name}</strong> · {formatDateVN(x.date)}
                {x.is_late && <span className="text-warning-foreground"> · {t.inbox.late}</span>}
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.reports} count={d.reports.length}>
            {d.reports.map((x) => (
              <InboxLink key={x.id} to={`/bao-cao/${x.user_id}/${x.date}`}>
                <strong>{x.name}</strong> · {formatDateVN(x.date)}
                {x.status === 'late' && (
                  <span className="text-warning-foreground"> · {t.inbox.late}</span>
                )}
              </InboxLink>
            ))}
          </InboxSection>
          <InboxSection title={t.inbox.tasks} count={d.tasks_review.length}>
            {d.tasks_review.map((x) => (
              <InboxLink key={x.id} to={`/viec?task=${x.id}`}>
                {x.title}
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
                <strong>{x.name}</strong> · {formatDateVN(x.date)} · {vi.leaveTypes[x.type]}
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
    </Block>
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
}: {
  from: string
  to: string
  label: string
  trendEnd: string
  team: string
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

  return (
    <Block
      title={`${t.compliance.title} · ${label}`}
      description={t.compliance.hint(weights)}
      actions={
        <CsvButton
          filename={`quan-ly-tuan-thu-${from}_${to}`}
          header={[
            t.people.person,
            t.csv.email,
            vi.dashboard.goals.team,
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
      contentClassName="p-0"
    >
      <Loading error={q.error} pending={q.isPending} />
      {q.data && rows.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">{t.empty}</p>
      )}
      {/* Mobile: danh sách */}
      <ul className="sm:hidden">
        {rows.map((r) => (
          <li key={r.user_id} className="grid gap-1 border-t border-border px-4 py-3">
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
      {rows.length > 0 && (
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t.people.person}</th>
                <th className="px-2 py-2 font-medium">{t.compliance.score}</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium">{t.compliance.trend}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2">
                    <p className="font-medium">{name(r)}</p>
                  </td>
                  <td className="px-2 py-2">
                    <ScoreBadge score={r.score} bands={bands} />
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className="px-2 py-2 text-right tabular-nums"
                      title={detailTitle(r, c.key)}
                    >
                      {formatScore(r[c.key])}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    {trend.data && <Sparkline points={trendOf(r.user_id)} bands={bands} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
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
// Khối 4: Sales
// ---------------------------------------------------------------------------
export function SalesBlock({ period, label }: { period: Period; label: string }) {
  const q = useSalesSummary(period.from, period.to, true)
  const s = q.data
  const slaPct = s ? ratio(s.contacted_in_sla, s.sla_due) : null
  const monthPct = s && s.kpi_month > 0 ? (100 * s.revenue_month) / s.kpi_month : 0
  const [y, m, d] = period.to.split('-').map(Number) as [number, number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const expected = (100 * d) / daysInMonth

  return (
    <Block
      title={`${t.sales.title} · ${label}`}
      actions={
        <CsvButton
          filename={`quan-ly-sales-${period.from}_${period.to}`}
          header={[t.csv.metric, t.csv.value, t.csv.note]}
          rows={() =>
            s
              ? [
                  [t.sales.newLeads, s.new_leads, ''],
                  [
                    t.sales.sla,
                    slaPct === null ? '' : `${formatScore(slaPct)}%`,
                    t.sales.slaDetail(s.contacted_in_sla, s.sla_due),
                  ],
                  [t.sales.overdue, s.overdue_now, ''],
                  [t.sales.won, s.won, ''],
                  [t.sales.lost, s.lost, ''],
                  [t.sales.revenue, s.revenue, ''],
                  [
                    t.sales.revenueMonth(`${String(m).padStart(2, '0')}/${y}`),
                    s.revenue_month,
                    `KPI ${s.kpi_month}`,
                  ],
                  ...s.pipeline.map((p) => [
                    `${t.sales.pipeline}: ${vi.stages[p.stage]}`,
                    p.count,
                    p.value,
                  ]),
                  ...s.lost_reasons.map((r) => [
                    `${t.sales.lostReasons}: ${r.reason ?? t.sales.noReason}`,
                    r.count,
                    '',
                  ]),
                ]
              : []
          }
        />
      }
    >
      <Loading error={q.error} pending={q.isPending} />
      {s && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t.sales.newLeads} value={formatNumber(s.new_leads)} />
            <Stat
              label={t.sales.sla}
              value={slaPct === null ? '—' : `${formatScore(slaPct)}%`}
              detail={t.sales.slaDetail(s.contacted_in_sla, s.sla_due)}
            />
            <Stat
              label={t.sales.overdue}
              value={formatNumber(s.overdue_now)}
              tone={s.overdue_now > 0 ? 'bad' : undefined}
            />
            <Stat
              label={`${t.sales.won} / ${t.sales.lost}`}
              value={`${formatNumber(s.won)} / ${formatNumber(s.lost)}`}
              detail={`${t.sales.revenue}: ${formatVND(s.revenue)}`}
            />
          </div>

          <section className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">
                {t.sales.revenueMonth(`${String(m).padStart(2, '0')}/${y}`)}
              </h3>
              <p className="text-sm tabular-nums">
                <strong>{formatScore(monthPct)}%</strong>{' '}
                <span className="text-muted-foreground">
                  {t.sales.kpiDetail(formatVND(s.revenue_month), formatVND(s.kpi_month))}
                </span>
              </p>
            </div>
            <ProgressBar
              percent={monthPct}
              expected={expected}
              label={t.sales.revenueMonth(`${m}/${y}`)}
            />
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="grid content-start gap-2">
              <h3 className="text-sm font-medium">{t.sales.pipeline}</h3>
              {s.pipeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.empty}</p>
              ) : (
                <BarList
                  rows={s.pipeline.map((p) => ({
                    key: p.stage,
                    label: vi.stages[p.stage],
                    value: p.count,
                    valueLabel: String(p.count),
                    tooltip: `${vi.stages[p.stage]}: ${p.count} lead · ${t.sales.value} ${formatVND(p.value)}`,
                  }))}
                />
              )}
            </section>
            <section className="grid content-start gap-2">
              <h3 className="text-sm font-medium">{t.sales.lostReasons}</h3>
              {s.lost_reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.empty}</p>
              ) : (
                <BarList
                  rows={s.lost_reasons.map((r, i) => ({
                    key: `${r.reason ?? ''}-${i}`,
                    label: r.reason ?? t.sales.noReason,
                    value: r.count,
                    valueLabel: String(r.count),
                    tooltip: `${r.reason ?? t.sales.noReason}: ${r.count}`,
                  }))}
                />
              )}
            </section>
          </div>
        </div>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------------------
// Khối 5: mục tiêu tuần
// ---------------------------------------------------------------------------
export function GoalsBlock({ date, team }: { date: string; team: string }) {
  const week = weekStart(date)
  const q = useWeeklyGoals(week)
  const rows = (q.data ?? []).filter((g) => !team || g.team_id === team)
  const label = `${formatDateVN(week).slice(0, 5)} – ${formatDateVN(addDays(week, 6))}`
  return (
    <Block
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
          <Link to="/muc-tieu" className="text-primary underline">
            {vi.nav.goals}
          </Link>
        </p>
      )}
      <ul className="grid gap-3">
        {rows.map((g) => {
          const pct = goalPercent(g.actual, g.target)
          return (
            <li key={g.id} className="grid gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {g.title}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {vi.teams[g.team_id] ?? g.team_id}
                  </span>
                </p>
                <p className="text-sm tabular-nums">
                  <strong>{pct}%</strong>{' '}
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
    </Block>
  )
}

// ---------------------------------------------------------------------------
// Khối 6: bản đồ check-in trong ngày
// ---------------------------------------------------------------------------
export function CheckinMapBlock({ date, team }: { date: string; team: string }) {
  const q = useCheckIns(date, null)
  const users = useUsers()
  const userOf = (id: string) => users.data?.find((u) => u.id === id)
  const nameOf = (id: string) => userOf(id)?.full_name ?? userOf(id)?.email ?? ''
  const rows = (q.data ?? []).filter(
    (c) => !team || userOf(c.user_id)?.teams.some((m) => m.team_id === team),
  )
  return (
    <Block
      title={t.map.title(formatDateVN(date))}
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
        <div className="grid gap-3">
          <MapView
            className="h-64 md:h-80"
            points={rows.map((c) => ({
              id: c.id,
              lat: c.lat,
              lng: c.lng,
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
            <ul className="divide-y divide-border text-sm">
              {rows.map((c) => (
                <li key={c.id} className="flex gap-3 py-1.5">
                  <span className="w-12 shrink-0 font-medium tabular-nums">
                    {formatTimeVN(c.checked_in_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {nameOf(c.user_id)}
                    <span className="text-muted-foreground"> · {c.place_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Block>
  )
}
