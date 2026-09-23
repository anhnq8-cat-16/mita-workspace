import { Badge } from '@/components/ui/badge'
import { vi } from '@/i18n/vi'
import type { LeadRow, LeadStage } from '@/lib/database.types'
import { formatDateTimeVN } from '@/lib/date-vn'
import { formatDuration } from '@/lib/use-now'
import { slaState } from './sales-rules'

const stageVariant: Record<
  LeadStage,
  'secondary' | 'default' | 'warning' | 'success' | 'destructive'
> = {
  new: 'secondary',
  contacted: 'default',
  consulting: 'default',
  sample_sent: 'warning',
  quoted: 'warning',
  won: 'success',
  lost: 'destructive',
}

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <Badge variant={stageVariant[stage]}>{vi.stages[stage]}</Badge>
}

export function SlaBadge({
  lead,
  now = new Date(),
}: {
  lead: Pick<LeadRow, 'first_contacted_at' | 'first_contact_due_at' | 'stage'>
  now?: Date
}) {
  const state = slaState(lead, now)
  if (state === 'closed') return null
  if (state === 'contacted') {
    return (
      <span className="text-xs text-muted-foreground">
        {vi.sales.contacted(formatDateTimeVN(lead.first_contacted_at))}
      </span>
    )
  }
  if (state === 'overdue') return <Badge variant="destructive">{vi.sales.slaOverdue}</Badge>
  return (
    <Badge variant="outline">
      {vi.sales.slaLeft(
        formatDuration(new Date(lead.first_contact_due_at).getTime() - now.getTime()),
      )}
    </Badge>
  )
}
