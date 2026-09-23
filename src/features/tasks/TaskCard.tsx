import { AlertTriangle, CalendarDays, CheckSquare, Lock } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/i18n/vi'
import type { TaskRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
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

export function TaskCard({
  task,
  assigneeName,
  onOpen,
  dragging,
}: {
  task: TaskRow
  assigneeName: string
  onOpen?: () => void
  dragging?: boolean
}) {
  const late = daysOverdue(task, todayVN()) > 0
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      className={cn(
        'grid gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md',
        late ? 'border-2 border-destructive' : 'border-border',
        dragging && 'rotate-1 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <p className="text-sm leading-snug font-medium">
        {task.status === 'done' && <CheckSquare className="mr-1 inline size-4 text-success" />}
        {task.title}
      </p>
      <TaskMeta task={task} assigneeName={assigneeName} />
    </div>
  )
}
