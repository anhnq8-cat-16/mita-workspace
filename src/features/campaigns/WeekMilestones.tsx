import { CheckCircle2, Circle, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { canManageTask } from '@/features/tasks/task-rules'
import { useTaskContext } from '@/features/tasks/use-task-context'
import { vi } from '@/i18n/vi'
import type { MilestoneProgressRow } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { useSetMilestoneDone } from './api'

const t = vi.campaigns

/** KPI tuần theo đầu mục: các mốc chiến dịch của 1 team trong tuần */
export function WeekMilestones({ items }: { items: MilestoneProgressRow[] }) {
  const { actor } = useTaskContext()
  const toggle = useSetMilestoneDone()
  if (!items.length) return null
  const done = items.filter((m) => m.done_at).length
  return (
    <section className="grid gap-2 border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Flag className="size-4 text-primary" /> {t.weekKpi}
        </h3>
        <span className="text-sm font-medium tabular-nums">
          {t.weekKpiDone(done, items.length)}
        </span>
      </div>
      <ul className="grid gap-1">
        {items.map((m) => {
          const manage = canManageTask(actor, { team_id: m.team_id })
          const Icon = m.done_at ? CheckCircle2 : Circle
          return (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={!manage || toggle.isPending}
                aria-pressed={Boolean(m.done_at)}
                aria-label={m.done_at ? t.markUndone : t.markDone}
                onClick={() => toggle.mutate({ id: m.id, done: !m.done_at })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-default"
              >
                <Icon
                  className={cn('size-5', m.done_at ? 'text-success' : 'text-muted-foreground')}
                />
              </button>
              <Link
                to={`/muc-tieu?tab=campaigns&c=${m.campaign_id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className={cn(m.done_at && 'text-muted-foreground line-through')}>
                  {m.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.campaign_title} · {t.milestone.due} {formatDateVN(m.due_date)}
                  {m.task_total > 0 && ` · ${t.tasksCount(m.task_done, m.task_total)}`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
