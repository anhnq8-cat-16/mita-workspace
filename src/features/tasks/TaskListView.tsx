import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { vi } from '@/i18n/vi'
import type { TaskRow } from '@/lib/database.types'
import { todayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { TaskMeta } from './TaskCard'
import { daysOverdue, STATUSES } from './task-rules'
import { useTaskContext } from './use-task-context'

const statusVariant = {
  todo: 'secondary',
  doing: 'default',
  review: 'warning',
  done: 'success',
  blocked: 'destructive',
} as const

/** Sắp xếp danh sách: quá hạn → hạn gần → chưa có hạn; xong xuống cuối */
function listOrder(a: TaskRow, b: TaskRow) {
  const doneA = a.status === 'done' ? 1 : 0
  const doneB = b.status === 'done' ? 1 : 0
  if (doneA !== doneB) return doneA - doneB
  return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
}

export function TaskRows({ tasks, onOpen }: { tasks: TaskRow[]; onOpen: (id: string) => void }) {
  const { nameOf } = useTaskContext()
  const today = todayVN()
  if (tasks.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{vi.tasks.empty}</p>
  }
  return (
    <ul>
      {[...tasks].sort(listOrder).map((task) => (
        <li key={task.id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            onClick={() => onOpen(task.id)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted',
              daysOverdue(task, today) > 0 && 'border-l-4 border-destructive',
            )}
          >
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">{task.title}</p>
                <Badge variant={statusVariant[task.status]}>{vi.taskStatus[task.status]}</Badge>
              </div>
              <TaskMeta task={task} assigneeName={nameOf(task.assignee_id)} />
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function TaskListView({
  tasks,
  onOpen,
}: {
  tasks: TaskRow[]
  onOpen: (id: string) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <TaskRows tasks={tasks} onOpen={onOpen} />
      </CardContent>
    </Card>
  )
}

/** Theo người (lead/manager): mỗi người 1 nhóm, kèm số việc theo trạng thái */
export function PeopleView({ tasks, onOpen }: { tasks: TaskRow[]; onOpen: (id: string) => void }) {
  const { nameOf, byId } = useTaskContext()
  const today = todayVN()
  const groups = new Map<string, TaskRow[]>()
  for (const t of tasks) {
    const key = t.assignee_id ?? ''
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const entries = [...groups.entries()].sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b), 'vi'))

  if (entries.length === 0) return <TaskListView tasks={[]} onOpen={onOpen} />
  return (
    <div className="grid gap-4">
      {entries.map(([userId, list]) => {
        const open = list.filter((t) => t.status !== 'done').length
        const overdue = list.filter((t) => daysOverdue(t, today) > 0).length
        return (
          <Card key={userId || 'none'}>
            <CardHeader className="flex-row items-center gap-3">
              <Avatar name={nameOf(userId) || '?'} src={byId.get(userId)?.avatar_url} />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">{nameOf(userId) || vi.tasks.unassigned}</CardTitle>
                <p
                  className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}
                >
                  {vi.tasks.counts(open, overdue)}
                </p>
              </div>
              <div className="hidden gap-1 sm:flex">
                {STATUSES.map((s) => {
                  const n = list.filter((t) => t.status === s).length
                  return n ? (
                    <Badge key={s} variant={statusVariant[s]}>
                      {vi.taskStatus[s]} {n}
                    </Badge>
                  ) : null
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TaskRows tasks={list} onOpen={onOpen} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
