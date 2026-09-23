import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useSalesActor } from '@/features/sales/api'
import { canReadAllSales } from '@/features/sales/sales-rules'
import { useTeams } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import { todayVN, weekdayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import {
  CheckinMapBlock,
  ComplianceBlock,
  GoalsBlock,
  InboxBlock,
  KpiRow,
  PeopleBlock,
  SalesBlocks,
} from './blocks'
import { Segmented } from './parts'
import {
  focusDate,
  parsePeriod,
  periodLabel,
  periodOf,
  shiftPeriod,
  type Period,
  type PeriodMode,
} from './period'

const t = vi.dashboard

const control =
  'flex min-h-11 items-center rounded-xl border border-slate-200 bg-white text-sm shadow-sm transition-colors hover:border-slate-300 focus-within:ring-2 focus-within:ring-ring sm:min-h-10'

/** /quan-ly: dashboard cho trưởng nhóm / quản lý / admin. Kỳ và team lưu trên URL. */
export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const today = todayVN()
  const period = parsePeriod(params.get('mode'), params.get('date'), today)
  const team = params.get('team') ?? ''
  const teams = useTeams()
  const salesActor = useSalesActor()
  const showSales = canReadAllSales(salesActor)
  const day = focusDate(period, today)

  const update = (p: Period, nextTeam = team) => {
    const next = new URLSearchParams()
    if (p.mode !== 'day') next.set('mode', p.mode)
    if (p.date !== today) next.set('date', p.date)
    if (nextTeam) next.set('team', nextTeam)
    setParams(next, { replace: true })
  }

  // Tuân thủ luôn theo tuần (chế độ ngày → tuần chứa ngày đó) hoặc theo tháng
  const compliancePeriod = period.mode === 'day' ? periodOf('week', period.date) : period
  const teamName = teams.data?.find((x) => x.id === team)?.name ?? t.allTeams

  return (
    <div className="grid gap-6 pb-4 sm:gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{vi.nav.dashboard}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.subtitle(`${weekdayVN(`${day}T05:00:00Z`)}, ${periodLabel(period)}`, teamName)}
          </p>
        </div>
        {/* Bộ lọc: 1 hàng phía trên mọi khối */}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<PeriodMode>
            label={t.periodLabel}
            value={period.mode}
            onChange={(m) => update(periodOf(m, period.date))}
            items={(['day', 'week', 'month'] as const).map((m) => ({
              value: m,
              label: t.modes[m],
            }))}
          />
          <div className={cn(control, 'overflow-hidden')}>
            <button
              type="button"
              aria-label={t.prev}
              onClick={() => update(shiftPeriod(period, -1, today))}
              className="flex min-h-11 w-10 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 sm:min-h-10"
            >
              <ChevronLeft className="size-4" />
            </button>
            <label className="flex items-center gap-2 border-x border-slate-200 px-3">
              <CalendarDays className="size-4 text-slate-400" aria-hidden />
              <input
                type="date"
                className="min-h-10 bg-transparent text-sm outline-none"
                value={period.date}
                max={today}
                aria-label={vi.reports.date}
                onChange={(e) => e.target.value && update(periodOf(period.mode, e.target.value))}
              />
            </label>
            <button
              type="button"
              aria-label={t.next}
              disabled={period.to >= today}
              onClick={() => update(shiftPeriod(period, 1, today))}
              className="flex min-h-11 w-10 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent sm:min-h-10"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {period.date !== today && (
            <button
              type="button"
              onClick={() => update(periodOf(period.mode, today))}
              className="min-h-10 rounded-xl px-3 text-sm font-medium text-primary hover:bg-secondary"
            >
              {t.today}
            </button>
          )}
          <label className={cn(control, 'px-3')}>
            <select
              className="min-h-10 bg-transparent pr-1 text-sm outline-none"
              value={team}
              aria-label={t.goals.team}
              onChange={(e) => update(period, e.target.value)}
            >
              <option value="">{t.allTeams}</option>
              {teams.data?.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Mobile: thẻ chỉ số trượt ngang; từ sm: lưới 2 cột; lg: 4 cột */}
        <div className="col-span-2 -mx-4 grid snap-x snap-mandatory [scrollbar-width:none] auto-cols-[78%] grid-flow-col gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:p-0 lg:col-span-12 lg:grid-cols-4 [&>*]:snap-start">
          <KpiRow date={day} team={team} trendEnd={day} sales={showSales ? period : null} />
        </div>

        <PeopleBlock date={day} team={team} className="col-span-2 lg:col-span-8" />
        <InboxBlock className="col-span-2 lg:col-span-4 lg:row-span-2" />
        <ComplianceBlock
          className="col-span-2 lg:col-span-8"
          from={compliancePeriod.from}
          to={compliancePeriod.to}
          label={periodLabel(compliancePeriod)}
          trendEnd={day}
          team={team}
        />

        {showSales && (
          <SalesBlocks
            period={period}
            label={periodLabel(period)}
            classNames={{
              revenue: 'col-span-2 lg:col-span-8',
              leads: 'col-span-2 lg:col-span-4',
              pipeline: 'col-span-2 lg:col-span-7',
              lost: 'col-span-2 lg:col-span-5',
            }}
          />
        )}

        <GoalsBlock date={day} team={team} className="col-span-2 lg:col-span-5" />
        <CheckinMapBlock date={day} team={team} className="col-span-2 lg:col-span-7" />
      </div>
    </div>
  )
}
