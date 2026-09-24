import { AlertTriangle, CalendarDays, CheckSquare, Flag, Lock, Target } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/i18n/vi'
import type { TaskRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
import { teamColor } from '@/lib/team-colors'
import { cn } from '@/lib/utils'
import { daysOverdue } from './task-rules'

const priorityClass: Record<TaskRow['priority'], string> = {
  urgent: 'bg-destructive text-white',
  high: 'bg-warning/30 text-warning-foreground',
  normal: '',
  low: '',
}

export function TaskMeta({ task, assigneeName }: { task: TaskRow; assigneeName: string }) {
  const late = daysOverdue(task, todayVN())
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {(task.priority === 'urgent' || task.priority === 'high') && (
        <span className={cn('rounded px-1.5 py-0.5 font-medium', priorityClass[task.priority])}>
          {vi.priorities[task.priority]}
        </span>
      )}
      {task.due_date && (
        <span
          className={cn(
            'inline-flex items-center gap-1',
            late ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          <CalendarDays className="size-3.5" />
          {formatDateVN(task.due_date)}
          {late > 0 && ` · ${vi.tasks.overdueDays(late)}`}
        </span>
      )}
      {task.is_sensitive && (
        <Badge variant="outline" className="gap-1">
          <Lock className="size-3" /> {vi.tasks.sensitive}
        </Badge>
      )}
      {task.is_off_plan && <Badge variant="destructive">{vi.tasks.offPlan}</Badge>}
      {task.carried_over_count > 0 && (
        <Badge variant="warning">{vi.tasks.carried(task.carried_over_count)}</Badge>
      )}
      {task.status === 'blocked' && task.blocked_reason && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertTriangle className="size-3.5" /> {task.blocked_reason}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1 text-muted-foreground">
        {assigneeName ? (
          <>
            <Avatar name={assigneeName} className="size-5 text-[9px]" />
            <span className="max-w-24 truncate">{assigneeName}</span>
          </>
        ) : (
          vi.tasks.unassigned
        )}
      </span>
    </div>
  )
}

export interface CardCampaign {
  campaign: string
  milestone: string
}

export function TaskCard({
  task,
  assigneeName,
  onOpen,
  dragging,
  campaign,
}: {
  task: TaskRow
  assigneeName: string
  onOpen?: () => void
  dragging?: boolean
  campaign?: CardCampaign
}) {
  const late = daysOverdue(task, todayVN()) > 0
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      style={{ borderLeftColor: teamColor(task.team_id) }}
      className={cn(
        'grid min-w-0 gap-2 rounded-lg border border-l-4 bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md [&>*]:min-w-0',
        late ? 'border-y-2 border-r-2 border-y-destructive border-r-destructive' : 'border-border',
        dragging && 'rotate-1 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {task.team_id && (
          <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
            {vi.teams[task.team_id] ?? task.team_id}
          </span>
        )}
        {campaign && (
          <span
            className="flex max-w-full min-w-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5"
            title={`${campaign.campaign} · ${campaign.milestone}`}
          >
            <Flag className="size-3 shrink-0" />
            <span className="truncate">
              {campaign.campaign} · {campaign.milestone}
            </span>
          </span>
        )}
      </div>
      <p className="text-sm leading-snug font-medium">
        {task.status === 'done' && <CheckSquare className="mr-1 inline size-4 text-success" />}
        {task.title}
      </p>
      {task.expected_result && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          <Target
            className="mr-1 inline size-3.5 align-text-bottom"
            aria-label={vi.tasks.fields.expected}
          />
          {task.expected_result}
        </p>
      )}
      <TaskMeta task={task} assigneeName={assigneeName} />
    </div>
  )
}
