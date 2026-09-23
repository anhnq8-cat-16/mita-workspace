import { Badge } from '@/components/ui/badge'
import { vi } from '@/i18n/vi'
import type { ReportStatus } from '@/lib/database.types'

/** prefix: hiện "Kế hoạch: …" / "Báo cáo: …" khi 2 nhãn đứng cạnh nhau */
export function PlanBadge({
  isLate,
  submitted,
  onLeave,
  required = true,
  prefix = false,
}: {
  isLate?: boolean | null
  submitted: boolean
  onLeave?: boolean
  required?: boolean
  prefix?: boolean
}) {
  const p = prefix ? `${vi.reports.plan}: ` : ''
  if (submitted) {
    return isLate ? (
      <Badge variant="warning">{p + vi.daily.planLate}</Badge>
    ) : (
      <Badge variant="success">{p + vi.daily.planOnTime}</Badge>
    )
  }
  if (onLeave) return <Badge variant="secondary">{vi.daily.planLeave}</Badge>
  if (!required) return <Badge variant="outline">{vi.reports.notRequired}</Badge>
  return <Badge variant="destructive">{p + vi.daily.planNone}</Badge>
}

export function ReportBadge({
  status,
  submitted,
  required = true,
  prefix = false,
}: {
  status?: ReportStatus | null
  submitted: boolean
  required?: boolean
  prefix?: boolean
}) {
  const p = prefix ? `${vi.reports.report}: ` : ''
  if (status === 'missed')
    return <Badge variant="destructive">{p + vi.daily.reportMissedShort}</Badge>
  if (submitted && status === 'late')
    return <Badge variant="warning">{p + vi.daily.reportLate}</Badge>
  if (submitted) return <Badge variant="success">{p + vi.daily.reportOnTime}</Badge>
  if (!required) return null
  return <Badge variant="secondary">{p + vi.daily.planNone}</Badge>
}
