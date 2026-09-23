import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { useSalesActor } from '@/features/sales/api'
import { canReadAllSales } from '@/features/sales/sales-rules'
import { useTeams } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import { todayVN } from '@/lib/date-vn'
import {
  CheckinMapBlock,
  ComplianceBlock,
  GoalsBlock,
  InboxBlock,
  PeopleBlock,
  SalesBlock,
} from './blocks'
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

/** /quan-ly: dashboard cho trưởng nhóm / quản lý / admin. Kỳ và team lưu trên URL. */
export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const today = todayVN()
  const period = parsePeriod(params.get('mode'), params.get('date'), today)
  const team = params.get('team') ?? ''
  const teams = useTeams()
  const salesActor = useSalesActor()
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

  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        {/* Bộ lọc: 1 hàng phía trên mọi khối */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<PeriodMode>
            value={period.mode}
            onChange={(m) => update(periodOf(m, period.date))}
            items={(['day', 'week', 'month'] as const).map((m) => ({
              value: m,
              label: t.modes[m],
            }))}
          />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t.prev}
              onClick={() => update(shiftPeriod(period, -1, today))}
            >
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              className="w-40"
              value={period.date}
              max={today}
              aria-label={vi.reports.date}
              onChange={(e) => e.target.value && update(periodOf(period.mode, e.target.value))}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={t.next}
              disabled={period.to >= today}
              onClick={() => update(shiftPeriod(period, 1, today))}
            >
              <ChevronRight />
            </Button>
          </div>
          {period.date !== today && (
            <Button variant="ghost" size="sm" onClick={() => update(periodOf(period.mode, today))}>
              {t.today}
            </Button>
          )}
          <Select
            className="w-auto min-w-40"
            value={team}
            aria-label={vi.dashboard.goals.team}
            onChange={(e) => update(period, e.target.value)}
          >
            <option value="">{t.allTeams}</option>
            {teams.data?.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">{periodLabel(period)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PeopleBlock date={day} team={team} />
        <InboxBlock />
      </div>
      <ComplianceBlock
        from={compliancePeriod.from}
        to={compliancePeriod.to}
        label={periodLabel(compliancePeriod)}
        trendEnd={day}
        team={team}
      />
      {canReadAllSales(salesActor) && <SalesBlock period={period} label={periodLabel(period)} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <GoalsBlock date={day} team={team} />
        <CheckinMapBlock date={day} team={team} />
      </div>
    </div>
  )
}
