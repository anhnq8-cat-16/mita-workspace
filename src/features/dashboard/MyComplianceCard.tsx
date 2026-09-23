import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBox } from '@/components/ui/spinner'
import { vi } from '@/i18n/vi'
import type { ComplianceDetail } from '@/lib/database.types'
import { todayVN } from '@/lib/date-vn'
import { useBands, useMyCompliance } from './api'
import { formatScore } from './compliance'
import { periodOf } from './period'
import { ScoreBadge } from './score-badge'

const t = vi.dashboard.compliance

function Row({ label, d }: { label: string; d: ComplianceDetail | undefined }) {
  const bands = useBands()
  return (
    <div className="grid gap-1 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <ScoreBadge score={d?.score} bands={bands} />
      </div>
      {d && (
        <p className="text-xs text-muted-foreground">
          {t.plan} {formatScore(d.plan)} · {t.report} {formatScore(d.report)} · {t.tasks}{' '}
          {formatScore(d.tasks)} · {t.offPlan} {formatScore(d.off_plan)}
        </p>
      )}
    </div>
  )
}

/** Điểm tuân thủ của chính mình (tuần này, tháng này) – trên /bao-cao */
export function MyComplianceCard({ userId }: { userId: string }) {
  const today = todayVN()
  const week = periodOf('week', today)
  const month = periodOf('month', today)
  const w = useMyCompliance(userId, week.from, today)
  const m = useMyCompliance(userId, month.from, today)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.mine}</CardTitle>
        <p className="text-xs text-muted-foreground">{t.mineHint}</p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {(w.error || m.error) && <ErrorBox error={w.error ?? m.error} />}
        <Row label={t.mineWeek} d={w.data} />
        <Row label={t.mineMonth} d={m.data} />
      </CardContent>
    </Card>
  )
}
